import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/hooks/useAuth';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import Dialog from '../../../shared/components/ui/Dialog';
import api from '../../../shared/services/api';
import { useFormDraft } from '../../../shared/hooks/useFormDraft';
import { consultationSchema, type ConsultationFormData } from '../consultationSchema';
import '../styles/ConsultationForm.css';

// ICD-10 suggestions come from the backend API (/api/icd10/search/?q=...) — 179+ codes
let icd10SearchTimer: ReturnType<typeof setTimeout> | null = null;

const COMMON_SYMPTOMS = [
    'Fever', 'Cough', 'Shortness of breath', 'Fatigue', 'Headache',
    'Sore throat', 'Runny nose', 'Chest pain', 'Nausea', 'Vomiting',
    'Diarrhea', 'Abdominal pain', 'Back pain', 'Joint pain', 'Dizziness',
    'Loss of appetite', 'Weight loss', 'Sweating', 'Chills', 'Rash',
];

// Helper: convert empty string input to null for optional numeric fields
const numericValueAs = (v: unknown) => (v === '' || v == null) ? null : Number(v);

interface Consultation {
    id?: number;
    consultation_date: string;
    consultation_type?: string;
    reason_for_consultation: string;
    symptoms?: string[];
    medical_report: string | null;
    diagnosis: string | null;
    icd_code?: string | null;
    follow_up_date?: string | null;
    weight: number | null;
    height: number | null;
    height_unit: string;
    sp2: number | null;
    temperature: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    blood_pressure_display?: string | null;
    visible_to_patient?: boolean;
}

interface ConsultationFormProps {
    patientId: string;
    onSuccess: () => void;
    onCancel: () => void;
    consultationToEdit?: Consultation | null;
}

const ConsultationForm = ({ patientId, onSuccess, onCancel, consultationToEdit }: ConsultationFormProps) => {
    const { t } = useTranslation();
    const { isAuthenticated, profile } = useAuth();

    // Non-form state
    const [symptoms, setSymptoms] = useState<string[]>([]);
    const [customSymptom, setCustomSymptom] = useState('');
    const [icdSuggestions, setIcdSuggestions] = useState<{ code: string; label: string }[]>([]);
    const [showIcdSuggestions, setShowIcdSuggestions] = useState(false);
    const [pendingFollowUp, setPendingFollowUp] = useState<{ date: string; reason: string } | null>(null);
    const [creatingFollowUp, setCreatingFollowUp] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        getValues,
        watch,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<ConsultationFormData>({
        resolver: zodResolver(consultationSchema),
        defaultValues: {
            consultation_date: new Date().toISOString().slice(0, 10),
            consultation_type: 'in_person',
            reason_for_consultation: '',
            medical_report: '',
            diagnosis: '',
            follow_up_date: null,
            icd_code: null,
            weight: null,
            height: null,
            height_unit: 'cm',
            sp2: null,
            temperature: null,
            bp_systolic: null,
            bp_diastolic: null,
            visible_to_patient: false,
        },
    });

    // Draft auto-save (new consultations only) — keyed by doctorId+patientId to prevent cross-doctor leakage
    type FormDraft = { formData: ConsultationFormData; symptoms: string[] };
    const { loadDraft, saveDraft, clearDraft } = useFormDraft<FormDraft>(`consultation_${profile?.id ?? 'anon'}_${patientId}`);
    const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draftRestoredRef = useRef(false);
    const [draftPrompt, setDraftPrompt] = useState<{ savedAt: string; entry: ReturnType<typeof loadDraft> } | null>(null);
    // Ref so the watch subscription closure always sees current symptoms
    const symptomsRef = useRef(symptoms);
    symptomsRef.current = symptoms;

    // On mount (new consultation only): show Dialog to restore draft if one exists
    useEffect(() => {
        if (consultationToEdit) return;
        const entry = loadDraft();
        if (!entry) return;
        const savedAt = new Date(entry.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setDraftPrompt({ savedAt, entry });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounce-save draft on every form field change (subscription avoids re-renders)
    useEffect(() => {
        if (consultationToEdit) return;
        const { unsubscribe } = watch(() => {
            if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
            draftTimerRef.current = setTimeout(() => {
                saveDraft({ formData: getValues() as ConsultationFormData, symptoms: symptomsRef.current });
            }, 10_000);
        });
        return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounce-save draft when symptoms change
    useEffect(() => {
        if (consultationToEdit) return;
        if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        draftTimerRef.current = setTimeout(() => {
            saveDraft({ formData: getValues() as ConsultationFormData, symptoms });
        }, 10_000);
        return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symptoms]);

    // Prescriptions for this visit — compact multi-medicine adder
    type RxDraft = { medication_name: string; dosage: string; frequency: string; duration_days: string };
    const emptyRxDraft = (): RxDraft => ({ medication_name: '', dosage: '', frequency: 'once_daily', duration_days: '' });
    const [rxList, setRxList] = useState<RxDraft[]>([]);
    const [rxDraft, setRxDraft] = useState<RxDraft>(emptyRxDraft());

    const pushRxToList = () => {
        if (!rxDraft.medication_name.trim() || !rxDraft.dosage.trim()) return;
        setRxList(prev => [...prev, { ...rxDraft }]);
        setRxDraft(emptyRxDraft());
    };

    // Edit mode: populate form from existing consultation
    useEffect(() => {
        if (consultationToEdit) {
            reset({
                consultation_date: consultationToEdit.consultation_date || new Date().toISOString().slice(0, 10),
                consultation_type: (consultationToEdit.consultation_type || 'in_person') as 'in_person' | 'telemedicine' | 'home_visit',
                reason_for_consultation: consultationToEdit.reason_for_consultation,
                medical_report: consultationToEdit.medical_report || '',
                diagnosis: consultationToEdit.diagnosis || '',
                follow_up_date: consultationToEdit.follow_up_date || null,
                icd_code: consultationToEdit.icd_code || null,
                weight: consultationToEdit.weight,
                height: consultationToEdit.height,
                height_unit: (consultationToEdit.height_unit || 'cm') as 'cm' | 'm',
                sp2: consultationToEdit.sp2,
                temperature: consultationToEdit.temperature,
                bp_systolic: consultationToEdit.bp_systolic,
                bp_diastolic: consultationToEdit.bp_diastolic,
                visible_to_patient: consultationToEdit.visible_to_patient || false,
            });
            setSymptoms(consultationToEdit.symptoms || []);
        }
    }, [consultationToEdit, reset]);

    const toggleSymptom = (symptom: string) => {
        setSymptoms(prev =>
            prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
        );
    };

    const addCustomSymptom = () => {
        const trimmed = customSymptom.trim();
        if (trimmed && !symptoms.includes(trimmed)) {
            setSymptoms(prev => [...prev, trimmed]);
            setCustomSymptom('');
        }
    };

    const onSubmit = async (data: ConsultationFormData) => {
        if (!isAuthenticated) {
            toast.error(t('consultation.error.auth'));
            return;
        }

        try {
            const dataToSend = {
                ...data,
                patient: patientId,
                symptoms,
                follow_up_date: data.follow_up_date || null,
                icd_code: data.icd_code || null,
            };

            let response;
            if (consultationToEdit?.id) {
                response = await api.put(`/consultations/${consultationToEdit.id}/`, dataToSend);
            } else {
                response = await api.post('/consultations/', dataToSend);
            }

            if (response.status === 201 || response.status === 200) {
                // Save all queued prescriptions — each failure shows a toast but doesn't block close
                if (!isEditing && rxList.length > 0) {
                    let failCount = 0;
                    for (const rx of rxList) {
                        try {
                            await api.post('/prescriptions/', {
                                patient: patientId,
                                consultation: response.data.id,
                                medication_name: rx.medication_name,
                                dosage: rx.dosage,
                                frequency: rx.frequency,
                                duration_days: rx.duration_days ? parseInt(rx.duration_days, 10) : null,
                                instructions: '',
                            });
                        } catch {
                            failCount++;
                        }
                    }
                    if (failCount > 0) {
                        toast.error(`${failCount} prescription(s) could not be saved. Add them manually from the Medications tab.`);
                    }
                }
                clearDraft();
                toast.success(isEditing ? t('consultation.submit_edit') : t('consultation.submit_add'));

                // If new consultation with follow-up date, prompt to create follow-up appointment
                if (!isEditing && data.follow_up_date) {
                    setPendingFollowUp({
                        date: data.follow_up_date,
                        reason: `Follow-up: ${data.reason_for_consultation}`,
                    });
                } else {
                    onSuccess();
                }
            }
        } catch (err) {
            toast.error(parseApiError(err, t('consultation.error.generic')));
        }
    };

    const isEditing = !!consultationToEdit;

    const handleCreateFollowUpAppointment = async () => {
        if (!pendingFollowUp) return;
        setCreatingFollowUp(true);
        try {
            await api.post('/appointments/', {
                patient: patientId,
                appointment_date: `${pendingFollowUp.date}T09:00:00`,
                reason_for_appointment: pendingFollowUp.reason,
                status: 'scheduled',
            });
            toast.success('Follow-up appointment created and scheduled.');
        } catch {
            toast.error('Could not create follow-up appointment. You can create it manually from the Appointments page.');
        } finally {
            setCreatingFollowUp(false);
            setPendingFollowUp(null);
            onSuccess();
        }
    };

    // Follow-up prompt dialog shown after consultation saved
    if (pendingFollowUp) {
        return (
            <div className="modal-overlay">
                <div className="modal-box followup-prompt-modal">
                    <h3 className="modal-title">Create Follow-up Appointment?</h3>
                    <p className="modal-desc">
                        You set a follow-up date of <strong>{new Date(pendingFollowUp.date + 'T00:00:00').toLocaleDateString()}</strong>.
                        Would you like to create a scheduled appointment for that date?
                    </p>
                    <div className="modal-actions">
                        <button type="button" className="cancel-button" onClick={() => { setPendingFollowUp(null); onSuccess(); }}>
                            No, skip
                        </button>
                        <button type="button" className="btn btn-success" onClick={handleCreateFollowUpAppointment} disabled={creatingFollowUp}>
                            {creatingFollowUp ? 'Creating...' : 'Yes, create appointment'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ICD-10 field registration (custom onChange needed for typeahead)
    const icdCodeField = register('icd_code');

    return (
        <>
        <Dialog
            open={!!draftPrompt}
            tone="info"
            title="Restore unsaved draft?"
            message={draftPrompt ? `You have an unsaved draft from ${draftPrompt.savedAt}. Do you want to restore it?` : undefined}
            confirmLabel="Restore draft"
            cancelLabel="Discard"
            onClose={() => {
                clearDraft();
                draftRestoredRef.current = true;
                setDraftPrompt(null);
            }}
            onConfirm={() => {
                if (draftPrompt?.entry) {
                    reset(draftPrompt.entry.data.formData);
                    setSymptoms(draftPrompt.entry.data.symptoms);
                }
                draftRestoredRef.current = true;
                setDraftPrompt(null);
            }}
        />
        <Drawer
            open
            onClose={onCancel}
            title={isEditing ? t('consultation.title_edit') : t('consultation.title_add')}
            size="lg"
            dirty={isDirty}
            footer={
                <>
                    <button type="button" onClick={onCancel} className="cancel-button" disabled={isSubmitting}>
                        {t('consultation.cancel')}
                    </button>
                    <button type="submit" form="consultation-form" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? t('consultation.loading') : (isEditing ? t('consultation.submit_edit') : t('consultation.submit_add'))}
                    </button>
                </>
            }
        >
            <form id="consultation-form" onSubmit={handleSubmit(onSubmit)} className="form">
                {/* Consultation date */}
                <div className="form-group">
                    <label htmlFor="consultation_date">{t('consultation.date')} <span className="required">*</span></label>
                    <input type="date" id="consultation_date" className="input" {...register('consultation_date')} />
                    {errors.consultation_date && <span className="field-error">{errors.consultation_date.message}</span>}
                </div>

                {/* Consultation type */}
                <div className="form-group">
                    <label htmlFor="consultation_type">Consultation Type</label>
                    <select id="consultation_type" className="select-input" {...register('consultation_type')}>
                        <option value="in_person">In Person</option>
                        <option value="telemedicine">Telemedicine</option>
                        <option value="home_visit">Home Visit</option>
                    </select>
                </div>

                {/* Vitals */}
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="weight">{t('consultation.weight')}</label>
                        <input type="number" step="0.01" id="weight" className="input"
                            {...register('weight', { setValueAs: numericValueAs })} />
                        {errors.weight && <span className="field-error">{errors.weight.message}</span>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="height">
                            {t('consultation.height')}
                            <select {...register('height_unit')} style={{ marginLeft: '8px', fontWeight: 'normal', fontSize: '0.85em' }}>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                            </select>
                        </label>
                        <input type="number" step="0.01" id="height" className="input"
                            {...register('height', { setValueAs: numericValueAs })} />
                        {errors.height && <span className="field-error">{errors.height.message}</span>}
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="temperature">{t('consultation.temperature')}</label>
                        <input type="number" step="0.01" id="temperature" className="input"
                            {...register('temperature', { setValueAs: numericValueAs })} />
                        {errors.temperature && <span className="field-error">{errors.temperature.message}</span>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="sp2">{t('consultation.sp2')}</label>
                        <input type="number" step="0.01" id="sp2" className="input"
                            {...register('sp2', { setValueAs: numericValueAs })} />
                        {errors.sp2 && <span className="field-error">{errors.sp2.message}</span>}
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="bp_systolic">BP Systolic (mmHg)</label>
                        <input type="number" id="bp_systolic" className="input" min="50" max="300"
                            {...register('bp_systolic', { setValueAs: numericValueAs })} />
                        {errors.bp_systolic && <span className="field-error">{errors.bp_systolic.message}</span>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="bp_diastolic">BP Diastolic (mmHg)</label>
                        <input type="number" id="bp_diastolic" className="input" min="30" max="200"
                            {...register('bp_diastolic', { setValueAs: numericValueAs })} />
                        {errors.bp_diastolic && <span className="field-error">{errors.bp_diastolic.message}</span>}
                    </div>
                </div>

                <hr />

                {/* Clinical info */}
                <div className="form-group">
                    <label htmlFor="reason_for_consultation">{t('consultation.reason')} <span className="required">*</span></label>
                    <textarea id="reason_for_consultation" className="textarea" rows={3}
                        {...register('reason_for_consultation')} />
                    {errors.reason_for_consultation && <span className="field-error">{errors.reason_for_consultation.message}</span>}
                </div>

                {/* Symptoms multi-select */}
                <div className="form-group">
                    <label>Symptoms</label>
                    <div className="symptoms-chips">
                        {COMMON_SYMPTOMS.map(s => (
                            <button
                                key={s}
                                type="button"
                                className={`symptom-chip${symptoms.includes(s) ? ' active' : ''}`}
                                onClick={() => toggleSymptom(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <div className="custom-symptom-row">
                        <input
                            type="text"
                            placeholder="Add custom symptom..."
                            value={customSymptom}
                            onChange={e => setCustomSymptom(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSymptom())}
                        />
                        <button type="button" onClick={addCustomSymptom} className="add-chip-btn">Add</button>
                    </div>
                    {symptoms.filter(s => !COMMON_SYMPTOMS.includes(s)).map(s => (
                        <span key={s} className="symptom-chip active custom-chip">
                            {s}
                            <button type="button" onClick={() => toggleSymptom(s)} className="chip-remove">×</button>
                        </span>
                    ))}
                </div>

                <div className="form-group">
                    <label htmlFor="diagnosis">{t('consultation.diagnosis')}</label>
                    <textarea id="diagnosis" className="textarea" rows={3} {...register('diagnosis')} />
                </div>

                {/* ICD-10 code lookup */}
                <div className="form-group" style={{ position: 'relative' }}>
                    <label htmlFor="icd_code">ICD-10 Code <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85em' }}>(structured anchor for diagnosis)</span></label>
                    <input
                        id="icd_code"
                        type="text"
                        autoComplete="off"
                        placeholder="e.g. J06.9 — or type condition name to search"
                        {...icdCodeField}
                        onChange={e => {
                            icdCodeField.onChange(e);
                            const val = e.target.value;
                            if (val.length >= 1) {
                                setShowIcdSuggestions(true);
                                if (icd10SearchTimer) clearTimeout(icd10SearchTimer);
                                icd10SearchTimer = setTimeout(async () => {
                                    try {
                                        const res = await api.get('/icd10/search/', { params: { q: val } });
                                        setIcdSuggestions(
                                            res.data.map((item: { code: string; description: string }) => ({
                                                code: item.code,
                                                label: item.description,
                                            }))
                                        );
                                        setShowIcdSuggestions(true);
                                    } catch {
                                        setIcdSuggestions([]);
                                    }
                                }, 250);
                            } else {
                                setIcdSuggestions([]);
                                setShowIcdSuggestions(false);
                            }
                        }}
                        onBlur={e => { icdCodeField.onBlur(e); setTimeout(() => setShowIcdSuggestions(false), 150); }}
                    />
                    {showIcdSuggestions && icdSuggestions.length > 0 && (
                        <ul className="icd-suggestions-dropdown">
                            {icdSuggestions.map(item => (
                                <li key={item.code}>
                                    <button type="button" onMouseDown={() => {
                                        setValue('icd_code', item.code);
                                        // Pre-fill diagnosis label if empty
                                        if (!getValues('diagnosis')) {
                                            setValue('diagnosis', item.label);
                                        }
                                        setShowIcdSuggestions(false);
                                        setIcdSuggestions([]);
                                    }}>
                                        <span className="icd-code">{item.code}</span>
                                        <span className="icd-label">{item.label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="medical_report">{t('consultation.report')}</label>
                    <textarea id="medical_report" rows={5} {...register('medical_report')} />
                </div>

                {/* Follow-up date */}
                <div className="form-group">
                    <label htmlFor="follow_up_date">Follow-up Date</label>
                    <input type="date" id="follow_up_date" {...register('follow_up_date')} />
                </div>

                {/* Prescriptions this visit — compact multi-medicine adder */}
                {!consultationToEdit && (
                    <div className="rx-section">
                        <div className="rx-section-header">
                            <span className="rx-section-label">Prescriptions this visit</span>
                            {rxList.length > 0 && <span className="rx-count">{rxList.length}</span>}
                        </div>

                        {rxList.length > 0 && (
                            <div className="rx-list">
                                {rxList.map((rx, i) => (
                                    <div key={i} className="rx-item">
                                        <span className="rx-item-name">{rx.medication_name}</span>
                                        <span className="rx-item-sep">·</span>
                                        <span className="rx-item-detail">{rx.dosage}</span>
                                        <span className="rx-item-sep">·</span>
                                        <span className="rx-item-detail">{rx.frequency.replace(/_/g, ' ')}</span>
                                        {rx.duration_days && (
                                            <><span className="rx-item-sep">·</span><span className="rx-item-detail">{rx.duration_days}d</span></>
                                        )}
                                        <button
                                            type="button"
                                            className="rx-remove"
                                            onClick={() => setRxList(p => p.filter((_, j) => j !== i))}
                                            aria-label="Remove prescription"
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="rx-adder">
                            <input
                                type="text"
                                className="rx-adder-input"
                                placeholder="Medication name"
                                value={rxDraft.medication_name}
                                onChange={e => setRxDraft(p => ({ ...p, medication_name: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), pushRxToList())}
                            />
                            <input
                                type="text"
                                className="rx-adder-input rx-adder-dosage"
                                placeholder="Dosage"
                                value={rxDraft.dosage}
                                onChange={e => setRxDraft(p => ({ ...p, dosage: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), pushRxToList())}
                            />
                            <select
                                className="rx-adder-select"
                                value={rxDraft.frequency}
                                onChange={e => setRxDraft(p => ({ ...p, frequency: e.target.value }))}
                            >
                                <option value="once">Once</option>
                                <option value="once_daily">Once daily</option>
                                <option value="twice_daily">Twice daily</option>
                                <option value="three_times_daily">3× daily</option>
                                <option value="four_times_daily">4× daily</option>
                                <option value="as_needed">PRN</option>
                                <option value="weekly">Weekly</option>
                                <option value="other">Other</option>
                            </select>
                            <input
                                type="number"
                                className="rx-adder-input rx-adder-days"
                                placeholder="Days"
                                min="1"
                                value={rxDraft.duration_days}
                                onChange={e => setRxDraft(p => ({ ...p, duration_days: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), pushRxToList())}
                            />
                            <button
                                type="button"
                                className="rx-adder-btn"
                                disabled={!rxDraft.medication_name.trim() || !rxDraft.dosage.trim()}
                                onClick={pushRxToList}
                            >
                                + Add
                            </button>
                        </div>
                        <p className="rx-hint">Prescriptions save automatically when you submit the consultation.</p>
                    </div>
                )}

                {/* Visible to patient toggle */}
                <div className="form-group form-checkbox">
                    <label>
                        <input type="checkbox" {...register('visible_to_patient')} />
                        {' '}Will be visible to patient once the patient portal is live
                    </label>
                </div>
            </form>
        </Drawer>
        </>
    );
};

export default ConsultationForm;
