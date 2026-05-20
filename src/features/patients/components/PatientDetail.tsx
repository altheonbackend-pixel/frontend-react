import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/hooks/useAuth';
import { useKeyboardShortcut } from '../../../shared/hooks/useKeyboardShortcut';
import {
    type PatientWithHistory,
    type Consultation,
    type MedicalProcedure,
    type Referral,
} from '../../../shared/types';
import '../../../shared/styles/DetailStyles.css';
import './PatientDetail.css';
import ConsultationForm from '../../consultations/components/ConsultationForm';
import ConsultationView from '../../consultations/components/ConsultationView';
import MedicalProcedureForm from '../../procedures/components/MedicalProcedureForm';
import ReferralForm from '../../referrals/components/ReferralForm';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import PageLoader from '../../../shared/components/PageLoader';
import { Dialog, Modal, toast, parseApiError } from '../../../shared/components/ui';
import { type LabResult, type Prescription } from '../../../shared/types';
import { type SavedRx } from '../../consultations/components/ConsultationForm';
import { PageHeader } from '../../../shared/components/PageHeader';
import { Avatar } from '../../../shared/components/Avatar';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';

import OverviewTab from './tabs/OverviewTab';
import ConsultationsTab from './tabs/ConsultationsTab';
import LabsTab from './tabs/LabsTab';
import MedicationsTab from './tabs/MedicationsTab';
import MedicalActTab from './tabs/MedicalActTab';
import HistoryTab from './tabs/HistoryTab';
import PortalTab from './tabs/PortalTab';

type Tab = 'overview' | 'consultations' | 'labs' | 'medications' | 'medical_act' | 'history' | 'portal';

interface VitalsPoint {
    id: number;
    consultation_date: string;
    weight: number | null;
    height: number | null;
    height_unit: string;
    sp2: number | null;
    temperature: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    blood_pressure_display?: string | null;
}

const PatientDetails = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { isAuthenticated, profile, logout } = useAuth();
    const { formatDate } = useFormatDateTime();
    const [patient, setPatient] = useState<PatientWithHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    usePageTitle(patient ? `${patient.first_name} ${patient.last_name}` : 'Patient');
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set(['overview']));
    const queryClient = useQueryClient();

    const [showConsultationForm, setShowConsultationForm] = useState(false);
    const [showProcedureForm, setShowProcedureForm] = useState(false);
    const [showReferralForm, setShowReferralForm] = useState(false);
    const [showConditionForm, setShowConditionForm] = useState(false);
    const [showAllergyForm, setShowAllergyForm] = useState(false);

    const [consultationToEdit, setConsultationToEdit] = useState<Consultation | null>(null);
    const [consultationFormIsDraft, setConsultationFormIsDraft] = useState(false);
    const [viewingConsultation, setViewingConsultation] = useState<Consultation | null>(null);
    const [procedureToEdit, setProcedureToEdit] = useState<MedicalProcedure | null>(null);
    const [referralToEdit, setReferralToEdit] = useState<Referral | null>(null);

    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const openConsultHandledRef = useRef<string | null>(null);

    const [confirmDeleteConsultationId, setConfirmDeleteConsultationId] = useState<number | null>(null);
    const [confirmDeleteProcedureId, setConfirmDeleteProcedureId] = useState<number | null>(null);
    const [confirmDeleteReferralId, setConfirmDeleteReferralId] = useState<number | null>(null);
    const [resultFormReferralId, setResultFormReferralId] = useState<number | null>(null);
    const [resultText, setResultText] = useState('');
    const [resultSubmitting, setResultSubmitting] = useState(false);
    const [cancelFormReferralId, setCancelFormReferralId] = useState<number | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelSubmitting, setCancelSubmitting] = useState(false);
    const [recallFormReferralId, setRecallFormReferralId] = useState<number | null>(null);
    const [recallReason, setRecallReason] = useState('');
    const [recallSubmitting, setRecallSubmitting] = useState(false);
    const [openThreadReferralId, setOpenThreadReferralId] = useState<number | null>(null);

    const [consultView, setConsultView] = useState<'list' | 'charts'>('list');
    const [expandedConsultIds, setExpandedConsultIds] = useState<Set<number>>(new Set());
    const pendingScrollConsultIdRef = useRef<number | null>(null);
    const toggleConsult = (consultId: number) =>
        setExpandedConsultIds(prev => {
            const next = new Set(prev);
            next.has(consultId) ? next.delete(consultId) : next.add(consultId);
            return next;
        });

    const [showAllMeds, setShowAllMeds] = useState(false);
    const [showUnreleasedOnly, setShowUnreleasedOnly] = useState(false);

    const [visibleVitals, setVisibleVitals] = useState({
        bp: true, spo2: true, temperature: true, weight: true,
    });
    const toggleVital = (key: keyof typeof visibleVitals) =>
        setVisibleVitals(prev => ({ ...prev, [key]: !prev[key] }));

    const [confirmDeleteConditionId, setConfirmDeleteConditionId] = useState<number | null>(null);
    const [confirmDeleteAllergyId, setConfirmDeleteAllergyId] = useState<number | null>(null);

    const [conditionForm, setConditionForm] = useState({ name: '', icd_code: '', status: 'active', onset_date: '', notes: '', visible_to_patient: false });
    const [editingConditionId, setEditingConditionId] = useState<number | null>(null);
    const [allergyForm, setAllergyForm] = useState({ allergen: '', reaction_type: 'drug', severity: 'moderate', reaction_description: '', is_active: true, visible_to_patient: true });
    const [formLoading, setFormLoading] = useState(false);
    const [allergenSuggestions, setAllergenSuggestions] = useState<string[]>([]);
    const [showAllergenSuggestions, setShowAllergenSuggestions] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [statusTransitionReasonCode, setStatusTransitionReasonCode] = useState('');
    const [statusTransitionDeathDate, setStatusTransitionDeathDate] = useState('');
    const [statusTransitionDestination, setStatusTransitionDestination] = useState('');
    const [voidReason, setVoidReason] = useState('');
    const [vitalAcknowledging, setVitalAcknowledging] = useState(false);
    const [dismissedVitalAlerts, setDismissedVitalAlerts] = useState<Set<number>>(new Set());

    const [labSubTab, setLabSubTab] = useState<'orders' | 'results'>('results');
    const [showLabForm, setShowLabForm] = useState(false);
    const [editingLabId, setEditingLabId] = useState<number | null>(null);
    const [labForm, setLabForm] = useState({ test_name: '', test_date: '', result_value: '', unit: '', reference_range: '', status: 'pending', notes: '' });
    const [labFormLoading, setLabFormLoading] = useState(false);
    const [confirmDeleteLabId, setConfirmDeleteLabId] = useState<number | null>(null);

    const [showLabOrderForm, setShowLabOrderForm] = useState(false);
    const [labOrderForm, setLabOrderForm] = useState({ test_name: '', order_date: '', priority: 'routine', notes: '' });
    const [labOrderFormLoading, setLabOrderFormLoading] = useState(false);

    const { data: vitalsTrend = [], isLoading: vitalsLoading } = useQuery<VitalsPoint[]>({
        queryKey: ['patients', id, 'vitals'],
        queryFn: async () => {
            const res = await api.get(`/patients/${id}/vitals-trend/`);
            return res.data.vitals || [];
        },
        enabled: loadedTabs.has('consultations'),
        staleTime: 2 * 60 * 1000,
    });

    const { data: labResults = [], isLoading: labsLoading } = useQuery<LabResult[]>({
        queryKey: ['patients', id, 'labs'],
        queryFn: async () => {
            const res = await api.get('/lab-results/', { params: { patient: id } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('labs'),
        staleTime: 2 * 60 * 1000,
    });

    const { data: labOrders = [], isLoading: labOrdersLoading } = useQuery<any[]>({
        queryKey: ['patients', id, 'lab-orders'],
        queryFn: async () => {
            const res = await api.get('/lab-orders/', { params: { patient: id } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('labs'),
        staleTime: 2 * 60 * 1000,
    });

    const { data: clinicalAlerts = [], isLoading: alertsLoading } = useQuery<any[]>({
        queryKey: ['patients', id, 'clinical-alerts'],
        queryFn: async () => {
            const res = await api.get('/clinical-alerts/', { params: { patient: id, open: 'true' } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('overview'),
        staleTime: 60 * 1000,
    });

    const { data: medications = [], isLoading: medicationsLoading } = useQuery<Prescription[]>({
        queryKey: ['patients', id, 'medications'],
        queryFn: async () => {
            const res = await api.get('/prescriptions/', { params: { patient: id, active: true } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('medications'),
        staleTime: 2 * 60 * 1000,
    });

    const { data: allMedications = [], isLoading: allMedsLoading } = useQuery<Prescription[]>({
        queryKey: ['patients', id, 'medications', 'all'],
        queryFn: async () => {
            const res = await api.get('/prescriptions/', { params: { patient: id } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('medications') && showAllMeds,
        staleTime: 2 * 60 * 1000,
    });
    const displayedMeds = showAllMeds ? allMedications : medications;
    const medsLoading = showAllMeds ? allMedsLoading : medicationsLoading;

    const { data: patientAppointments = [], isLoading: appointmentsLoading } = useQuery<Array<{
        id: number;
        appointment_date: string;
        status: string;
        status_display?: string;
        reason_for_appointment: string;
        appointment_type?: string;
        rescheduled_from_date?: string | null;
        cancellation_reason?: string;
    }>>({
        queryKey: ['patients', id, 'appointments'],
        queryFn: async () => {
            const res = await api.get('/appointments/', { params: { patient_id: id } });
            return res.data.results ?? res.data;
        },
        enabled: !!id,
        staleTime: 2 * 60 * 1000,
    });

    const { data: consultationsData = [], isLoading: consultationsLoading } = useQuery<Consultation[]>({
        queryKey: ['patients', id, 'consultations'],
        queryFn: async () => {
            const res = await api.get(`/consultations/`, { params: { patient: id, ordering: '-consultation_date' } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('consultations'),
        staleTime: 2 * 60 * 1000,
    });

    const { data: proceduresData = [], isLoading: proceduresLoading } = useQuery<MedicalProcedure[]>({
        queryKey: ['patients', id, 'procedures'],
        queryFn: async () => {
            const res = await api.get(`/medical-procedures/`, { params: { patient: id } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('medical_act'),
        staleTime: 2 * 60 * 1000,
    });

    const { data: referralsData = [], isLoading: referralsLoading } = useQuery<Referral[]>({
        queryKey: ['patients', id, 'referrals'],
        queryFn: async () => {
            const res = await api.get(`/referrals/`, { params: { patient: id } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('medical_act'),
        staleTime: 2 * 60 * 1000,
    });

    const [portalInviteEmail, setPortalInviteEmail] = useState('');
    const [portalInviteSending, setPortalInviteSending] = useState(false);
    const [portalSettingsSaving, setPortalSettingsSaving] = useState(false);
    const [sharingPreview, setSharingPreview] = useState<{ total_hidden: number; hidden_counts: Record<string, number> } | null>(null);
    const [applyingDefaults, setApplyingDefaults] = useState(false);
    const [shareConsultationId, setShareConsultationId] = useState<number | null>(null);
    const [shareConsultationSummary, setShareConsultationSummary] = useState('');
    const [shareLabId, setShareLabId] = useState<number | null>(null);
    const [shareLabNote, setShareLabNote] = useState('');
    const [previewLabId, setPreviewLabId] = useState<number | null>(null);
    const [reconcileRx, setReconcileRx] = useState<SavedRx[] | null>(null);
    const [reconcileCheckedNew, setReconcileCheckedNew] = useState<Set<number>>(new Set());
    const [reconcileCheckedCurrent, setReconcileCheckedCurrent] = useState<Set<number>>(new Set());
    const [reconcileLoading, setReconcileLoading] = useState(false);
    const reconcilePreCheckedRef = useRef(false);
    const [reviewLabId, setReviewLabId] = useState<number | null>(null);
    const [reviewAction, setReviewAction] = useState<'accept' | 'reject'>('accept');
    const [reviewRejectionReason, setReviewRejectionReason] = useState('');
    const [reviewLabLoading, setReviewLabLoading] = useState(false);
    const [rejectRequestId, setRejectRequestId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [approveInstructions, setApproveInstructions] = useState<Record<number, string>>({});
    const [requestActionLoading, setRequestActionLoading] = useState(false);

    const { data: portalStatus, isLoading: portalLoading, refetch: refetchPortalStatus } = useQuery({
        queryKey: ['patients', id, 'portalStatus'],
        queryFn: async () => {
            const res = await api.get(`/patients/${id}/portal/status/`);
            return res.data as {
                portal_enabled: boolean;
                allow_self_claim: boolean;
                claim_status: 'unclaimed' | 'invited' | 'claimed' | 'locked';
                invited_at: string | null;
                claimed_at: string | null;
                primary_contact_email: string | null;
            };
        },
        enabled: loadedTabs.has('portal') && !!id,
        staleTime: 60_000,
    });

    const { data: pendingRequests = [], isLoading: pendingRequestsLoading, refetch: refetchPendingRequests } = useQuery({
        queryKey: ['patients', id, 'pendingRequests'],
        queryFn: async () => {
            type PendingReq = { id: number; patient_name: string; patient_id: string; appointment_date: string; appointment_type: 'in_person' | 'telemedicine'; reason: string; notes: string };
            const res = await api.get('/doctor/appointment-requests/', { params: { patient: id } });
            const raw: PendingReq[] = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
            return raw.filter(r => r.patient_id === id);
        },
        enabled: !!id,
        staleTime: 60_000,
    });

    const handlePortalInvite = async () => {
        if (!id || !portalInviteEmail.trim()) return;
        setPortalInviteSending(true);
        try {
            await api.post(`/patients/${id}/portal/invite/`, { email: portalInviteEmail.trim() });
            toast.success(`Portal invitation sent to ${portalInviteEmail.trim()}.`);
            setPortalInviteEmail('');
            refetchPortalStatus();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to send invitation.'));
        } finally {
            setPortalInviteSending(false);
        }
    };

    const handlePortalSettingToggle = async (field: string, currentValue: boolean) => {
        if (!id) return;
        setPortalSettingsSaving(true);
        try {
            await api.patch(`/patients/${id}/portal/settings/`, { [field]: !currentValue });
            refetchPortalStatus();
            setSharingPreview(null);
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to update portal settings.'));
        } finally {
            setPortalSettingsSaving(false);
        }
    };

    const checkSharingDefaults = async () => {
        if (!id) return;
        try {
            const res = await api.post(`/patients/${id}/portal/apply-sharing-defaults/`);
            setSharingPreview(res.data);
        } catch { /* ignore */ }
    };

    const applyAllSharingDefaults = async () => {
        if (!id) return;
        setApplyingDefaults(true);
        try {
            await api.post(`/patients/${id}/portal/apply-sharing-defaults/`, { confirm: true });
            toast.success('Sharing defaults applied to existing records.');
            setSharingPreview(null);
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to apply sharing defaults.'));
        } finally {
            setApplyingDefaults(false);
        }
    };

    const handleShareConsultation = async () => {
        if (!shareConsultationId) return;
        try {
            await api.post(`/consultations/${shareConsultationId}/share-with-patient/`, {
                patient_summary: shareConsultationSummary,
            });
            toast.success('Consultation shared with patient.');
            setShareConsultationId(null);
            setShareConsultationSummary('');
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'consultations'] });
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to share consultation.'));
        }
    };

    const handleHideConsultation = async (consultationId: number) => {
        try {
            await api.post(`/consultations/${consultationId}/hide-from-patient/`, {});
            toast.success('Consultation hidden from patient portal.');
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'consultations'] });
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to hide consultation.'));
        }
    };

    const handleShowConsultation = async (consultationId: number) => {
        try {
            await api.post(`/consultations/${consultationId}/share-with-patient/`, {});
            toast.success('Consultation visible to patient.');
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'consultations'] });
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to update visibility.'));
        }
    };

    const handleSignConsultation = async (consultationId: number) => {
        try {
            await api.post(`/consultations/${consultationId}/sign/`, {});
            toast.success('Consultation signed.');
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'consultations'] });
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to sign consultation.'));
        }
    };

    const handleReleaseLabResult = async () => {
        if (!shareLabId) return;
        try {
            await api.post(`/lab-results/${shareLabId}/release-to-patient/`, {
                patient_note: shareLabNote,
            });
            toast.success('Lab result released to patient.');
            setShareLabId(null);
            setShareLabNote('');
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'labs'] });
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to release lab result.'));
        }
    };

    const handleReviewLab = async () => {
        if (!reviewLabId) return;
        setReviewLabLoading(true);
        try {
            await api.post(`/lab-results/${reviewLabId}/review/`, {
                action: reviewAction,
                ...(reviewAction === 'reject' && { rejection_reason: reviewRejectionReason }),
            });
            toast.success(reviewAction === 'accept' ? 'Lab document accepted.' : 'Lab document rejected.');
            setReviewLabId(null);
            setReviewRejectionReason('');
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'labs'] });
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to review lab document.'));
        } finally {
            setReviewLabLoading(false);
        }
    };

    const handleApproveRequest = async (apptId: number) => {
        setRequestActionLoading(true);
        try {
            const instructions = approveInstructions[apptId] || '';
            await api.post(`/appointments/${apptId}/approve/`, { portal_instructions: instructions });
            toast.success('Appointment request approved.');
            setApproveInstructions(prev => { const n = { ...prev }; delete n[apptId]; return n; });
            refetchPendingRequests();
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'appointments'] });
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to approve request.'));
        } finally {
            setRequestActionLoading(false);
        }
    };

    const handleRejectRequest = async (apptId: number, reason: string) => {
        setRequestActionLoading(true);
        try {
            await api.post(`/appointments/${apptId}/reject/`, { reason });
            toast.success('Appointment request declined.');
            setRejectRequestId(null);
            setRejectReason('');
            refetchPendingRequests();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to reject request.'));
        } finally {
            setRequestActionLoading(false);
        }
    };

    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const [quickNote, setQuickNote] = useState('');
    const [quickNoteSaving, setQuickNoteSaving] = useState(false);
    const [quickNoteLoaded, setQuickNoteLoaded] = useState(false);

    useEffect(() => {
        if (id && isAuthenticated) {
            fetchPatientDetails();
            fetchQuickNote();
        } else if (!isAuthenticated) {
            navigate('/login');
        }
    }, [id, isAuthenticated]);

    useEffect(() => {
        if (reconcileRx !== null && medications.length > 0 && !reconcilePreCheckedRef.current) {
            reconcilePreCheckedRef.current = true;
            setReconcileCheckedCurrent(new Set(medications.map(rx => rx.id)));
        }
    }, [medications, reconcileRx]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    const fetchPatientDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/patients/${id}/`);
            setPatient(response.data);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number } };
            if (axiosErr.response?.status === 401) {
                logout();
                navigate('/login');
            } else if (axiosErr.response?.status === 404) {
                navigate('/patients');
            } else {
                setError(t('patient_detail.error.load'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSuccess = (savedRx?: SavedRx[]) => {
        setShowConsultationForm(false);
        setShowProcedureForm(false);
        setShowReferralForm(false);
        setShowConditionForm(false);
        setShowAllergyForm(false);
        setConsultationToEdit(null);
        setConsultationFormIsDraft(false);
        setViewingConsultation(null);
        setProcedureToEdit(null);
        setReferralToEdit(null);
        fetchPatientDetails();
        queryClient.invalidateQueries({ queryKey: ['patients', id, 'consultations'] });
        queryClient.invalidateQueries({ queryKey: ['patients', id, 'procedures'] });
        queryClient.invalidateQueries({ queryKey: ['patients', id, 'referrals'] });

        if (savedRx !== undefined) {
            reconcilePreCheckedRef.current = false;
            setReconcileCheckedNew(new Set(savedRx.map(rx => rx.id)));
            setReconcileCheckedCurrent(new Set());
            setReconcileRx(savedRx);
            setLoadedTabs(prev => new Set([...prev, 'medications']));
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'medications'] });
        }
    };

    const handleCancel = () => {
        setShowConsultationForm(false);
        setShowProcedureForm(false);
        setShowReferralForm(false);
        setShowConditionForm(false);
        setShowAllergyForm(false);
        setConsultationToEdit(null);
        setConsultationFormIsDraft(false);
        setViewingConsultation(null);
        setProcedureToEdit(null);
        setReferralToEdit(null);
    };

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        setLoadedTabs(prev => new Set([...prev, tab]));
        const el = tabRefs.current[tab];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    };

    const navigateToConsultation = (consultId: number) => {
        pendingScrollConsultIdRef.current = consultId;
        setExpandedConsultIds(prev => new Set([...prev, consultId]));
        handleTabChange('consultations');
    };

    useEffect(() => {
        const tabParam = searchParams.get('tab') as Tab | null;
        const openConsultId = searchParams.get('open_consultation');

        const validTabs: Tab[] = ['overview', 'consultations', 'labs', 'medications', 'medical_act', 'history', 'portal'];
        if (tabParam && validTabs.includes(tabParam)) {
            handleTabChange(tabParam);
        }

        if (openConsultId && openConsultHandledRef.current !== openConsultId) {
            openConsultHandledRef.current = openConsultId;
            const isDraftParam = searchParams.get('draft') === 'true';
            handleTabChange('consultations');
            api.get(`/consultations/${openConsultId}/`).then(res => {
                const data = res.data;
                if (data.consultation_status === 'signed') {
                    setViewingConsultation(data);
                } else {
                    setConsultationToEdit(data);
                    setConsultationFormIsDraft(isDraftParam);
                    setShowConsultationForm(true);
                }
            }).catch(() => {
                // Tab already switched — consultation may no longer be accessible
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const anyFormOpen = showConsultationForm || showProcedureForm || showReferralForm || !!viewingConsultation;
    useKeyboardShortcut({
        key: 'n',
        modifiers: ['ctrl'],
        enabled: !anyFormOpen && patient?.status === 'active',
        onKeyDown: () => { setConsultationToEdit(null); setShowConsultationForm(true); handleTabChange('consultations'); },
    });
    useKeyboardShortcut({
        key: 'Escape',
        enabled: anyFormOpen,
        onKeyDown: handleCancel,
    });

    useEffect(() => {
        setQuickNote('');
        setQuickNoteLoaded(false);
        setLoadedTabs(new Set(['overview']));
    }, [id]);

    useEffect(() => {
        const targetId = pendingScrollConsultIdRef.current;
        if (!targetId || activeTab !== 'consultations' || consultationsData.length === 0) return;
        const el = document.getElementById(`consult-entry-${targetId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            pendingScrollConsultIdRef.current = null;
        }
    }, [activeTab, consultationsData]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchQuickNote = async () => {
        if (!id) return;
        try {
            const res = await api.get(`/patients/${id}/quick-note/`);
            setQuickNote(res.data.content || '');
            setQuickNoteLoaded(true);
        } catch {
            setQuickNoteLoaded(true);
        }
    };

    const saveQuickNote = async () => {
        if (!id) return;
        setQuickNoteSaving(true);
        try {
            await api.put(`/patients/${id}/quick-note/`, { content: quickNote });
            toast.success('Quick note saved.');
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to save note.'));
        } finally {
            setQuickNoteSaving(false);
        }
    };

    const handleLabSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLabFormLoading(true);
        try {
            if (editingLabId) {
                await api.put(`/lab-results/${editingLabId}/`, { ...labForm, patient: id });
                toast.success('Lab result updated.');
            } else {
                await api.post('/lab-results/', { ...labForm, patient: id });
                toast.success('Lab result added.');
            }
            setShowLabForm(false);
            setEditingLabId(null);
            setLabForm({ test_name: '', test_date: '', result_value: '', unit: '', reference_range: '', status: 'pending', notes: '' });
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'labs'] });
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to save lab result.'));
        } finally {
            setLabFormLoading(false);
        }
    };

    const handleLabOrderSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLabOrderFormLoading(true);
        try {
            await api.post('/lab-orders/', { ...labOrderForm, patient: id });
            toast.success('Lab order added.');
            setShowLabOrderForm(false);
            setLabOrderForm({ test_name: '', order_date: '', priority: 'routine', notes: '' });
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'lab-orders'] });
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to save lab order.'));
        } finally {
            setLabOrderFormLoading(false);
        }
    };

    const handleCancelLabOrder = async (orderId: number) => {
        try {
            await api.post(`/lab-orders/${orderId}/cancel/`);
            toast.success('Lab order cancelled.');
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'lab-orders'] });
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to cancel lab order.'));
        }
    };

    const handleDeleteLab = async (labId: number) => {
        try {
            await api.post(`/lab-results/${labId}/void/`, { void_reason: 'Deleted by doctor' });
            toast.success('Lab result voided.');
            setConfirmDeleteLabId(null);
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'labs'] });
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to void lab result.'));
            setConfirmDeleteLabId(null);
        }
    };

    const [stopRxId, setStopRxId] = useState<number | null>(null);
    const [stopRxReason, setStopRxReason] = useState('');
    const [stopRxCode, setStopRxCode] = useState('other');
    const [stopRxLoading, setStopRxLoading] = useState(false);

    const handleStopPrescription = async () => {
        if (!stopRxId) return;
        if (!stopRxReason.trim()) { toast.error('Please provide a stop reason.'); return; }
        setStopRxLoading(true);
        try {
            await api.post(`/prescriptions/${stopRxId}/stop/`, {
                stop_reason_text: stopRxReason,
                stop_reason_code: stopRxCode,
            });
            toast.success('Prescription stopped.');
            setStopRxId(null);
            setStopRxReason('');
            setStopRxCode('other');
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'medications'] });
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to stop prescription.'));
        } finally {
            setStopRxLoading(false);
        }
    };

    const handleAcknowledgeAlert = async (alertId: number) => {
        try {
            await api.post(`/clinical-alerts/${alertId}/acknowledge/`, {});
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'clinical-alerts'] });
            toast.success('Alert acknowledged.');
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to acknowledge alert.'));
        }
    };

    const handleStatusSelect = (newStatus: string) => {
        if (!patient || newStatus === patient.status) return;
        setStatusTransitionReasonCode('');
        setStatusTransitionDeathDate('');
        setStatusTransitionDestination('');
        setPendingStatus(newStatus);
    };

    const executeStatusChange = async () => {
        if (!patient || !pendingStatus) return;
        if (!statusTransitionReasonCode.trim()) {
            toast.error('Please select a reason for this status change.');
            return;
        }
        const targetStatus = pendingStatus;
        setPendingStatus(null);
        setStatusUpdating(true);
        try {
            await api.post(`/patients/${patient.unique_id}/status-transitions/`, {
                to_status: targetStatus,
                reason_code: statusTransitionReasonCode,
                ...(statusTransitionDeathDate ? { death_date: statusTransitionDeathDate } : {}),
                ...(statusTransitionDestination ? { destination_facility: statusTransitionDestination } : {}),
            });
            setPatient(prev => prev ? { ...prev, status: targetStatus as PatientWithHistory['status'] } : null);
            toast.success(`Patient status updated to ${targetStatus}.`);
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to update patient status.'));
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleDeleteConsultation = async (consultationId: number) => {
        try {
            await api.post(`/consultations/${consultationId}/void/`, {
                void_reason: voidReason.trim() || 'Voided by doctor',
            });
            setConfirmDeleteConsultationId(null);
            setVoidReason('');
            toast.success('Consultation voided.');
            fetchPatientDetails();
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'consultations'] });
        } catch (err) {
            toast.error(parseApiError(err, t('patient_detail.error.delete_general')));
        }
    };

    const handleDeleteProcedure = async (procedureId: number) => {
        try {
            await api.post(`/medical-procedures/${procedureId}/void/`, {
                void_reason: voidReason.trim() || 'Voided by doctor',
            });
            setConfirmDeleteProcedureId(null);
            setVoidReason('');
            toast.success('Procedure voided.');
            fetchPatientDetails();
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'procedures'] });
        } catch (err) {
            toast.error(parseApiError(err, t('patient_detail.error.delete_general')));
        }
    };

    const handleDeleteReferral = async (referralId: number) => {
        try {
            await api.delete(`/referrals/${referralId}/`);
            setConfirmDeleteReferralId(null);
            toast.success('Referral deleted.');
            fetchPatientDetails();
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'referrals'] });
        } catch (err) {
            toast.error(parseApiError(err, t('patient_detail.error.delete_general')));
        }
    };

    const handleDeleteCondition = async (conditionId: number) => {
        try {
            await api.post(`/conditions/${conditionId}/void/`, {
                void_reason: voidReason.trim() || 'Voided by doctor',
            });
            setConfirmDeleteConditionId(null);
            setVoidReason('');
            toast.success('Condition voided.');
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to void condition.'));
        }
    };

    const handleDeleteAllergy = async (allergyId: number) => {
        try {
            await api.post(`/allergies/${allergyId}/void/`, {
                void_reason: voidReason.trim() || 'Voided by doctor',
            });
            setConfirmDeleteAllergyId(null);
            setVoidReason('');
            toast.success('Allergy voided.');
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to void allergy.'));
        }
    };

    const handleToggleAllergy = async (allergyId: number, currentActive: boolean) => {
        try {
            await api.patch(`/allergies/${allergyId}/`, { is_active: !currentActive });
            toast.success(currentActive ? 'Allergy deactivated.' : 'Allergy activated.');
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to update allergy.'));
        }
    };

    const handleMarkPrescriptionInactive = (rxId: number) => {
        setStopRxId(rxId);
        setStopRxReason('');
        setStopRxCode('other');
    };

    const handleMarkPrescriptionActive = async (rxId: number) => {
        try {
            await api.post(`/prescriptions/${rxId}/reactivate/`, { reactivation_reason: 'Reactivated by doctor' });
            toast.success('Prescription reactivated.');
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'medications'] });
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'medications', 'all'] });
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to reactivate.'));
        }
    };

    const handleToggleVisibleToPatient = async (
        resource: 'conditions' | 'allergies' | 'prescriptions',
        itemId: number,
        current: boolean,
    ) => {
        try {
            await api.patch(`/${resource}/${itemId}/`, { visible_to_patient: !current });
            toast.success(!current ? 'Now visible to patient.' : 'Hidden from patient.');
            if (resource === 'prescriptions') {
                queryClient.invalidateQueries({ queryKey: ['patients', id, 'medications'] });
            } else {
                fetchPatientDetails();
            }
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to update visibility.'));
        }
    };

    const handleConditionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            if (editingConditionId) {
                await api.patch(`/conditions/${editingConditionId}/`, conditionForm);
                setEditingConditionId(null);
                toast.success('Condition updated.');
            } else {
                await api.post('/conditions/', { ...conditionForm, patient: id });
                setShowConditionForm(false);
                toast.success('Condition added.');
            }
            setConditionForm({ name: '', icd_code: '', status: 'active', onset_date: '', notes: '', visible_to_patient: false });
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to save condition.'));
        } finally {
            setFormLoading(false);
        }
    };

    const handleAllergySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            await api.post('/allergies/', { ...allergyForm, patient: id });
            setShowAllergyForm(false);
            setAllergyForm({ allergen: '', reaction_type: 'drug', severity: 'moderate', reaction_description: '', is_active: true, visible_to_patient: true });
            toast.success('Allergy added.');
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to save allergy.'));
        } finally {
            setFormLoading(false);
        }
    };

    const handleExportPdf = async () => {
        if (!patient) return;
        try {
            const response = await api.get(`/patients/${patient.unique_id}/export-pdf/`, { responseType: 'blob' });
            const url = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${patient.first_name}_${patient.last_name}_${new Date().toISOString().slice(0, 10)}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to export PDF.');
        }
    };

    const downloadFile = async (attachmentUrl: string | null | undefined, attachmentName?: string) => {
        if (!attachmentUrl) return;
        const fileNameToUse = attachmentName || 'attachment';
        try {
            const response = await api.get(attachmentUrl, { responseType: 'blob' });
            const blob = new Blob([response.data]);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.setAttribute('download', fileNameToUse);
            document.body.appendChild(link); link.click();
            window.URL.revokeObjectURL(url); document.body.removeChild(link);
        } catch { /* silent */ }
    };

    if (loading) return <PageLoader message={t('patient_detail.loading')} />;
    if (error) return <div className="error-message">Error: {error}</div>;
    if (!patient) return <div className="no-data-message">{t('patient_detail.error.load')}</div>;

    const canWrite = patient.status === 'active';

    const activeAllergies = patient.allergy_records?.filter(a => a.is_active) || [];
    const lifeThreateningAllergies = activeAllergies.filter(a => a.severity === 'life_threatening');
    const severeAllergies = activeAllergies.filter(a => a.severity === 'severe');
    const hasAllergyAlert = lifeThreateningAllergies.length > 0 || severeAllergies.length > 0;

    const historyCount = (patient.conditions?.length || 0) + (patient.allergy_records?.length || 0) || undefined;
    const medicalActCount = (patient.medical_procedures?.length || 0) + (patient.referrals?.length || 0) || undefined;
    const draftCount = (patient.consultations || []).filter((c: any) =>
        c.consultation_status === 'draft' || c.consultation_status === 'in_progress'
    ).length;
    const pendingLabOrderCount = labOrders.filter(
        o => o.order_status !== 'cancelled' && o.order_status !== 'resulted'
    ).length;

    const TABS: { key: Tab; label: string; count?: number }[] = [
        { key: 'overview',      label: t('patient_detail.tabs.overview', 'Overview') },
        { key: 'consultations', label: t('patient_detail.tabs.consultations', 'Consultations'), count: draftCount || undefined },
        { key: 'labs',          label: t('patient_detail.tabs.labs', 'Labs'),                    count: pendingLabOrderCount || undefined },
        { key: 'medications',   label: t('patient_detail.tabs.medications', 'Medications'),     count: medications.length || undefined },
        { key: 'medical_act',   label: t('patient_detail.tabs.medical_act', 'Medical Act'),    count: medicalActCount },
        { key: 'history',       label: t('patient_detail.tabs.history', 'History'),             count: historyCount },
        { key: 'portal',        label: t('patient_detail.tabs.portal', 'Portal'),                count: pendingRequests.length || undefined },
    ];

    return (
        <>
        <PageHeader
            title={`${patient.first_name} ${patient.last_name}`}
            breadcrumb={[{ label: t('nav.patients', 'Patients'), href: '/patients' }]}
        />
        <div className="patient-details-container detail-container">
            {/* Header */}
            <div className="patient-header-card">
                <div className="patient-header-identity">
                    <Avatar name={`${patient.first_name} ${patient.last_name}`} size="lg" ring />
                    <div className="patient-header-info">
                        <h2 className="patient-name">{patient.first_name} {patient.last_name}</h2>
                        <div className="patient-meta">
                            {patient.date_of_birth && <span className="meta-chip">{patient.age} yrs</span>}
                            {patient.blood_group && <span className="meta-chip meta-chip--blood">{patient.blood_group}</span>}
                            <select
                                className={`patient-status-select status-${patient.status}`}
                                value={patient.status || 'active'}
                                onChange={e => handleStatusSelect(e.target.value)}
                                disabled={statusUpdating}
                                title="Change patient status"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="transferred">Transferred</option>
                                <option value="deceased">Deceased</option>
                            </select>
                        </div>
                    </div>
                </div>
                {patient.status === 'inactive' && (
                    <div className="patient-status-banner patient-status-banner--inactive">
                        <span className="patient-status-banner__icon">⚠</span>
                        <span>Patient is <strong>inactive</strong> — reactivate to add new clinical records.</span>
                    </div>
                )}
                {patient.status === 'transferred' && (
                    <div className="patient-status-banner patient-status-banner--transferred">
                        <span className="patient-status-banner__icon">↗</span>
                        <span>Patient has been <strong>transferred</strong> — this record is read-only.</span>
                    </div>
                )}
                {patient.status === 'deceased' && (
                    <div className="patient-status-banner patient-status-banner--deceased">
                        <span className="patient-status-banner__icon">✦</span>
                        <span>Patient is <strong>deceased</strong> — this record is read-only.</span>
                    </div>
                )}
                <div className="patient-action-strip">
                    <button
                        onClick={() => { if (canWrite) { setShowConsultationForm(true); setConsultationToEdit(null); handleTabChange('consultations'); } }}
                        className={`strip-btn strip-btn--primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                        disabled={!canWrite}
                        title={!canWrite ? 'Clinical records are locked for this patient' : undefined}
                    >
                        + Consultation
                    </button>
                    <button
                        onClick={() => { if (canWrite) { setShowReferralForm(true); setReferralToEdit(null); handleTabChange('history'); } }}
                        className={`strip-btn${!canWrite ? ' strip-btn--disabled' : ''}`}
                        disabled={!canWrite}
                        title={!canWrite ? 'Clinical records are locked for this patient' : undefined}
                    >
                        + Referral
                    </button>
                    <button
                        onClick={() => { if (canWrite) { setShowConditionForm(true); handleTabChange('history'); } }}
                        className={`strip-btn${!canWrite ? ' strip-btn--disabled' : ''}`}
                        disabled={!canWrite}
                        title={!canWrite ? 'Clinical records are locked for this patient' : undefined}
                    >
                        + Condition
                    </button>
                    <button onClick={handleExportPdf} className="strip-btn">
                        PDF
                    </button>
                    <div className="strip-dropdown" ref={dropdownRef}>
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="strip-btn"
                            aria-label="More actions"
                            aria-expanded={showDropdown}
                            aria-haspopup="menu"
                        >
                            More ▾
                        </button>
                        {showDropdown && (
                            <ul className="dropdown-menu">
                                {(profile?.access_level ?? 1) >= 2 && (
                                    <li>
                                        <button
                                            onClick={() => { if (canWrite) { setShowProcedureForm(true); setProcedureToEdit(null); setShowDropdown(false); handleTabChange('history'); } }}
                                            className={`action-button dropdown-item${!canWrite ? ' dropdown-item--disabled' : ''}`}
                                            disabled={!canWrite}
                                        >
                                            + Add Procedure
                                        </button>
                                    </li>
                                )}
                                <li>
                                    <button
                                        onClick={() => { if (canWrite) { setShowAllergyForm(true); setShowDropdown(false); handleTabChange('history'); } }}
                                        className={`action-button dropdown-item${!canWrite ? ' dropdown-item--disabled' : ''}`}
                                        disabled={!canWrite}
                                    >
                                        + Add Allergy
                                    </button>
                                </li>
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Note */}
            <div className="quick-note-bar">
                <span className="quick-note-label">📌 My Note:</span>
                <input
                    type="text"
                    className="quick-note-input"
                    placeholder="Pinned note about this patient (only you can see this)..."
                    value={quickNoteLoaded ? quickNote : ''}
                    onChange={e => setQuickNote(e.target.value)}
                    onBlur={saveQuickNote}
                    disabled={!quickNoteLoaded || quickNoteSaving}
                    maxLength={300}
                />
            </div>

            {/* Allergy Alert Bar */}
            {hasAllergyAlert && (
                <div className="allergy-alert-bar">
                    <span className="allergy-alert-icon">⚠</span>
                    <strong>ALLERGY ALERT: </strong>
                    {lifeThreateningAllergies.map(a => <span key={a.id} className="allergy-chip life-threatening">{a.allergen} (LIFE-THREATENING)</span>)}
                    {severeAllergies.map(a => <span key={a.id} className="allergy-chip severe">{a.allergen} (Severe)</span>)}
                </div>
            )}

            {/* Form overlays */}
            {showConsultationForm && <ConsultationForm patientId={id!} onSuccess={handleSuccess} onCancel={handleCancel} consultationToEdit={consultationToEdit} isDraft={consultationFormIsDraft} />}
            {viewingConsultation && (
                <ConsultationView
                    consultation={viewingConsultation}
                    onClose={() => setViewingConsultation(null)}
                    onAmend={amended => {
                        setViewingConsultation(null);
                        setConsultationToEdit(amended);
                        setConsultationFormIsDraft(false);
                        setShowConsultationForm(true);
                    }}
                    onFollowUpDismissed={() => {
                        queryClient.invalidateQueries({ queryKey: ['patients', id, 'consultations'] });
                        setViewingConsultation(null);
                    }}
                />
            )}
            {showProcedureForm && <MedicalProcedureForm patientId={id!} onSuccess={handleSuccess} onCancel={handleCancel} procedureToEdit={procedureToEdit} />}
            {showReferralForm && <ReferralForm patientId={id!} onSuccess={handleSuccess} onClose={handleCancel} referralToEdit={referralToEdit ? { ...referralToEdit, comments: referralToEdit.comments ?? undefined } : null} />}

            {/* Tab bar */}
            <div className="patient-tabs" role="tablist" aria-label="Patient record sections">
                {TABS.map((tab, idx) => (
                    <button
                        key={tab.key}
                        ref={el => { tabRefs.current[tab.key] = el; }}
                        role="tab"
                        id={`tab-${tab.key}`}
                        aria-selected={activeTab === tab.key}
                        aria-controls={`panel-${tab.key}`}
                        tabIndex={activeTab === tab.key ? 0 : -1}
                        className={`patient-tab${activeTab === tab.key ? ' active' : ''}`}
                        onClick={() => handleTabChange(tab.key)}
                        onKeyDown={e => {
                            if (e.key === 'ArrowRight') {
                                const next = TABS[(idx + 1) % TABS.length];
                                handleTabChange(next.key);
                            } else if (e.key === 'ArrowLeft') {
                                const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
                                handleTabChange(prev.key);
                            }
                        }}
                    >
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && <span className="tab-count">{tab.count}</span>}
                    </button>
                ))}
            </div>

            <div
                className="patient-tab-content"
                role="tabpanel"
                id={`panel-${activeTab}`}
                aria-labelledby={`tab-${activeTab}`}
            >
                {activeTab === 'overview' && (
                    <OverviewTab
                        patient={patient}
                        id={id!}
                        medications={medications}
                        clinicalAlerts={clinicalAlerts}
                        alertsLoading={alertsLoading}
                        dismissedVitalAlerts={dismissedVitalAlerts}
                        setDismissedVitalAlerts={setDismissedVitalAlerts}
                        vitalAcknowledging={vitalAcknowledging}
                        setVitalAcknowledging={setVitalAcknowledging}
                        handleTabChange={tab => handleTabChange(tab as Tab)}
                        handleAcknowledgeAlert={handleAcknowledgeAlert}
                        setExpandedConsultIds={setExpandedConsultIds}
                        patientAppointments={patientAppointments}
                        appointmentsLoading={appointmentsLoading}
                    />
                )}
                {activeTab === 'consultations' && (
                    <ConsultationsTab
                        patient={patient}
                        id={id!}
                        consultationsData={consultationsData}
                        consultationsLoading={consultationsLoading}
                        vitalsTrend={vitalsTrend}
                        vitalsLoading={vitalsLoading}
                        consultView={consultView}
                        setConsultView={setConsultView}
                        expandedConsultIds={expandedConsultIds}
                        toggleConsult={toggleConsult}
                        canWrite={canWrite}
                        profile={profile}
                        visibleVitals={visibleVitals}
                        toggleVital={toggleVital}
                        setConsultationToEdit={setConsultationToEdit}
                        setShowConsultationForm={setShowConsultationForm}
                        setViewingConsultation={setViewingConsultation}
                        setConfirmDeleteConsultationId={setConfirmDeleteConsultationId}
                        setShareConsultationId={setShareConsultationId}
                        setShareConsultationSummary={setShareConsultationSummary}
                        handleSignConsultation={handleSignConsultation}
                        handleHideConsultation={handleHideConsultation}
                        handleShowConsultation={handleShowConsultation}
                    />
                )}
                {activeTab === 'labs' && (
                    <LabsTab
                        labResults={labResults}
                        labsLoading={labsLoading}
                        labOrders={labOrders}
                        labOrdersLoading={labOrdersLoading}
                        labSubTab={labSubTab}
                        setLabSubTab={setLabSubTab}
                        showUnreleasedOnly={showUnreleasedOnly}
                        setShowUnreleasedOnly={setShowUnreleasedOnly}
                        showLabForm={showLabForm}
                        setShowLabForm={setShowLabForm}
                        editingLabId={editingLabId}
                        setEditingLabId={setEditingLabId}
                        labForm={labForm}
                        setLabForm={setLabForm}
                        labFormLoading={labFormLoading}
                        handleLabSubmit={handleLabSubmit}
                        showLabOrderForm={showLabOrderForm}
                        setShowLabOrderForm={setShowLabOrderForm}
                        labOrderForm={labOrderForm}
                        setLabOrderForm={setLabOrderForm}
                        labOrderFormLoading={labOrderFormLoading}
                        handleLabOrderSubmit={handleLabOrderSubmit}
                        handleCancelLabOrder={handleCancelLabOrder}
                        canWrite={canWrite}
                        setConfirmDeleteLabId={setConfirmDeleteLabId}
                        setReviewLabId={setReviewLabId}
                        setReviewAction={setReviewAction}
                        setReviewRejectionReason={setReviewRejectionReason}
                        setShareLabId={setShareLabId}
                        setShareLabNote={setShareLabNote}
                        setPreviewLabId={setPreviewLabId}
                    />
                )}
                {activeTab === 'medications' && (
                    <MedicationsTab
                        medsLoading={medsLoading}
                        displayedMeds={displayedMeds}
                        showAllMeds={showAllMeds}
                        setShowAllMeds={setShowAllMeds}
                        handleToggleVisibleToPatient={handleToggleVisibleToPatient}
                        handleMarkPrescriptionInactive={handleMarkPrescriptionInactive}
                        handleMarkPrescriptionActive={handleMarkPrescriptionActive}
                        navigateToConsultation={navigateToConsultation}
                    />
                )}
                {activeTab === 'medical_act' && (
                    <MedicalActTab
                        patient={patient}
                        id={id!}
                        canWrite={canWrite}
                        profile={profile}
                        proceduresData={proceduresData}
                        proceduresLoading={proceduresLoading}
                        referralsData={referralsData}
                        referralsLoading={referralsLoading}
                        setConfirmDeleteProcedureId={setConfirmDeleteProcedureId}
                        setConfirmDeleteReferralId={setConfirmDeleteReferralId}
                        setProcedureToEdit={setProcedureToEdit}
                        setShowProcedureForm={setShowProcedureForm}
                        setReferralToEdit={setReferralToEdit}
                        setShowReferralForm={setShowReferralForm}
                        downloadFile={downloadFile}
                        resultFormReferralId={resultFormReferralId}
                        setResultFormReferralId={setResultFormReferralId}
                        resultText={resultText}
                        setResultText={setResultText}
                        resultSubmitting={resultSubmitting}
                        setResultSubmitting={setResultSubmitting}
                        cancelFormReferralId={cancelFormReferralId}
                        setCancelFormReferralId={setCancelFormReferralId}
                        cancelReason={cancelReason}
                        setCancelReason={setCancelReason}
                        cancelSubmitting={cancelSubmitting}
                        setCancelSubmitting={setCancelSubmitting}
                        recallFormReferralId={recallFormReferralId}
                        setRecallFormReferralId={setRecallFormReferralId}
                        recallReason={recallReason}
                        setRecallReason={setRecallReason}
                        recallSubmitting={recallSubmitting}
                        setRecallSubmitting={setRecallSubmitting}
                        openThreadReferralId={openThreadReferralId}
                        setOpenThreadReferralId={setOpenThreadReferralId}
                    />
                )}
                {activeTab === 'history' && (
                    <HistoryTab
                        patient={patient}
                        canWrite={canWrite}
                        showConditionForm={showConditionForm}
                        setShowConditionForm={setShowConditionForm}
                        showAllergyForm={showAllergyForm}
                        setShowAllergyForm={setShowAllergyForm}
                        conditionForm={conditionForm}
                        setConditionForm={setConditionForm}
                        editingConditionId={editingConditionId}
                        setEditingConditionId={setEditingConditionId}
                        allergyForm={allergyForm}
                        setAllergyForm={setAllergyForm}
                        allergenSuggestions={allergenSuggestions}
                        setAllergenSuggestions={setAllergenSuggestions}
                        showAllergenSuggestions={showAllergenSuggestions}
                        setShowAllergenSuggestions={setShowAllergenSuggestions}
                        formLoading={formLoading}
                        handleConditionSubmit={handleConditionSubmit}
                        handleAllergySubmit={handleAllergySubmit}
                        handleToggleAllergy={handleToggleAllergy}
                        handleToggleVisibleToPatient={handleToggleVisibleToPatient}
                        setConfirmDeleteConditionId={setConfirmDeleteConditionId}
                        setConfirmDeleteAllergyId={setConfirmDeleteAllergyId}
                    />
                )}
                {activeTab === 'portal' && (
                    <PortalTab
                        id={id!}
                        patientEmail={patient.email || undefined}
                        patientAppointments={patientAppointments}
                        appointmentsLoading={appointmentsLoading}
                        pendingRequests={pendingRequests}
                        pendingRequestsLoading={pendingRequestsLoading}
                        portalStatus={portalStatus}
                        portalLoading={portalLoading}
                        portalInviteEmail={portalInviteEmail}
                        setPortalInviteEmail={setPortalInviteEmail}
                        portalInviteSending={portalInviteSending}
                        portalSettingsSaving={portalSettingsSaving}
                        sharingPreview={sharingPreview}
                        applyingDefaults={applyingDefaults}
                        approveInstructions={approveInstructions}
                        setApproveInstructions={setApproveInstructions}
                        requestActionLoading={requestActionLoading}
                        rejectRequestId={rejectRequestId}
                        setRejectRequestId={setRejectRequestId}
                        rejectReason={rejectReason}
                        setRejectReason={setRejectReason}
                        handlePortalInvite={handlePortalInvite}
                        handlePortalSettingToggle={handlePortalSettingToggle}
                        checkSharingDefaults={checkSharingDefaults}
                        applyAllSharingDefaults={applyAllSharingDefaults}
                        handleApproveRequest={handleApproveRequest}
                        handleRejectRequest={handleRejectRequest}
                    />
                )}
            </div>
        </div>

        {/* Void reason — shared across all void dialogs */}
        {(() => {
            const voidReasonInput = (
                <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                        Reason <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — defaults to "Voided by doctor")</span>
                    </label>
                    <textarea
                        rows={2}
                        value={voidReason}
                        onChange={e => setVoidReason(e.target.value)}
                        placeholder="Clinical reason for voiding this record…"
                        style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.875rem' }}
                    />
                </div>
            );
            return (
                <>
                <Dialog
                    open={confirmDeleteConsultationId !== null}
                    onClose={() => { setConfirmDeleteConsultationId(null); setVoidReason(''); }}
                    onConfirm={() => { if (confirmDeleteConsultationId !== null) handleDeleteConsultation(confirmDeleteConsultationId); }}
                    title="Void this consultation?"
                    message={<div><p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>This record will be soft-voided and hidden from the active view. It cannot be undone.</p>{voidReasonInput}</div>}
                    tone="danger"
                    confirmLabel="Void consultation"
                />
                <Dialog
                    open={confirmDeleteProcedureId !== null}
                    onClose={() => { setConfirmDeleteProcedureId(null); setVoidReason(''); }}
                    onConfirm={() => { if (confirmDeleteProcedureId !== null) handleDeleteProcedure(confirmDeleteProcedureId); }}
                    title="Void this procedure?"
                    message={<div><p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>This record will be soft-voided. It cannot be undone.</p>{voidReasonInput}</div>}
                    tone="danger"
                    confirmLabel="Void procedure"
                />
                <Dialog open={confirmDeleteReferralId !== null} onClose={() => setConfirmDeleteReferralId(null)} onConfirm={() => { if (confirmDeleteReferralId !== null) handleDeleteReferral(confirmDeleteReferralId); }} title={t('patient_detail.error.delete_referral')} tone="danger" />
                <Dialog
                    open={confirmDeleteConditionId !== null}
                    onClose={() => { setConfirmDeleteConditionId(null); setVoidReason(''); }}
                    onConfirm={() => { if (confirmDeleteConditionId !== null) handleDeleteCondition(confirmDeleteConditionId); }}
                    title="Void this condition?"
                    message={<div><p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>This record will be soft-voided. It cannot be undone.</p>{voidReasonInput}</div>}
                    tone="danger"
                    confirmLabel="Void condition"
                />
                <Dialog
                    open={confirmDeleteAllergyId !== null}
                    onClose={() => { setConfirmDeleteAllergyId(null); setVoidReason(''); }}
                    onConfirm={() => { if (confirmDeleteAllergyId !== null) handleDeleteAllergy(confirmDeleteAllergyId); }}
                    title="Void this allergy?"
                    message={<div><p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>This record will be soft-voided. It cannot be undone.</p>{voidReasonInput}</div>}
                    tone="danger"
                    confirmLabel="Void allergy"
                />
                <Dialog open={confirmDeleteLabId !== null} onClose={() => setConfirmDeleteLabId(null)} onConfirm={() => { if (confirmDeleteLabId !== null) handleDeleteLab(confirmDeleteLabId); }} title="Delete this lab result?" tone="danger" />
                </>
            );
        })()}

        {/* Share consultation modal */}
        <Modal
            open={shareConsultationId !== null}
            onClose={() => { setShareConsultationId(null); setShareConsultationSummary(''); }}
            title="Share consultation with patient"
            size="md"
            footer={
                <>
                    <button type="button" className="cancel-button" onClick={() => { setShareConsultationId(null); setShareConsultationSummary(''); }}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleShareConsultation}>Share</button>
                </>
            }
        >
            <div className="form">
                <div className="form-group">
                    <label>Patient-friendly summary</label>
                    <textarea
                        rows={4}
                        value={shareConsultationSummary}
                        onChange={e => setShareConsultationSummary(e.target.value)}
                        placeholder="Write a plain-language summary the patient can understand…"
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>This replaces clinical diagnosis with a patient-friendly explanation. The clinical notes remain private.</span>
                </div>
            </div>
        </Modal>

        {/* Release lab result modal */}
        <Modal
            open={shareLabId !== null}
            onClose={() => { setShareLabId(null); setShareLabNote(''); }}
            title="Release lab result to patient"
            size="md"
            footer={
                <>
                    <button type="button" className="cancel-button" onClick={() => { setShareLabId(null); setShareLabNote(''); }}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleReleaseLabResult}>Release</button>
                </>
            }
        >
            <div className="form">
                <div className="form-group">
                    <label>Patient note <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                    <textarea
                        rows={3}
                        value={shareLabNote}
                        onChange={e => setShareLabNote(e.target.value)}
                        placeholder="Add a plain-language explanation of the result for the patient…"
                    />
                </div>
            </div>
        </Modal>

        {/* Preview as patient modal */}
        {(() => {
            const previewLab = previewLabId !== null ? labResults.find(l => l.id === previewLabId) : null;
            return (
                <Modal
                    open={previewLabId !== null}
                    onClose={() => setPreviewLabId(null)}
                    title="Patient view — lab result"
                    size="md"
                    footer={
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPreviewLabId(null)}>Close</button>
                    }
                >
                    {previewLab && (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 0 }}>
                                This is exactly what the patient will see in their portal.
                                {!previewLab.visible_to_patient && (
                                    <span style={{ marginLeft: '0.5rem', fontWeight: 600, color: 'var(--color-warning-dark)' }}>
                                        Not yet released.
                                    </span>
                                )}
                            </p>
                            <div style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: 'var(--bg-base)', display: 'grid', gap: '0.6rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{previewLab.test_name}</div>
                                    <span style={{
                                        fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px',
                                        background: previewLab.status === 'normal' ? 'var(--color-success-light)' : previewLab.status === 'abnormal' ? 'var(--color-warning-light)' : previewLab.status === 'critical' ? 'var(--color-danger-light)' : 'var(--bg-subtle)',
                                        color: previewLab.status === 'normal' ? 'var(--color-success-dark)' : previewLab.status === 'abnormal' ? 'var(--color-warning-dark)' : previewLab.status === 'critical' ? 'var(--color-danger-dark)' : 'var(--text-muted)',
                                    }}>
                                        {previewLab.status_display || previewLab.status}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {formatDate(previewLab.test_date)}
                                </div>
                                {(previewLab.result_value || previewLab.result_value_text) && (
                                    <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                        <strong>Result: </strong>
                                        {previewLab.result_value_text || `${previewLab.result_value} ${previewLab.unit}`.trim()}
                                        {previewLab.reference_range && (
                                            <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                Ref: {previewLab.reference_range}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {previewLab.patient_note ? (
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-lighter)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        {previewLab.patient_note}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        No patient note added.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>
            );
        })()}

        {/* Review lab document modal */}
        <Modal
            open={reviewLabId !== null}
            onClose={() => { setReviewLabId(null); setReviewRejectionReason(''); }}
            title="Review lab document"
            size="md"
            footer={
                <>
                    <button type="button" className="cancel-button" onClick={() => { setReviewLabId(null); setReviewRejectionReason(''); }}>Cancel</button>
                    <button
                        type="button"
                        className={reviewAction === 'reject' ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
                        onClick={handleReviewLab}
                        disabled={reviewLabLoading}
                    >
                        {reviewLabLoading ? 'Saving…' : (reviewAction === 'accept' ? 'Accept' : 'Reject')}
                    </button>
                </>
            }
        >
            <div className="form">
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Review the patient's uploaded document. Accept to confirm it's valid, or reject with a reason the patient will see.
                </p>
                <div className="form-group">
                    <label>Decision</label>
                    <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.25rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="radio" value="accept" checked={reviewAction === 'accept'} onChange={() => setReviewAction('accept')} />
                            Accept
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="radio" value="reject" checked={reviewAction === 'reject'} onChange={() => setReviewAction('reject')} />
                            Reject
                        </label>
                    </div>
                </div>
                {reviewAction === 'reject' && (
                    <div className="form-group" style={{ marginTop: '0.75rem' }}>
                        <label>Rejection reason <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(shown to patient)</span></label>
                        <textarea
                            rows={3}
                            value={reviewRejectionReason}
                            onChange={e => setReviewRejectionReason(e.target.value)}
                            placeholder="Explain why the document cannot be accepted…"
                        />
                    </div>
                )}
            </div>
        </Modal>

        {/* Status change modal */}
        <Modal
            open={pendingStatus !== null}
            onClose={() => { setPendingStatus(null); setStatusTransitionReasonCode(''); setStatusTransitionDeathDate(''); setStatusTransitionDestination(''); }}
            title={`Change patient status to ${pendingStatus ?? ''}?`}
            size="sm"
            footer={
                <>
                    <button type="button" className="cancel-button" onClick={() => { setPendingStatus(null); setStatusTransitionReasonCode(''); setStatusTransitionDeathDate(''); setStatusTransitionDestination(''); }}>Cancel</button>
                    <button type="button" className="btn btn-danger" disabled={statusUpdating} onClick={executeStatusChange}>
                        {statusUpdating ? 'Updating…' : `Mark ${pendingStatus ?? ''}`}
                    </button>
                </>
            }
        >
            <div style={{ display: 'grid', gap: '0.875rem' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {pendingStatus === 'deceased' && 'This will mark the patient as deceased. All active appointments will be cancelled.'}
                    {pendingStatus === 'transferred' && 'This will mark the patient as transferred. The record will become read-only.'}
                    {pendingStatus === 'inactive' && 'This will mark the patient as inactive. New clinical records cannot be added.'}
                    {pendingStatus === 'active' && 'This will reactivate the patient record.'}
                </p>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reason <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select
                        className="input"
                        value={statusTransitionReasonCode}
                        onChange={e => setStatusTransitionReasonCode(e.target.value)}
                    >
                        <option value="">Select reason…</option>
                        {pendingStatus === 'deceased' && <>
                            <option value="natural_causes">Natural causes</option>
                            <option value="accident">Accident / injury</option>
                            <option value="clinical_decision">Clinical decision / DNR</option>
                        </>}
                        {pendingStatus === 'transferred' && <>
                            <option value="specialist_referral">Specialist referral</option>
                            <option value="higher_level_care">Higher level of care required</option>
                            <option value="patient_preference">Patient preference</option>
                        </>}
                        {(pendingStatus === 'inactive' || pendingStatus === 'active') && <>
                            <option value="clinical_decision">Clinical decision</option>
                            <option value="patient_request">Patient request</option>
                            <option value="administrative">Administrative</option>
                        </>}
                        <option value="other">Other</option>
                    </select>
                </div>
                {pendingStatus === 'deceased' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Date of death <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                        <input
                            type="date"
                            className="input"
                            value={statusTransitionDeathDate}
                            max={new Date().toISOString().slice(0, 10)}
                            onChange={e => setStatusTransitionDeathDate(e.target.value)}
                        />
                    </div>
                )}
                {pendingStatus === 'transferred' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Destination facility <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                        <input
                            type="text"
                            className="input"
                            value={statusTransitionDestination}
                            onChange={e => setStatusTransitionDestination(e.target.value)}
                            placeholder="Hospital or clinic name…"
                        />
                    </div>
                )}
            </div>
        </Modal>

        {/* Medication Reconciliation Modal */}
        <Modal
            open={reconcileRx !== null}
            onClose={() => { reconcilePreCheckedRef.current = false; setReconcileRx(null); }}
            title="Review active medications"
            size="md"
            footer={
                <>
                    <button
                        type="button"
                        className="cancel-button"
                        onClick={() => { reconcilePreCheckedRef.current = false; setReconcileRx(null); }}
                        disabled={reconcileLoading}
                    >
                        Skip
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={reconcileLoading}
                        onClick={async () => {
                            if (!reconcileRx) return;
                            setReconcileLoading(true);
                            try {
                                const deactivateNew = reconcileRx
                                    .filter(rx => !reconcileCheckedNew.has(rx.id))
                                    .map(rx => rx.id);
                                const deactivateCurrent = medications
                                    .filter(rx => !reconcileCheckedCurrent.has(rx.id))
                                    .map(rx => rx.id);
                                const allDeactivate = [...deactivateNew, ...deactivateCurrent];
                                if (allDeactivate.length > 0) {
                                    await api.post(`/patients/${id}/reconcile-medications/`, {
                                        deactivate: allDeactivate,
                                    });
                                }
                                queryClient.invalidateQueries({ queryKey: ['patients', id, 'medications'] });
                                queryClient.invalidateQueries({ queryKey: ['patients', id, 'medications', 'all'] });
                                reconcilePreCheckedRef.current = false;
                                setReconcileRx(null);
                            } catch {
                                toast.error('Could not update medication list. Please adjust manually from the Medications tab.');
                                reconcilePreCheckedRef.current = false;
                                setReconcileRx(null);
                            } finally {
                                setReconcileLoading(false);
                            }
                        }}
                    >
                        {reconcileLoading ? 'Updating…' : 'Update active medications'}
                    </button>
                </>
            }
        >
            {reconcileRx && (
                <div style={{ display: 'grid', gap: '1.25rem' }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Review what this patient is currently taking. Check prescriptions to keep them active; uncheck anything that should be removed.
                    </p>
                    {reconcileRx.length > 0 ? (
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                                Prescribed in this consultation
                            </div>
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                {reconcileRx.map(rx => (
                                    <label key={rx.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-lighter)', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={reconcileCheckedNew.has(rx.id)}
                                            onChange={e => {
                                                const next = new Set(reconcileCheckedNew);
                                                e.target.checked ? next.add(rx.id) : next.delete(rx.id);
                                                setReconcileCheckedNew(next);
                                            }}
                                            style={{ width: '16px', height: '16px', flexShrink: 0 }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rx.medication_name}</div>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{rx.dosage} · {rx.frequency_display || rx.frequency}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No prescriptions were added in this consultation.
                        </div>
                    )}
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                            Currently active medications
                        </div>
                        {medicationsLoading ? (
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Loading…</div>
                        ) : medications.filter(rx => !reconcileRx.some(n => n.id === rx.id)).length === 0 ? (
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No other active medications on file.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                {medications.filter(rx => !reconcileRx.some(n => n.id === rx.id)).map(rx => (
                                    <label key={rx.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={reconcileCheckedCurrent.has(rx.id)}
                                            onChange={e => {
                                                const next = new Set(reconcileCheckedCurrent);
                                                e.target.checked ? next.add(rx.id) : next.delete(rx.id);
                                                setReconcileCheckedCurrent(next);
                                            }}
                                            style={{ width: '16px', height: '16px', flexShrink: 0 }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rx.medication_name}</div>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{rx.dosage} · {rx.frequency_display || rx.frequency}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Modal>

        {/* Stop Prescription Modal */}
        <Modal
            open={stopRxId !== null}
            onClose={() => { setStopRxId(null); setStopRxReason(''); }}
            title="Stop prescription"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={() => { setStopRxId(null); setStopRxReason(''); }}>Cancel</button>
                    <button className="btn btn-danger" disabled={stopRxLoading} onClick={handleStopPrescription}>
                        {stopRxLoading ? 'Stopping…' : 'Stop Prescription'}
                    </button>
                </>
            }
        >
            <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                    <label>Reason for stopping *</label>
                    <select value={stopRxCode} onChange={e => setStopRxCode(e.target.value)}>
                        <option value="side_effect">Side Effect</option>
                        <option value="ineffective">Ineffective</option>
                        <option value="completed">Course Completed</option>
                        <option value="patient_request">Patient Request</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Additional details *</label>
                    <textarea
                        rows={3}
                        value={stopRxReason}
                        onChange={e => setStopRxReason(e.target.value)}
                        placeholder="Provide a brief clinical reason for stopping this medication."
                    />
                </div>
            </div>
        </Modal>
        </>
    );
};

export default PatientDetails;
