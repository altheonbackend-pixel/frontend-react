import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/hooks/useAuth';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import Dialog from '../../../shared/components/ui/Dialog';
import api from '../../../shared/services/api';
import type { AxiosResponse } from 'axios';
import { useFormDraft } from '../../../shared/hooks/useFormDraft';
import { useNavigationBlocker } from '../../../shared/hooks/useNavigationBlocker';
import { consultationSchema, type ConsultationFormData } from '../consultationSchema';
import { FailedPrescriptionsPanel, type RxItem } from './FailedPrescriptionsPanel';
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

export interface SavedRx {
    id: number;
    medication_name: string;
    dosage: string;
    frequency: string;
    frequency_display?: string;
}

interface ConsultationFormProps {
    patientId: string;
    onSuccess: (savedRx?: SavedRx[]) => void;
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
    const [pendingFollowUp, setPendingFollowUp] = useState<{ date: string; reason: string; consultationId: number } | null>(null);
    const [creatingFollowUp, setCreatingFollowUp] = useState(false);
    const [showCloseWithFailedRxWarning, setShowCloseWithFailedRxWarning] = useState(false);

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
            visible_to_patient: true,
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

    // Last consultation vitals — pre-fill weight/height on new consultations
    const { data: lastConsultVitals } = useQuery<{
        weight: number | null; height: number | null; height_unit: string;
    } | null>({
        queryKey: ['patients', patientId, 'lastConsultVitals'],
        queryFn: async () => {
            const res = await api.get('/consultations/', {
                params: { patient_id: patientId, ordering: '-consultation_date', limit: 1 },
            });
            const results = res.data.results ?? res.data;
            if (!results.length) return null;
            const c = results[0];
            return { weight: c.weight ?? null, height: c.height ?? null, height_unit: c.height_unit || 'cm' };
        },
        staleTime: 5 * 60_000,
        enabled: !consultationToEdit,
    });

    // Pre-fill weight/height from last consultation once data arrives, but only
    // when the field is still empty (don't overwrite user input or a restored draft).
    useEffect(() => {
        if (!lastConsultVitals) return;
        if (draftRestoredRef.current) return;
        if (lastConsultVitals.weight != null && getValues('weight') == null) {
            setValue('weight', lastConsultVitals.weight, { shouldDirty: false });
        }
        if (lastConsultVitals.height != null && getValues('height') == null) {
            setValue('height', lastConsultVitals.height, { shouldDirty: false });
            setValue('height_unit', lastConsultVitals.height_unit as 'cm' | 'm', { shouldDirty: false });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastConsultVitals]);

    // Patient drug allergies — used for inline banner and pre-submission conflict check
    const { data: drugAllergies = [] } = useQuery<Array<{ allergen: string; severity: string }>>({
        queryKey: ['patients', patientId, 'drug-allergies'],
        queryFn: async () => {
            const res = await api.get(`/patients/${patientId}/`);
            const records: Array<{ allergen: string; reaction_type: string; severity: string; is_active: boolean }> = res.data.allergy_records || [];
            return records.filter(a => a.reaction_type === 'drug' && a.is_active);
        },
        staleTime: 5 * 60_000,
        enabled: !consultationToEdit,
    });

    // Prescriptions for this visit — compact multi-medicine adder
    type RxDraft = { medication_name: string; dosage: string; frequency: string; duration_days: string; overrideAllergy?: boolean };
    const emptyRxDraft = (): RxDraft => ({ medication_name: '', dosage: '', frequency: 'once_daily', duration_days: '' });
    const [rxList, setRxList] = useState<RxDraft[]>([]);
    const [rxDraft, setRxDraft] = useState<RxDraft>(emptyRxDraft());
    const [failedRx, setFailedRx] = useState<RxItem[]>([]);
    // Persists saved Rx across the follow-up dialog path so reconciliation modal always gets them
    const savedRxRef = useRef<SavedRx[]>([]);
    const [allergyOverrideDialog, setAllergyOverrideDialog] = useState<{
        rx: RxDraft;
        conflicts: Array<{ allergen: string; severity: string }>;
    } | null>(null);

    // Block in-app navigation (sidebar links, back button) when form has unsaved changes
    useNavigationBlocker(isDirty || failedRx.length > 0);

    // Real-time vital alert computation — mirrors backend compute_vital_alerts()
    const watchedSp2 = watch('sp2');
    const watchedTemp = watch('temperature');
    const watchedSystolic = watch('bp_systolic');
    const watchedDiastolic = watch('bp_diastolic');
    const vitalAlerts: string[] = [];
    if (watchedSp2 != null && watchedSp2 < 94) vitalAlerts.push(`SpO2 ${watchedSp2}% — below normal (≥94%)`);
    if (watchedTemp != null && watchedTemp > 38.5) vitalAlerts.push(`Fever: ${watchedTemp}°C (normal ≤38.5°C)`);
    if (watchedTemp != null && watchedTemp < 35.5) vitalAlerts.push(`Hypothermia: ${watchedTemp}°C`);
    if (watchedSystolic != null && watchedSystolic > 180) vitalAlerts.push(`Hypertensive crisis: systolic ${watchedSystolic} mmHg`);
    if (watchedSystolic != null && watchedSystolic < 90) vitalAlerts.push(`Hypotension: systolic ${watchedSystolic} mmHg`);
    if (watchedDiastolic != null && watchedDiastolic > 120) vitalAlerts.push(`Hypertensive urgency: diastolic ${watchedDiastolic} mmHg`);
    const hasVitalAlerts = vitalAlerts.length > 0;

    const [vitalsConfirmOpen, setVitalsConfirmOpen] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<ConsultationFormData | null>(null);

    // Lab orders for this visit
    interface LabOrderDraft { id: string; test_name: string; notes: string; }
    const [labList, setLabList] = useState<LabOrderDraft[]>([]);
    const [labsOpen, setLabsOpen] = useState(false);
    const addLab = () => setLabList(l => [...l, { id: crypto.randomUUID(), test_name: '', notes: '' }]);
    const removeLab = (id: string) => setLabList(l => l.filter(x => x.id !== id));
    const updateLab = (id: string, field: keyof Omit<LabOrderDraft, 'id'>, value: string) =>
        setLabList(l => l.map(x => x.id === id ? { ...x, [field]: value } : x));

    // Procedures for this visit
    interface ProcedureDraft { id: string; procedure_type: string; procedure_category: string; notes: string; }
    const [procList, setProcList] = useState<ProcedureDraft[]>([]);
    const [procsOpen, setProcsOpen] = useState(false);
    const addProc = () => setProcList(p => [...p, { id: crypto.randomUUID(), procedure_type: '', procedure_category: 'diagnostic', notes: '' }]);
    const removeProc = (id: string) => setProcList(p => p.filter(x => x.id !== id));
    const updateProc = (id: string, field: keyof Omit<ProcedureDraft, 'id'>, value: string) =>
        setProcList(p => p.map(x => x.id === id ? { ...x, [field]: value } : x));

    const pushRxToList = () => {
        if (!rxDraft.medication_name.trim() || !rxDraft.dosage.trim()) return;
        const medLower = rxDraft.medication_name.trim().toLowerCase();
        const conflicts = drugAllergies.filter(a =>
            a.allergen.toLowerCase().includes(medLower) || medLower.includes(a.allergen.toLowerCase())
        );
        if (conflicts.length > 0) {
            setAllergyOverrideDialog({ rx: rxDraft, conflicts });
            return;
        }
        setRxList(prev => [...prev, { ...rxDraft }]);
        setRxDraft(emptyRxDraft());
    };

    const confirmAllergyOverride = () => {
        if (!allergyOverrideDialog) return;
        setRxList(prev => [...prev, { ...allergyOverrideDialog.rx, overrideAllergy: true }]);
        setRxDraft(emptyRxDraft());
        setAllergyOverrideDialog(null);
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
                visible_to_patient: true,
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

    const doSubmit = async (data: ConsultationFormData) => {
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
                const consultationId = response.data.id;
                const today = new Date().toISOString().slice(0, 10);

                // Save all queued prescriptions via Promise.allSettled — failures surface in retry panel
                let savedRx: SavedRx[] = [];
                if (!isEditing && rxList.length > 0) {
                    const rxPayloads: RxItem[] = rxList.map(rx => ({
                        patient: patientId,
                        consultation: consultationId,
                        medication_name: rx.medication_name,
                        dosage: rx.dosage,
                        frequency: rx.frequency,
                        duration_days: rx.duration_days ? parseInt(rx.duration_days, 10) : null,
                        ...(rx.overrideAllergy ? { override_allergy_warning: true } : {}),
                    }));
                    const results = await Promise.allSettled(
                        rxPayloads.map(rx => api.post('/prescriptions/', rx))
                    );
                    const failed = rxPayloads.filter((_, i) => results[i].status === 'rejected');
                    if (failed.length > 0) {
                        setFailedRx(failed);
                        // Don't call onSuccess yet — doctor must resolve failed prescriptions first
                        toast.error(`${failed.length} prescription(s) could not be saved. Retry from the panel below.`);
                        clearDraft();
                        return;
                    }
                    // Collect saved prescription data to pass to the medication reconciliation modal
                    savedRx = results
                        .filter((r): r is PromiseFulfilledResult<AxiosResponse> => r.status === 'fulfilled')
                        .map(r => {
                            const d = r.value.data as SavedRx;
                            return {
                                id: d.id,
                                medication_name: d.medication_name,
                                dosage: d.dosage,
                                frequency: d.frequency,
                                frequency_display: d.frequency_display,
                            };
                        });
                    savedRxRef.current = savedRx;
                }

                // Save queued lab orders — non-blocking (consultation already saved)
                if (!isEditing && labList.length > 0) {
                    const labPayloads = labList.filter(l => l.test_name.trim()).map(l => ({
                        patient: patientId,
                        consultation: consultationId,
                        test_name: l.test_name.trim(),
                        test_date: today,
                        ...(l.notes.trim() ? { notes: l.notes.trim() } : {}),
                    }));
                    if (labPayloads.length > 0) {
                        const labResults = await Promise.allSettled(labPayloads.map(l => api.post('/lab-results/', l)));
                        const failedCount = labResults.filter(r => r.status === 'rejected').length;
                        if (failedCount > 0) {
                            toast.error(`${failedCount} lab order(s) could not be saved — add them manually from the Labs tab.`);
                        }
                    }
                }

                // Save queued procedures — non-blocking
                if (!isEditing && procList.length > 0) {
                    const procPayloads = procList.filter(p => p.procedure_type.trim()).map(p => ({
                        patient: patientId,
                        consultation: consultationId,
                        procedure_type: p.procedure_type.trim(),
                        procedure_category: p.procedure_category,
                        procedure_date: today,
                        ...(p.notes.trim() ? { result: p.notes.trim() } : {}),
                    }));
                    if (procPayloads.length > 0) {
                        const procResults = await Promise.allSettled(procPayloads.map(p => api.post('/procedures/', p)));
                        const failedCount = procResults.filter(r => r.status === 'rejected').length;
                        if (failedCount > 0) {
                            toast.error(`${failedCount} procedure(s) could not be saved — add them manually from the Procedures tab.`);
                        }
                    }
                }

                clearDraft();
                toast.success(isEditing ? t('consultation.submit_edit') : t('consultation.submit_add'));

                // If new consultation with follow-up date, prompt to create follow-up appointment
                if (!isEditing && data.follow_up_date) {
                    setPendingFollowUp({
                        date: data.follow_up_date,
                        reason: `Follow-up: ${data.reason_for_consultation}`,
                        consultationId: response.data.id,
                    });
                } else {
                    // Pass savedRx (even if empty []) for new consultations — triggers the
                    // medication reconciliation modal. For edits pass undefined to skip it.
                    onSuccess(!consultationToEdit?.id ? savedRx : undefined);
                }
            }
        } catch (err) {
            toast.error(parseApiError(err, t('consultation.error.generic')));
        }
    };

    const onSubmit = async (data: ConsultationFormData) => {
        if (!isAuthenticated) {
            toast.error(t('consultation.error.auth'));
            return;
        }
        if (hasVitalAlerts && !vitalsConfirmOpen) {
            setPendingSubmitData(data);
            setVitalsConfirmOpen(true);
            return;
        }
        setPendingSubmitData(null);
        await doSubmit(data);
    };

    const isEditing = !!consultationToEdit;

    const handleCreateFollowUpAppointment = async () => {
        if (!pendingFollowUp) return;
        setCreatingFollowUp(true);
        try {
            const apptRes = await api.post('/appointments/', {
                patient: patientId,
                appointment_date: `${pendingFollowUp.date}T09:00:00`,
                reason_for_appointment: pendingFollowUp.reason,
                status: 'scheduled',
            });
            // Link the appointment back to the consultation so the patient portal
            // can reflect live status changes (reschedule / cancel).
            await api.patch(`/consultations/${pendingFollowUp.consultationId}/`, {
                follow_up_appointment: apptRes.data.id,
            }).catch(() => {});
            toast.success('Follow-up appointment created and scheduled.');
        } catch {
            toast.error('Could not create follow-up appointment. You can create it manually from the Appointments page.');
        } finally {
            setCreatingFollowUp(false);
            setPendingFollowUp(null);
            onSuccess(savedRxRef.current);
        }
    };

    const handleCancel = () => {
        if (failedRx.length > 0) {
            setShowCloseWithFailedRxWarning(true);
        } else {
            onCancel();
        }
    };

    // ICD-10 field registration (custom onChange needed for typeahead)
    const icdCodeField = register('icd_code');

    return (
        <>
        <Dialog
            open={vitalsConfirmOpen}
            tone="danger"
            title="Critical vitals detected"
            message={
                <div>
                    <p style={{ marginBottom: '0.5rem' }}>This consultation has the following critical readings:</p>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {vitalAlerts.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                    <p style={{ marginTop: '0.75rem' }}>Confirm to proceed with saving.</p>
                </div>
            }
            confirmLabel="Confirm and save"
            cancelLabel="Go back and review"
            onConfirm={() => {
                setVitalsConfirmOpen(false);
                if (pendingSubmitData) doSubmit(pendingSubmitData);
            }}
            onClose={() => { setVitalsConfirmOpen(false); setPendingSubmitData(null); }}
        />
        <Dialog
            open={!!pendingFollowUp}
            tone="info"
            title="Create Follow-up Appointment?"
            message={pendingFollowUp ? <>You set a follow-up date of <strong>{new Date(pendingFollowUp.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Would you like to create a scheduled appointment for that date?</> : undefined}
            confirmLabel={creatingFollowUp ? 'Creating…' : 'Yes, create appointment'}
            cancelLabel="No, skip"
            onConfirm={handleCreateFollowUpAppointment}
            onClose={() => { setPendingFollowUp(null); onSuccess(savedRxRef.current.length > 0 ? savedRxRef.current : undefined); }}
        />
        <Dialog
            open={showCloseWithFailedRxWarning}
            tone="danger"
            title="Unsaved prescriptions"
            message={`${failedRx.length} prescription(s) have not been saved. Closing now will permanently lose this data.`}
            confirmLabel="Close and lose data"
            cancelLabel="Go back and save"
            onConfirm={() => { setFailedRx([]); setShowCloseWithFailedRxWarning(false); onCancel(); }}
            onClose={() => setShowCloseWithFailedRxWarning(false)}
        />
        <Dialog
            open={!!allergyOverrideDialog}
            tone="warning"
            title="Allergy conflict detected"
            message={allergyOverrideDialog ? (
                `${allergyOverrideDialog.rx.medication_name} may conflict with the patient's active drug ${allergyOverrideDialog.conflicts.length === 1 ? 'allergy' : 'allergies'}: ` +
                allergyOverrideDialog.conflicts.map(c => `${c.allergen} (${c.severity})`).join(', ') +
                '. Add anyway and document clinical justification in your notes?'
            ) : undefined}
            confirmLabel="Add with override"
            cancelLabel="Cancel"
            onClose={() => setAllergyOverrideDialog(null)}
            onConfirm={confirmAllergyOverride}
        />
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
            onClose={handleCancel}
            title={isEditing ? t('consultation.title_edit') : t('consultation.title_add')}
            size="lg"
            dirty={isDirty || failedRx.length > 0}
            footer={
                <>
                    <button type="button" onClick={handleCancel} className="cancel-button" disabled={isSubmitting}>
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

                {hasVitalAlerts && (
                    <div className="vital-alerts-banner" role="alert">
                        <strong>Clinical alert</strong>
                        <ul>
                            {vitalAlerts.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                    </div>
                )}

                <hr />

                {/* Visible to patient toggle */}
                <div className="form-group visible-to-patient-toggle">
                    <label className="toggle-row">
                        <span className="toggle-label">
                            Share with patient portal
                            <span className="toggle-hint">Patient can see diagnosis, summary, and prescriptions when enabled</span>
                        </span>
                        <input
                            type="checkbox"
                            role="switch"
                            {...register('visible_to_patient')}
                        />
                    </label>
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

                {/* Drug allergy banner — shown above prescriptions when patient has active drug allergies */}
                {!consultationToEdit && drugAllergies.length > 0 && (
                    <div style={{ background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: 'var(--color-warning-dark)', lineHeight: 1.5 }}>
                        <strong>Drug allergies:</strong>{' '}
                        {drugAllergies.map((a, i) => (
                            <span key={i}>
                                {i > 0 && ' · '}
                                <strong>{a.allergen}</strong> ({a.severity})
                            </span>
                        ))}
                    </div>
                )}

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
                                        {rx.overrideAllergy && (
                                            <span title="Allergy override" style={{ fontSize: '0.7rem', background: 'var(--color-warning-light)', color: 'var(--color-warning-dark)', borderRadius: '4px', padding: '1px 5px', border: '1px solid var(--color-warning-border)' }}>⚠ allergy override</span>
                                        )}
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
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                <input
                                    type="number"
                                    className="rx-adder-input rx-adder-days"
                                    placeholder="Days"
                                    min="1"
                                    value={rxDraft.duration_days}
                                    onChange={e => setRxDraft(p => ({ ...p, duration_days: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), pushRxToList())}
                                />
                                {rxDraft.duration_days && parseInt(rxDraft.duration_days, 10) > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                        until {new Date(Date.now() + parseInt(rxDraft.duration_days, 10) * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                    </span>
                                )}
                            </div>
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

                {/* Lab orders for this visit */}
                {!consultationToEdit && (
                    <div className="consult-section">
                        <button
                            type="button"
                            className="consult-section-toggle"
                            onClick={() => { setLabsOpen(o => !o); if (!labsOpen && labList.length === 0) addLab(); }}
                        >
                            {labsOpen ? '−' : '+'} Lab Tests Ordered
                            {labList.filter(l => l.test_name.trim()).length > 0 && (
                                <span className="consult-section-badge">{labList.filter(l => l.test_name.trim()).length}</span>
                            )}
                        </button>
                        {labsOpen && (
                            <div className="consult-section-body">
                                {labList.map(item => (
                                    <div key={item.id} className="consult-inline-row">
                                        <input
                                            className="input consult-inline-input"
                                            placeholder="Test name (e.g. HbA1c, CBC, Lipid panel)"
                                            value={item.test_name}
                                            onChange={e => updateLab(item.id, 'test_name', e.target.value)}
                                        />
                                        <input
                                            className="input consult-inline-input consult-inline-notes"
                                            placeholder="Notes (optional)"
                                            value={item.notes}
                                            onChange={e => updateLab(item.id, 'notes', e.target.value)}
                                        />
                                        <button type="button" className="consult-remove-btn" onClick={() => removeLab(item.id)} aria-label="Remove">×</button>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-ghost btn-sm consult-add-row-btn" onClick={addLab}>+ Add test</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Procedures for this visit */}
                {!consultationToEdit && (
                    <div className="consult-section">
                        <button
                            type="button"
                            className="consult-section-toggle"
                            onClick={() => { setProcsOpen(o => !o); if (!procsOpen && procList.length === 0) addProc(); }}
                        >
                            {procsOpen ? '−' : '+'} Procedure Performed
                            {procList.filter(p => p.procedure_type.trim()).length > 0 && (
                                <span className="consult-section-badge">{procList.filter(p => p.procedure_type.trim()).length}</span>
                            )}
                        </button>
                        {procsOpen && (
                            <div className="consult-section-body">
                                {procList.map(item => (
                                    <div key={item.id} className="consult-inline-row">
                                        <input
                                            className="input consult-inline-input"
                                            placeholder="Procedure (e.g. Blood draw, Wound dressing, Vaccination)"
                                            value={item.procedure_type}
                                            onChange={e => updateProc(item.id, 'procedure_type', e.target.value)}
                                        />
                                        <select
                                            className="consult-inline-select"
                                            value={item.procedure_category}
                                            onChange={e => updateProc(item.id, 'procedure_category', e.target.value)}
                                        >
                                            <option value="diagnostic">Diagnostic</option>
                                            <option value="therapeutic">Therapeutic</option>
                                            <option value="surgical">Surgical</option>
                                            <option value="screening">Screening</option>
                                            <option value="vaccination">Vaccination</option>
                                            <option value="other">Other</option>
                                        </select>
                                        <input
                                            className="input consult-inline-input consult-inline-notes"
                                            placeholder="Notes (optional)"
                                            value={item.notes}
                                            onChange={e => updateProc(item.id, 'notes', e.target.value)}
                                        />
                                        <button type="button" className="consult-remove-btn" onClick={() => removeProc(item.id)} aria-label="Remove">×</button>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-ghost btn-sm consult-add-row-btn" onClick={addProc}>+ Add procedure</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Failed prescription retry panel — shown after submit if any prescriptions failed */}
                <FailedPrescriptionsPanel
                    failed={failedRx}
                    onItemSaved={(saved) =>
                        setFailedRx(prev => prev.filter(rx => rx.medication_name !== saved.medication_name))
                    }
                />
            </form>
        </Drawer>
        </>
    );
};

export default ConsultationForm;
