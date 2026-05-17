import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/hooks/useAuth';
import { Drawer, Modal, toast, parseApiError } from '../../../shared/components/ui';
import Dialog from '../../../shared/components/ui/Dialog';
import api from '../../../shared/services/api';
import type { AxiosResponse } from 'axios';
import { useFormDraft } from '../../../shared/hooks/useFormDraft';
import { useNavigationBlocker } from '../../../shared/hooks/useNavigationBlocker';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';
import { consultationSchema, type ConsultationFormData } from '../consultationSchema';
import { FailedPrescriptionsPanel, type RxItem } from './FailedPrescriptionsPanel';
import { DrugAutocomplete, type DrugChoice, type SafetyResult } from './DrugAutocomplete';
import { SafetyAlertModal } from './SafetyAlertModal';
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
    consultation_status?: string;
    reason_for_consultation: string;
    symptoms?: string[];
    medical_report: string | null;
    diagnosis: string | null;
    icd_code?: string | null;
    follow_up_date?: string | null;
    follow_up_appointment?: number | null;
    weight: number | null;
    height: number | null;
    height_unit: string;
    sp2: number | null;
    temperature: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    blood_pressure_display?: string | null;
    visible_to_patient?: boolean;
    patient_summary?: string | null;
    patient_instructions?: string | null;
    prescriptions?: Array<{ id: number; medication_name: string; dosage: string; frequency: string; duration_days: number | null; instructions: string; is_active: boolean; }>;
    lab_results?: Array<{ id: number; test_name: string; status: string; test_date: string; }>;
    procedures?: Array<{ id: number; procedure_type: string; procedure_category?: string; procedure_date: string; result?: string | null; }>;
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
    /** True when opened from start_consultation — treat as new but PUT to existing draft id */
    isDraft?: boolean;
    /** When true, render inline (no Drawer wrapper) — used by the telehealth side panel
        where the host already provides chrome/header/close. */
    embedded?: boolean;
}

const ConsultationForm = ({ patientId, onSuccess, onCancel, consultationToEdit, isDraft = false, embedded = false }: ConsultationFormProps) => {
    const { formatTime, formatDayMonth } = useFormatDateTime();
    const { t } = useTranslation();
    const { isAuthenticated, profile } = useAuth();
    const queryClient = useQueryClient();

    // Ref flag: when true, doSubmit will call sign/ after saving and invalidate appointments cache (EC-1+EC-2)
    const signOnNextSubmitRef = useRef(false);

    // Non-form state
    const [symptoms, setSymptoms] = useState<string[]>([]);
    const [customSymptom, setCustomSymptom] = useState('');
    const [icdSuggestions, setIcdSuggestions] = useState<{ code: string; label: string }[]>([]);
    const [showIcdSuggestions, setShowIcdSuggestions] = useState(false);
    const [pendingFollowUp, setPendingFollowUp] = useState<{ date: string; reason: string; consultationId: number; appointmentType: 'in_person' | 'telemedicine' } | null>(null);
    const [followUpType, setFollowUpType] = useState<'in_person' | 'telemedicine'>('in_person');
    const [followUpDate, setFollowUpDate] = useState('');
    const [followUpSlots, setFollowUpSlots] = useState<Array<{ time: string; datetime: string; status: string; patient_name?: string }>>([]);
    const [followUpSlotsLoading, setFollowUpSlotsLoading] = useState(false);
    const [followUpDayOff, setFollowUpDayOff] = useState(false);
    const [followUpSelectedSlot, setFollowUpSelectedSlot] = useState<string | null>(null);
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
            patient_summary: '',
            patient_instructions: '',
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
        const savedAt = formatTime(entry.savedAt);
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
        enabled: !consultationToEdit || consultationToEdit?.consultation_status === 'amended',
    });

    // Prescriptions for this visit — compact multi-medicine adder.
    // CR-P0-01 / CR-P0-02 / CR-P0-03: rxnorm_rxcui carries the coded drug
    // identity (set by DrugAutocomplete picker). When present, the backend
    // runs allergy + DDI + dose safety checks via the medications service.
    // safety_override carries the doctor's documented justification for
    // bypassing a blocking alert.
    type SafetyOverridePayload = {
        allergy_overrides?: { allergen: string; matched_value: string; reason: string }[];
        interaction_overrides?: { existing_drug_rxcui: string; reason: string }[];
    };
    type RxDraft = {
        medication_name: string;
        rxnorm_rxcui?: string;
        dosage: string;
        frequency: string;
        duration_days: string;
        overrideAllergy?: boolean;
        safety_override?: SafetyOverridePayload;
    };
    const emptyRxDraft = (): RxDraft => ({ medication_name: '', rxnorm_rxcui: '', dosage: '', frequency: 'once_daily', duration_days: '' });
    const [rxList, setRxList] = useState<RxDraft[]>([]);
    const [rxDraft, setRxDraft] = useState<RxDraft>(emptyRxDraft());
    const [failedRx, setFailedRx] = useState<RxItem[]>([]);
    // Persists saved Rx across the follow-up dialog path so reconciliation modal always gets them
    const savedRxRef = useRef<SavedRx[]>([]);
    const [allergyOverrideDialog, setAllergyOverrideDialog] = useState<{
        rx: RxDraft;
        conflicts: Array<{ allergen: string; severity: string }>;
    } | null>(null);

    // Track IDs of existing items removed during amendment (deleted on save)
    const [deletedRxIds, setDeletedRxIds] = useState<number[]>([]);
    const [deletedLabIds, setDeletedLabIds] = useState<number[]>([]);
    const [deletedProcIds, setDeletedProcIds] = useState<number[]>([]);

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

    // Phase-1 RxNorm-coded safety preview, shown when the doctor finishes
    // picking a drug. If blocking alerts come back, the SafetyAlertModal
    // captures the override reason and adds the Rx with the override
    // payload that the backend will record as an audit row.
    const [pendingSafety, setPendingSafety] = useState<{
        drug: DrugChoice; safety: SafetyResult; rx: RxDraft;
    } | null>(null);

    const pushRxToList = () => {
        if (!rxDraft.medication_name.trim() || !rxDraft.dosage.trim()) return;

        // If the drug is coded via RxNorm AND the safety preview already
        // ran (returned via onDrugSelect), the modal-or-skip decision was
        // made there. For legacy free-text names, fall back to the prior
        // name-fuzzy allergy check.
        if (!rxDraft.rxnorm_rxcui) {
            const medLower = rxDraft.medication_name.trim().toLowerCase();
            const conflicts = drugAllergies.filter(a =>
                a.allergen.toLowerCase().includes(medLower) || medLower.includes(a.allergen.toLowerCase())
            );
            if (conflicts.length > 0) {
                setAllergyOverrideDialog({ rx: rxDraft, conflicts });
                return;
            }
        }
        setRxList(prev => [...prev, { ...rxDraft }]);
        setRxDraft(emptyRxDraft());
    };

    const handleDrugSelect = (drug: DrugChoice | null, safety: SafetyResult | null) => {
        if (!drug) {
            setRxDraft(p => ({ ...p, medication_name: '', rxnorm_rxcui: '' }));
            return;
        }
        const updatedDraft: RxDraft = {
            ...rxDraft,
            medication_name: drug.name,
            rxnorm_rxcui: drug.rxcui,
        };
        setRxDraft(updatedDraft);
        // If the live safety preview returned alerts, prompt the doctor
        // with the override modal NOW — before they fill in dose.
        if (safety && (safety.allergy_alerts.length || safety.interaction_alerts.length)) {
            setPendingSafety({ drug, safety, rx: updatedDraft });
        }
    };

    const handleSafetyModalConfirm = (payload: SafetyOverridePayload) => {
        if (!pendingSafety) return;
        setRxDraft(p => ({ ...p, safety_override: payload }));
        setPendingSafety(null);
    };

    const handleSafetyModalCancel = () => {
        if (!pendingSafety) return;
        // User chose to NOT prescribe — clear the picker.
        setRxDraft(p => ({ ...p, medication_name: '', rxnorm_rxcui: '', safety_override: undefined }));
        setPendingSafety(null);
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
                visible_to_patient: consultationToEdit.visible_to_patient ?? true,
                patient_summary: consultationToEdit.patient_summary || '',
                patient_instructions: consultationToEdit.patient_instructions || '',
            });
            setSymptoms(consultationToEdit.symptoms || []);
        }
    }, [consultationToEdit, reset]);

    // When follow-up dialog opens, seed the date and clear prior slot selection
    useEffect(() => {
        if (pendingFollowUp?.date) {
            setFollowUpDate(pendingFollowUp.date);
            setFollowUpSelectedSlot(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingFollowUp?.date]);

    // Fetch slots whenever followUpDate changes (only while dialog is open)
    useEffect(() => {
        if (!followUpDate || !pendingFollowUp) { setFollowUpSlots([]); return; }
        setFollowUpSlotsLoading(true);
        setFollowUpSlots([]);
        setFollowUpDayOff(false);
        setFollowUpSelectedSlot(null);
        api.get<{ slots: Array<{ time: string; datetime: string; status: string; patient_name?: string }>; day_off: boolean }>(
            `/appointments/day-slots/?date=${followUpDate}`
        ).then(res => {
            if (res.data.day_off) setFollowUpDayOff(true);
            else setFollowUpSlots(res.data.slots ?? []);
        }).catch(() => {}).finally(() => setFollowUpSlotsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [followUpDate]);

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

    // "Save & Complete" button handler — sets the sign flag then triggers form validation + submit
    const handleSaveAndComplete = () => {
        signOnNextSubmitRef.current = true;
        handleSubmit(onSubmit)();
    };

    const doSubmit = async (data: ConsultationFormData) => {
        const shouldSign = signOnNextSubmitRef.current;
        signOnNextSubmitRef.current = false;
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

                // Auto-include any pending draft the doctor filled but didn't click + Add
                const finalRxList = (rxDraft.medication_name.trim() && rxDraft.dosage.trim())
                    ? [...rxList, { ...rxDraft }]
                    : rxList;

                // Save all queued prescriptions via Promise.allSettled — failures surface in retry panel
                let savedRx: SavedRx[] = [];
                if (finalRxList.length > 0) {
                    const rxPayloads: RxItem[] = finalRxList.map(rx => ({
                        patient_id: patientId,
                        consultation_id: consultationId,
                        rxnorm_rxcui: rx.rxnorm_rxcui ?? '',
                        custom_drug_name: rx.rxnorm_rxcui ? '' : rx.medication_name,
                        medication_name: rx.medication_name,
                        dosage: rx.dosage,
                        frequency: rx.frequency,
                        duration_days: rx.duration_days ? parseInt(rx.duration_days, 10) : null,
                        ...(rx.overrideAllergy ? { override_allergy_warning: true } : {}),
                        ...(rx.safety_override ? { safety_override: rx.safety_override } : {}),
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

                // Save queued lab orders — POST to /lab-orders/ (Wave 6 split)
                if (labList.length > 0) {
                    const labPayloads = labList.filter(l => l.test_name.trim()).map(l => ({
                        patient: patientId,
                        consultation: consultationId,
                        test_name: l.test_name.trim(),
                        order_date: today,
                        priority: 'routine',
                        ...(l.notes.trim() ? { notes: l.notes.trim() } : {}),
                    }));
                    if (labPayloads.length > 0) {
                        const labResults = await Promise.allSettled(labPayloads.map(l => api.post('/lab-orders/', l)));
                        const failedCount = labResults.filter(r => r.status === 'rejected').length;
                        if (failedCount > 0) {
                            toast.error(`${failedCount} lab order(s) could not be saved — add them manually from the Labs tab.`);
                        }
                    }
                }

                // Save queued procedures — non-blocking
                if (procList.length > 0) {
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

                // Batch-delete items removed during amendment editing
                if (deletedRxIds.length > 0) {
                    await Promise.allSettled(deletedRxIds.map(id => api.delete(`/prescriptions/${id}/`)));
                }
                if (deletedLabIds.length > 0) {
                    await Promise.allSettled(deletedLabIds.map(id => api.delete(`/lab-results/${id}/`)));
                }
                if (deletedProcIds.length > 0) {
                    await Promise.allSettled(deletedProcIds.map(id => api.delete(`/procedures/${id}/`)));
                }

                clearDraft();
                toast.success(isEditing && !isDraft ? t('consultation.submit_edit') : t('consultation.submit_add'));

                // Sign the consultation when "Save & Complete" is clicked for drafts or amendments.
                if (shouldSign && (isDraft || isAmended)) {
                    try {
                        await api.post(`/consultations/${consultationId}/sign/`);
                        queryClient.invalidateQueries({ queryKey: ['appointments'] });
                        toast.success(isAmended ? 'Amendment signed and consultation re-locked.' : 'Consultation signed and appointment completed.');
                    } catch (signErr) {
                        toast.error(parseApiError(signErr, 'Consultation saved but could not be signed. Please try again.'));
                    }
                }

                // Prompt follow-up booking for new, draft, or amended consultations
                // where a date is set but no appointment has been linked yet.
                const alreadyHasFollowUp = !!consultationToEdit?.follow_up_appointment;
                if ((!isEditing || isDraft || isAmended) && data.follow_up_date && !alreadyHasFollowUp) {
                    const apptType = data.consultation_type === 'telemedicine' ? 'telemedicine' : 'in_person';
                    setFollowUpType(apptType);
                    setPendingFollowUp({
                        date: data.follow_up_date,
                        reason: `Follow-up: ${data.reason_for_consultation}`,
                        consultationId: response.data.id,
                        appointmentType: apptType,
                    });
                } else {
                    // Pass savedRx for new/draft consultations to trigger medication reconciliation.
                    // For true edits pass undefined to skip it.
                    onSuccess(!isEditing || isDraft ? savedRx : undefined);
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
    const isAmended = consultationToEdit?.consultation_status === 'amended';

    const handleCreateFollowUpAppointment = async () => {
        if (!pendingFollowUp || !followUpSelectedSlot) return;
        setCreatingFollowUp(true);
        try {
            const apptRes = await api.post('/appointments/', {
                patient: patientId,
                appointment_date: followUpSelectedSlot,
                reason_for_appointment: pendingFollowUp.reason,
                appointment_type: followUpType,
            });
            await api.patch(`/consultations/${pendingFollowUp.consultationId}/`, {
                follow_up_appointment: apptRes.data.id,
            }).catch(() => {});
            toast.success('Follow-up appointment scheduled. Patient notified to confirm.');
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
            onClose={() => { setVitalsConfirmOpen(false); setPendingSubmitData(null); signOnNextSubmitRef.current = false; }}
        />
        <Modal
            open={!!pendingFollowUp}
            onClose={() => { setPendingFollowUp(null); onSuccess(savedRxRef.current.length > 0 ? savedRxRef.current : undefined); }}
            title="Schedule Follow-up Appointment"
            size="sm"
            footer={
                <>
                    <button type="button" className="cancel-button" onClick={() => { setPendingFollowUp(null); onSuccess(savedRxRef.current.length > 0 ? savedRxRef.current : undefined); }}>
                        Skip for now
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!followUpSelectedSlot || creatingFollowUp}
                        onClick={handleCreateFollowUpAppointment}
                    >
                        {creatingFollowUp ? 'Creating…' : 'Create Appointment'}
                    </button>
                </>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                    Pick a date and available slot. The patient will be notified to confirm.
                </p>

                {/* Date */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>Date</label>
                    <input
                        type="date"
                        className="input"
                        min={new Date().toISOString().slice(0, 10)}
                        value={followUpDate}
                        onChange={e => setFollowUpDate(e.target.value)}
                    />
                </div>

                {/* Appointment type */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>Type</label>
                    <select
                        className="input"
                        value={followUpType}
                        onChange={e => setFollowUpType(e.target.value as 'in_person' | 'telemedicine')}
                    >
                        <option value="in_person">In Person</option>
                        <option value="telemedicine">Telemedicine (Video)</option>
                    </select>
                </div>

                {/* Slot grid */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>Available Slots</label>
                    {followUpSlotsLoading && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading slots…</div>}
                    {!followUpSlotsLoading && followUpDayOff && <div style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>Day off — choose a different date.</div>}
                    {!followUpSlotsLoading && !followUpDayOff && followUpSlots.length === 0 && followUpDate && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No slots available for this date.</div>}
                    {!followUpSlotsLoading && !followUpDayOff && followUpSlots.length > 0 && (
                        <div className="slot-grid">
                            {followUpSlots.map(slot => (
                                <button
                                    key={slot.time}
                                    type="button"
                                    className={['slot-btn', `slot-${slot.status}`, followUpSelectedSlot === slot.datetime ? 'slot-selected' : ''].join(' ').trim()}
                                    disabled={slot.status !== 'free'}
                                    title={slot.status === 'booked' ? `Booked — ${slot.patient_name ?? ''}` : slot.time}
                                    onClick={() => setFollowUpSelectedSlot(slot.datetime)}
                                >
                                    <span className="slot-time">{slot.time}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
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

        {/* CR-P0-02 / CR-P0-01: RxNorm-backed safety alert modal. Renders
            when the live drug-safety preview returns allergy or DDI hits. */}
        {pendingSafety && (
            <SafetyAlertModal
                drugName={pendingSafety.drug.name}
                safety={pendingSafety.safety}
                onCancel={handleSafetyModalCancel}
                onConfirm={handleSafetyModalConfirm}
            />
        )}
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
        {(() => {
            const footerButtons = (
                <>
                    <button type="button" onClick={handleCancel} className="cancel-button" disabled={isSubmitting}>
                        {t('consultation.cancel')}
                    </button>
                    {(isDraft || isAmended) ? (
                        <>
                            <button type="submit" form="consultation-form" className="btn btn-secondary" disabled={isSubmitting}>
                                {isSubmitting ? t('consultation.loading') : (isDraft ? 'Save Draft' : 'Save')}
                            </button>
                            <button type="button" onClick={handleSaveAndComplete} className="btn btn-primary" disabled={isSubmitting}>
                                {isSubmitting ? t('consultation.loading') : (isAmended ? 'Save & Re-sign' : 'Save & Complete')}
                            </button>
                        </>
                    ) : (
                        <button type="submit" form="consultation-form" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? t('consultation.loading') : (isEditing ? t('consultation.submit_edit') : t('consultation.submit_add'))}
                        </button>
                    )}
                </>
            );
            const formBody = (
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

                {/* Patient-facing fields — only relevant when sharing is on */}
                {watch('visible_to_patient') && (
                    <div style={{ background: 'var(--accent-lighter)', borderRadius: 'var(--radius-md)', padding: '0.875rem', margin: '0.75rem 0', display: 'grid', gap: '0.75rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Patient portal content
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="patient_summary">Patient-friendly summary</label>
                            <textarea
                                id="patient_summary"
                                className="textarea"
                                rows={3}
                                placeholder="Plain-language summary of today's visit that the patient can read."
                                {...register('patient_summary')}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="patient_instructions">Next steps / instructions for patient</label>
                            <textarea
                                id="patient_instructions"
                                className="textarea"
                                rows={2}
                                placeholder="e.g. Take medication with food. Return in 2 weeks if no improvement."
                                {...register('patient_instructions')}
                            />
                        </div>
                    </div>
                )}

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
                    <input type="date" id="follow_up_date" min={new Date().toISOString().slice(0, 10)} {...register('follow_up_date')} />
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
                {(!consultationToEdit || isDraft || isAmended) && (
                    <div className="rx-section">
                        <div className="rx-section-header">
                            <span className="rx-section-label">Prescriptions this visit</span>
                            {rxList.length > 0 && <span className="rx-count">{rxList.length}</span>}
                        </div>

                        {/* Pre-loaded prescriptions from the original consultation (amendment mode) */}
                        {isAmended && consultationToEdit?.prescriptions && consultationToEdit.prescriptions.filter(rx => !deletedRxIds.includes(rx.id)).length > 0 && (
                            <div className="rx-list">
                                {consultationToEdit.prescriptions.filter(rx => !deletedRxIds.includes(rx.id)).map(rx => (
                                    <div key={rx.id} className="rx-item" style={{ opacity: rx.is_active ? 1 : 0.5 }}>
                                        <span className="rx-item-name">{rx.medication_name}</span>
                                        <span className="rx-item-sep">·</span>
                                        <span className="rx-item-detail">{rx.dosage}</span>
                                        <span className="rx-item-sep">·</span>
                                        <span className="rx-item-detail">{rx.frequency.replace(/_/g, ' ')}</span>
                                        {rx.duration_days && <><span className="rx-item-sep">·</span><span className="rx-item-detail">{rx.duration_days}d</span></>}
                                        {!rx.is_active && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px' }}>(stopped)</span>}
                                        <button
                                            type="button"
                                            className="rx-remove"
                                            onClick={() => setDeletedRxIds(prev => [...prev, rx.id])}
                                            aria-label="Remove prescription"
                                            title="Remove from this consultation"
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        )}

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

                        <div className="rx-adder" style={{ flexWrap: 'wrap' }}>
                            {/* CR-P0-02: RxNorm-backed drug picker. Replaces free-text
                                medication name. Live safety preview runs on select. */}
                            <div style={{ flex: '1 1 240px', minWidth: 240 }}>
                                <DrugAutocomplete
                                    patientId={patientId}
                                    onSelect={handleDrugSelect}
                                    placeholder={t('drug_autocomplete.placeholder', 'Search drug by name (e.g. amoxicillin)…')}
                                />
                                {rxDraft.rxnorm_rxcui && (
                                    <small style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.7rem' }}>
                                        RxCUI: {rxDraft.rxnorm_rxcui}
                                        {rxDraft.safety_override && ' · override documented'}
                                    </small>
                                )}
                            </div>
                            <input
                                type="text"
                                className="rx-adder-input rx-adder-dosage"
                                placeholder={t('rx.dosage_placeholder', 'Dosage')}
                                value={rxDraft.dosage}
                                onChange={e => setRxDraft(p => ({ ...p, dosage: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), pushRxToList())}
                            />
                            <select
                                className="rx-adder-select"
                                value={rxDraft.frequency}
                                onChange={e => setRxDraft(p => ({ ...p, frequency: e.target.value }))}
                            >
                                <option value="once">{t('rx.freq.once', 'Once')}</option>
                                <option value="once_daily">{t('rx.freq.qd', 'Once daily (QD)')}</option>
                                <option value="twice_daily">{t('rx.freq.bid', 'Twice daily (BID)')}</option>
                                <option value="three_times_daily">{t('rx.freq.tid', 'Three times daily (TID)')}</option>
                                <option value="four_times_daily">{t('rx.freq.qid', 'Four times daily (QID)')}</option>
                                <option value="every_4h">{t('rx.freq.q4h', 'Every 4 hours (Q4H)')}</option>
                                <option value="every_6h">{t('rx.freq.q6h', 'Every 6 hours (Q6H)')}</option>
                                <option value="every_8h">{t('rx.freq.q8h', 'Every 8 hours (Q8H)')}</option>
                                <option value="every_12h">{t('rx.freq.q12h', 'Every 12 hours (Q12H)')}</option>
                                <option value="bedtime">{t('rx.freq.hs', 'At bedtime (HS)')}</option>
                                <option value="as_needed">{t('rx.freq.prn', 'As needed (PRN)')}</option>
                                <option value="weekly">{t('rx.freq.weekly', 'Weekly')}</option>
                                <option value="other">{t('common.other', 'Other')}</option>
                            </select>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '0 0 76px', minWidth: '66px' }}>
                                <input
                                    type="number"
                                    className="rx-adder-input rx-adder-days"
                                    placeholder="Days"
                                    min="1"
                                    value={rxDraft.duration_days}
                                    onChange={e => setRxDraft(p => ({ ...p, duration_days: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), pushRxToList())}
                                    style={{ width: '100%' }}
                                />
                                {rxDraft.duration_days && parseInt(rxDraft.duration_days, 10) > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        until {formatDayMonth(Date.now() + parseInt(rxDraft.duration_days, 10) * 864e5)}
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
                {(!consultationToEdit || isDraft || isAmended) && (
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
                                {/* Pre-loaded lab results from the original consultation */}
                                {isAmended && consultationToEdit?.lab_results && consultationToEdit.lab_results.filter(lr => !deletedLabIds.includes(lr.id)).map(lr => (
                                    <div key={lr.id} className="consult-inline-row">
                                        <span className="input consult-inline-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', color: 'var(--text-primary)', cursor: 'default' }}>
                                            {lr.test_name}
                                        </span>
                                        <span className="input consult-inline-input consult-inline-notes" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', color: 'var(--text-muted)', cursor: 'default', fontSize: '0.82rem' }}>
                                            {lr.status}
                                        </span>
                                        <button type="button" className="consult-remove-btn" onClick={() => setDeletedLabIds(prev => [...prev, lr.id])} aria-label="Remove">×</button>
                                    </div>
                                ))}
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
                {(!consultationToEdit || isDraft || isAmended) && (
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
                                {/* Pre-loaded procedures from the original consultation */}
                                {isAmended && consultationToEdit?.procedures && consultationToEdit.procedures.filter(p => !deletedProcIds.includes(p.id)).map(p => (
                                    <div key={p.id} className="consult-inline-row">
                                        <span className="input consult-inline-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', color: 'var(--text-primary)', cursor: 'default' }}>
                                            {p.procedure_type}
                                        </span>
                                        <span className="consult-inline-select" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0 8px' }}>
                                            {p.procedure_category ?? 'diagnostic'}
                                        </span>
                                        <span className="input consult-inline-input consult-inline-notes" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', color: 'var(--text-muted)', cursor: 'default', fontSize: '0.82rem' }}>
                                            {p.result ?? ''}
                                        </span>
                                        <button type="button" className="consult-remove-btn" onClick={() => setDeletedProcIds(prev => [...prev, p.id])} aria-label="Remove">×</button>
                                    </div>
                                ))}
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
            );

            if (embedded) {
                return (
                    <div className="consultation-form-embedded">
                        <div className="consultation-form-embedded__body">{formBody}</div>
                        <div className="consultation-form-embedded__footer">{footerButtons}</div>
                    </div>
                );
            }

            return (
                <Drawer
                    open
                    onClose={handleCancel}
                    title={isEditing && !isDraft ? t('consultation.title_edit') : t('consultation.title_add')}
                    size="lg"
                    dirty={isDirty || failedRx.length > 0}
                    footer={footerButtons}
                >
                    {formBody}
                </Drawer>
            );
        })()}
        </>
    );
};

export default ConsultationForm;
