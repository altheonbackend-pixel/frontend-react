import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';
import { useFormDraft } from '../../../shared/hooks/useFormDraft';
import '../styles/ConsultationForm.css';

// ICD-10 suggestions come from the backend API (/api/icd10/search/?q=...) — 179+ codes
let icd10SearchTimer: ReturnType<typeof setTimeout> | null = null;

const COMMON_SYMPTOMS = [
    'Fever', 'Cough', 'Shortness of breath', 'Fatigue', 'Headache',
    'Sore throat', 'Runny nose', 'Chest pain', 'Nausea', 'Vomiting',
    'Diarrhea', 'Abdominal pain', 'Back pain', 'Joint pain', 'Dizziness',
    'Loss of appetite', 'Weight loss', 'Sweating', 'Chills', 'Rash',
];

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
    const { isAuthenticated } = useAuth();
    const [formData, setFormData] = useState({
        consultation_date: new Date().toISOString().slice(0, 10),
        consultation_type: 'in_person',
        reason_for_consultation: '',
        medical_report: '',
        diagnosis: '',
        follow_up_date: '',
        weight: '',
        height: '',
        height_unit: 'cm',
        sp2: '',
        temperature: '',
        bp_systolic: '',
        bp_diastolic: '',
        visible_to_patient: false,
    });
    const [symptoms, setSymptoms] = useState<string[]>([]);
    const [customSymptom, setCustomSymptom] = useState('');
    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [icdSuggestions, setIcdSuggestions] = useState<{ code: string; label: string }[]>([]);
    const [showIcdSuggestions, setShowIcdSuggestions] = useState(false);
    const [icdCode, setIcdCode] = useState('');
    const [pendingFollowUp, setPendingFollowUp] = useState<{ date: string; reason: string } | null>(null);
    const [creatingFollowUp, setCreatingFollowUp] = useState(false);

    // Draft auto-save (new consultations only)
    type FormDraft = { formData: typeof formData; symptoms: string[]; icdCode: string };
    const { loadDraft, saveDraft, clearDraft } = useFormDraft<FormDraft>(`consultation_${patientId}`);
    const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draftRestoredRef = useRef(false);

    // On mount (new consultation only): prompt to restore draft if one exists
    useEffect(() => {
        if (consultationToEdit) return;
        const entry = loadDraft();
        if (!entry) return;
        const savedAt = new Date(entry.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const restore = window.confirm(`Restore unsaved draft from ${savedAt}?`);
        if (restore) {
            setFormData(entry.data.formData);
            setSymptoms(entry.data.symptoms);
            setIcdCode(entry.data.icdCode);
        } else {
            clearDraft();
        }
        draftRestoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounce-save draft on every change (new consultations only, 10s debounce)
    useEffect(() => {
        if (consultationToEdit) return;
        if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        draftTimerRef.current = setTimeout(() => {
            saveDraft({ formData, symptoms, icdCode });
        }, 10_000);
        return () => {
            if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData, symptoms, icdCode]);

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

    useEffect(() => {
        if (consultationToEdit) {
            setFormData({
                consultation_date: consultationToEdit.consultation_date || new Date().toISOString().slice(0, 10),
                consultation_type: consultationToEdit.consultation_type || 'in_person',
                reason_for_consultation: consultationToEdit.reason_for_consultation,
                medical_report: consultationToEdit.medical_report || '',
                diagnosis: consultationToEdit.diagnosis || '',
                follow_up_date: consultationToEdit.follow_up_date || '',
                weight: consultationToEdit.weight !== null ? String(consultationToEdit.weight) : '',
                height: consultationToEdit.height !== null ? String(consultationToEdit.height) : '',
                sp2: consultationToEdit.sp2 !== null ? String(consultationToEdit.sp2) : '',
                temperature: consultationToEdit.temperature !== null ? String(consultationToEdit.temperature) : '',
                bp_systolic: consultationToEdit.bp_systolic !== null ? String(consultationToEdit.bp_systolic) : '',
                bp_diastolic: consultationToEdit.bp_diastolic !== null ? String(consultationToEdit.bp_diastolic) : '',
                height_unit: consultationToEdit.height_unit || 'cm',
                visible_to_patient: consultationToEdit.visible_to_patient || false,
            });
            setSymptoms(consultationToEdit.symptoms || []);
            setIcdCode(consultationToEdit.icd_code || '');
        }
    }, [consultationToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setDirty(true);
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const toggleSymptom = (symptom: string) => {
        setDirty(true);
        setSymptoms(prev =>
            prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
        );
    };

    const addCustomSymptom = () => {
        const trimmed = customSymptom.trim();
        if (trimmed && !symptoms.includes(trimmed)) {
            setDirty(true);
            setSymptoms(prev => [...prev, trimmed]);
            setCustomSymptom('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!isAuthenticated) {
            toast.error(t('consultation.error.auth'));
            setLoading(false);
            return;
        }

        try {
            const dataToSend = {
                ...formData,
                patient: patientId,
                symptoms,
                icd_code: icdCode || null,
                weight: formData.weight ? parseFloat(formData.weight) : null,
                height: formData.height ? parseFloat(formData.height) : null,
                sp2: formData.sp2 ? parseFloat(formData.sp2) : null,
                temperature: formData.temperature ? parseFloat(formData.temperature) : null,
                bp_systolic: formData.bp_systolic ? parseInt(formData.bp_systolic, 10) : null,
                bp_diastolic: formData.bp_diastolic ? parseInt(formData.bp_diastolic, 10) : null,
                follow_up_date: formData.follow_up_date || null,
            };

            let response;
            if (consultationToEdit && consultationToEdit.id) {
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
                setDirty(false);
                // If new consultation with follow-up date, prompt to create follow-up appointment
                if (!isEditing && formData.follow_up_date) {
                    setPendingFollowUp({
                        date: formData.follow_up_date,
                        reason: `Follow-up: ${formData.reason_for_consultation}`,
                    });
                } else {
                    onSuccess();
                }
            }
        } catch (err) {
            toast.error(parseApiError(err, t('consultation.error.generic')));
        } finally {
            setLoading(false);
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

    return (
        <Drawer
            open
            onClose={onCancel}
            title={isEditing ? t('consultation.title_edit') : t('consultation.title_add')}
            size="lg"
            dirty={dirty}
            footer={
                <>
                    <button type="button" onClick={onCancel} className="cancel-button" disabled={loading}>
                        {t('consultation.cancel')}
                    </button>
                    <button type="submit" form="consultation-form" className="btn btn-primary" disabled={loading}>
                        {loading ? t('consultation.loading') : (isEditing ? t('consultation.submit_edit') : t('consultation.submit_add'))}
                    </button>
                </>
            }
        >
                <form id="consultation-form" onSubmit={handleSubmit} className="form">
                    {/* Consultation date */}
                    <div className="form-group">
                        <label htmlFor="consultation_date">{t('consultation.date')} <span className="required">*</span></label>
                        <input type="date" id="consultation_date" name="consultation_date" className="input" value={formData.consultation_date} onChange={handleChange} required />
                    </div>

                    {/* Consultation type */}
                    <div className="form-group">
                        <label htmlFor="consultation_type">Consultation Type</label>
                        <select id="consultation_type" name="consultation_type" className="select-input" value={formData.consultation_type} onChange={handleChange}>
                            <option value="in_person">In Person</option>
                            <option value="telemedicine">Telemedicine</option>
                            <option value="home_visit">Home Visit</option>
                        </select>
                    </div>

                    {/* Vitals */}
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="weight">{t('consultation.weight')}</label>
                            <input type="number" step="0.01" id="weight" name="weight" className="input" value={formData.weight} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="height">
                                {t('consultation.height')}
                                <select name="height_unit" value={formData.height_unit} onChange={handleChange} style={{ marginLeft: '8px', fontWeight: 'normal', fontSize: '0.85em' }}>
                                    <option value="cm">cm</option>
                                    <option value="m">m</option>
                                </select>
                            </label>
                            <input type="number" step="0.01" id="height" name="height" className="input" value={formData.height} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="temperature">{t('consultation.temperature')}</label>
                            <input type="number" step="0.01" id="temperature" name="temperature" className="input" value={formData.temperature} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="sp2">{t('consultation.sp2')}</label>
                            <input type="number" step="0.01" id="sp2" name="sp2" className="input" value={formData.sp2} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="bp_systolic">BP Systolic (mmHg)</label>
                            <input type="number" id="bp_systolic" name="bp_systolic" className="input" value={formData.bp_systolic} onChange={handleChange} min="50" max="300" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="bp_diastolic">BP Diastolic (mmHg)</label>
                            <input type="number" id="bp_diastolic" name="bp_diastolic" className="input" value={formData.bp_diastolic} onChange={handleChange} min="30" max="200" />
                        </div>
                    </div>

                    <hr />

                    {/* Clinical info */}
                    <div className="form-group">
                        <label htmlFor="reason_for_consultation">{t('consultation.reason')} <span className="required">*</span></label>
                        <textarea id="reason_for_consultation" name="reason_for_consultation" className="textarea" value={formData.reason_for_consultation} onChange={handleChange} required rows={3} />
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
                        <textarea id="diagnosis" name="diagnosis" className="textarea" value={formData.diagnosis} onChange={handleChange} rows={3} />
                    </div>

                    {/* ICD-10 code lookup */}
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label htmlFor="icd_code">ICD-10 Code <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85em' }}>(structured anchor for diagnosis)</span></label>
                        <input
                            id="icd_code"
                            type="text"
                            value={icdCode}
                            onChange={e => {
                                const val = e.target.value;
                                setIcdCode(val);
                                setDirty(true);
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
                            onBlur={() => setTimeout(() => setShowIcdSuggestions(false), 150)}
                            autoComplete="off"
                            placeholder="e.g. J06.9 — or type condition name to search"
                        />
                        {showIcdSuggestions && icdSuggestions.length > 0 && (
                            <ul className="icd-suggestions-dropdown">
                                {icdSuggestions.map(item => (
                                    <li key={item.code}>
                                        <button type="button" onMouseDown={() => {
                                            setIcdCode(item.code);
                                            setDirty(true);
                                            // Also pre-fill diagnosis label if empty
                                            if (!formData.diagnosis) {
                                                setFormData(f => ({ ...f, diagnosis: item.label }));
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
                        <textarea id="medical_report" name="medical_report" value={formData.medical_report} onChange={handleChange} rows={5} />
                    </div>
                    {/* Follow-up date */}
                    <div className="form-group">
                        <label htmlFor="follow_up_date">Follow-up Date</label>
                        <input type="date" id="follow_up_date" name="follow_up_date" value={formData.follow_up_date} onChange={handleChange} />
                    </div>

                    {/* Prescriptions this visit — compact multi-medicine adder */}
                    {!consultationToEdit && (
                        <div className="rx-section">
                            <div className="rx-section-header">
                                <span className="rx-section-label">Prescriptions this visit</span>
                                {rxList.length > 0 && <span className="rx-count">{rxList.length}</span>}
                            </div>

                            {/* Added medicines */}
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

                            {/* Compact inline adder row */}
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
                            <input
                                type="checkbox"
                                name="visible_to_patient"
                                checked={formData.visible_to_patient}
                                onChange={handleChange}
                            />
                            {' '}Will be visible to patient once the patient portal is live
                        </label>
                    </div>

                </form>
        </Drawer>
    );
};

export default ConsultationForm;
