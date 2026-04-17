import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
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
import MedicalProcedureForm from '../../procedures/components/MedicalProcedureForm';
import ReferralForm from '../../referrals/components/ReferralForm';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import PageLoader from '../../../shared/components/PageLoader';
import { Dialog, toast, parseApiError } from '../../../shared/components/ui';
import { type LabResult, type Prescription } from '../../../shared/types';
import { PageHeader } from '../../../shared/components/PageHeader';
import { Avatar } from '../../../shared/components/Avatar';
import { TabSkeleton } from '../../../shared/components/SectionCard';

type Tab = 'overview' | 'consultations' | 'conditions' | 'allergies' | 'notes' | 'procedures' | 'referrals' | 'vitals' | 'labs' | 'medications' | 'appointments';

const COMMON_ALLERGENS = [
    'Penicillin', 'Amoxicillin', 'Amoxicillin-Clavulanate', 'Ampicillin', 'Cephalexin',
    'Sulfonamides', 'Trimethoprim-Sulfamethoxazole', 'Aspirin', 'Ibuprofen', 'Naproxen',
    'Diclofenac', 'Codeine', 'Morphine', 'Tramadol', 'Latex',
    'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish',
    'Sesame', 'Bee Venom', 'Wasp Venom', 'Pollen', 'Dust Mites', 'Mold',
    'Cat Dander', 'Dog Dander', 'Nickel', 'Contrast Dye', 'Tetanus Toxoid',
];

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

// ── Shared tooltip style for all vitals Recharts ────────────────────────────
const VITALS_TOOLTIP_STYLE = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
};

const SEVERITY_COLORS: Record<string, string> = {
    mild: '#38a169',
    moderate: '#d69e2e',
    severe: '#e53e3e',
    life_threatening: '#742a2a',
};

const CONDITION_STATUS_COLORS: Record<string, string> = {
    active: '#e53e3e',
    chronic: '#d69e2e',
    in_remission: '#3182ce',
    resolved: '#38a169',
};

const PatientDetails = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated, profile, logout } = useAuth();
    const [patient, setPatient] = useState<PatientWithHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set(['overview']));
    const queryClient = useQueryClient();

    const [showConsultationForm, setShowConsultationForm] = useState(false);
    const [showProcedureForm, setShowProcedureForm] = useState(false);
    const [showReferralForm, setShowReferralForm] = useState(false);
    const [showConditionForm, setShowConditionForm] = useState(false);
    const [showAllergyForm, setShowAllergyForm] = useState(false);

    const [consultationToEdit, setConsultationToEdit] = useState<Consultation | null>(null);
    const [procedureToEdit, setProcedureToEdit] = useState<MedicalProcedure | null>(null);
    const [referralToEdit, setReferralToEdit] = useState<Referral | null>(null);

    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [confirmDeleteConsultationId, setConfirmDeleteConsultationId] = useState<number | null>(null);
    const [confirmDeleteProcedureId, setConfirmDeleteProcedureId] = useState<number | null>(null);
    const [confirmDeleteReferralId, setConfirmDeleteReferralId] = useState<number | null>(null);

    // Vitals tab: toggle per-vital chart visibility
    const [visibleVitals, setVisibleVitals] = useState({
        bp: true, spo2: true, temperature: true, weight: true,
    });
    const toggleVital = (key: keyof typeof visibleVitals) =>
        setVisibleVitals(prev => ({ ...prev, [key]: !prev[key] }));
    const [confirmDeleteConditionId, setConfirmDeleteConditionId] = useState<number | null>(null);
    const [confirmDeleteAllergyId, setConfirmDeleteAllergyId] = useState<number | null>(null);

    // Inline condition form state
    const [conditionForm, setConditionForm] = useState({ name: '', icd_code: '', status: 'active', onset_date: '', notes: '' });
    const [editingConditionId, setEditingConditionId] = useState<number | null>(null);
    const [allergyForm, setAllergyForm] = useState({ allergen: '', reaction_type: 'drug', severity: 'moderate', reaction_description: '', is_active: true });
    const [formLoading, setFormLoading] = useState(false);
    const [allergenSuggestions, setAllergenSuggestions] = useState<string[]>([]);
    const [showAllergenSuggestions, setShowAllergenSuggestions] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);

    // Lab Results
    const [showLabForm, setShowLabForm] = useState(false);
    const [editingLabId, setEditingLabId] = useState<number | null>(null);
    const [labForm, setLabForm] = useState({ test_name: '', test_date: '', result_value: '', unit: '', reference_range: '', status: 'pending', notes: '' });
    const [labFormLoading, setLabFormLoading] = useState(false);
    const [confirmDeleteLabId, setConfirmDeleteLabId] = useState<number | null>(null);

    // Lazy-loaded tab data via TanStack Query (fetched only when tab is first activated)
    const { data: vitalsTrend = [], isLoading: vitalsLoading } = useQuery<VitalsPoint[]>({
        queryKey: ['patients', id, 'vitals'],
        queryFn: async () => {
            const res = await api.get(`/patients/${id}/vitals-trend/`);
            return res.data.vitals || [];
        },
        enabled: loadedTabs.has('vitals'),
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

    const { data: medications = [], isLoading: medicationsLoading } = useQuery<Prescription[]>({
        queryKey: ['patients', id, 'medications'],
        queryFn: async () => {
            const res = await api.get('/prescriptions/', { params: { patient_id: id, is_active: true } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('medications'),
        staleTime: 2 * 60 * 1000,
    });

    const { data: patientAppointments = [], isLoading: appointmentsLoading } = useQuery<Array<{
        id: number;
        appointment_date: string;
        status: string;
        reason_for_appointment: string;
    }>>({
        queryKey: ['patients', id, 'appointments'],
        queryFn: async () => {
            const res = await api.get('/appointments/', { params: { patient_id: id } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('appointments'),
        staleTime: 2 * 60 * 1000,
    });

    // BUG-03: consultations, procedures, referrals — lazy-loaded when tab is first activated
    const { data: consultationsData = [], isLoading: consultationsLoading } = useQuery<Consultation[]>({
        queryKey: ['patients', id, 'consultations'],
        queryFn: async () => {
            const res = await api.get(`/consultations/`, { params: { patient_id: id, ordering: '-consultation_date' } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('consultations'),
        staleTime: 2 * 60 * 1000,
    });

    const { data: proceduresData = [], isLoading: proceduresLoading } = useQuery<MedicalProcedure[]>({
        queryKey: ['patients', id, 'procedures'],
        queryFn: async () => {
            const res = await api.get(`/medical-procedures/`, { params: { patient_id: id } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('procedures'),
        staleTime: 2 * 60 * 1000,
    });

    const { data: referralsData = [], isLoading: referralsLoading } = useQuery<Referral[]>({
        queryKey: ['patients', id, 'referrals'],
        queryFn: async () => {
            const res = await api.get(`/referrals/`, { params: { patient_id: id } });
            return res.data.results ?? res.data;
        },
        enabled: loadedTabs.has('referrals'),
        staleTime: 2 * 60 * 1000,
    });

    // Tab refs for mobile scrollIntoView
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    // Quick Note
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

    const handleSuccess = () => {
        setShowConsultationForm(false);
        setShowProcedureForm(false);
        setShowReferralForm(false);
        setShowConditionForm(false);
        setShowAllergyForm(false);
        setConsultationToEdit(null);
        setProcedureToEdit(null);
        setReferralToEdit(null);
        fetchPatientDetails();
        // Invalidate lazy tab caches so next activation fetches fresh data
        queryClient.invalidateQueries({ queryKey: ['patients', id, 'consultations'] });
        queryClient.invalidateQueries({ queryKey: ['patients', id, 'procedures'] });
        queryClient.invalidateQueries({ queryKey: ['patients', id, 'referrals'] });
    };

    const handleCancel = () => {
        setShowConsultationForm(false);
        setShowProcedureForm(false);
        setShowReferralForm(false);
        setShowConditionForm(false);
        setShowAllergyForm(false);
        setConsultationToEdit(null);
        setProcedureToEdit(null);
        setReferralToEdit(null);
    };

    // handleTabChange: mark tab as loaded (triggers useQuery for that tab on first activation)
    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        setLoadedTabs(prev => new Set([...prev, tab]));
        const el = tabRefs.current[tab];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    };

    // Keyboard shortcuts: Ctrl/Cmd+N → new consultation, Esc → close open forms
    const anyFormOpen = showConsultationForm || showProcedureForm || showReferralForm;
    useKeyboardShortcut({
        key: 'n',
        modifiers: ['ctrl'],
        enabled: !anyFormOpen,
        onKeyDown: () => { setConsultationToEdit(null); setShowConsultationForm(true); handleTabChange('consultations'); },
    });
    useKeyboardShortcut({
        key: 'Escape',
        enabled: anyFormOpen,
        onKeyDown: handleCancel,
    });

    // Reset quick note and loadedTabs when navigating to a different patient
    // (TanStack Query automatically scopes cached data per patient via query keys)
    useEffect(() => {
        setQuickNote('');
        setQuickNoteLoaded(false);
        setLoadedTabs(new Set(['overview']));
    }, [id]);

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

    const handleDeleteLab = async (labId: number) => {
        try {
            await api.delete(`/lab-results/${labId}/`);
            toast.success('Lab result deleted.');
            setConfirmDeleteLabId(null);
            queryClient.invalidateQueries({ queryKey: ['patients', id, 'labs'] });
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to delete lab result.'));
            setConfirmDeleteLabId(null);
        }
    };

    const handleStatusSelect = (newStatus: string) => {
        if (!patient || newStatus === patient.status) return;
        if (newStatus === 'deceased' || newStatus === 'transferred') {
            setPendingStatus(newStatus);
        } else {
            executeStatusChange(newStatus);
        }
    };

    const executeStatusChange = async (status?: string) => {
        const newStatus = status || pendingStatus;
        if (!patient || !newStatus) return;
        setPendingStatus(null);
        setStatusUpdating(true);
        try {
            await api.patch(`/patients/${patient.unique_id}/set-status/`, { status: newStatus });
            setPatient(prev => prev ? { ...prev, status: newStatus as PatientWithHistory['status'] } : null);
            toast.success(`Patient status updated to ${newStatus}.`);
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to update patient status.'));
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleDeleteConsultation = async (consultationId: number) => {
        try {
            await api.delete(`/consultations/${consultationId}/`);
            setConfirmDeleteConsultationId(null);
            toast.success('Consultation deleted.');
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, t('patient_detail.error.delete_general')));
        }
    };

    const handleDeleteProcedure = async (procedureId: number) => {
        try {
            await api.delete(`/medical-procedures/${procedureId}/`);
            setConfirmDeleteProcedureId(null);
            toast.success('Procedure deleted.');
            fetchPatientDetails();
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
        } catch (err) {
            toast.error(parseApiError(err, t('patient_detail.error.delete_general')));
        }
    };

    const handleDeleteCondition = async (conditionId: number) => {
        try {
            await api.delete(`/conditions/${conditionId}/`);
            setConfirmDeleteConditionId(null);
            toast.success('Condition deleted.');
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to delete condition.'));
        }
    };

    const handleDeleteAllergy = async (allergyId: number) => {
        try {
            await api.delete(`/allergies/${allergyId}/`);
            setConfirmDeleteAllergyId(null);
            toast.success('Allergy deleted.');
            fetchPatientDetails();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to delete allergy.'));
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
            setConditionForm({ name: '', icd_code: '', status: 'active', onset_date: '', notes: '' });
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
            setAllergyForm({ allergen: '', reaction_type: 'drug', severity: 'moderate', reaction_description: '', is_active: true });
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

    const activeAllergies = patient.allergy_records?.filter(a => a.is_active) || [];
    const lifeThreateningAllergies = activeAllergies.filter(a => a.severity === 'life_threatening');
    const severeAllergies = activeAllergies.filter(a => a.severity === 'severe');
    const hasAllergyAlert = lifeThreateningAllergies.length > 0 || severeAllergies.length > 0;

    const LAB_STATUS_COLORS: Record<string, string> = {
        normal: '#38a169',
        abnormal: '#d69e2e',
        critical: '#e53e3e',
        pending: '#718096',
    };

    const TABS: { key: Tab; label: string; count?: number }[] = [
        { key: 'overview', label: 'Overview' },
        { key: 'consultations', label: 'Consultations', count: patient.consultations?.length },
        { key: 'vitals', label: 'Vitals Trend' },
        { key: 'conditions', label: 'Conditions', count: patient.conditions?.length },
        { key: 'allergies', label: 'Allergies', count: activeAllergies.length },
        { key: 'notes', label: 'Notes', count: patient.patient_notes?.length },
        { key: 'procedures', label: 'Procedures', count: patient.medical_procedures?.length },
        { key: 'referrals', label: 'Referrals', count: patient.referrals?.length },
        { key: 'appointments', label: 'Appointments', count: patientAppointments.length || undefined },
        { key: 'labs', label: 'Lab Results', count: labResults.length || patient.lab_results?.length },
        { key: 'medications', label: 'Medications', count: medications.length },
    ];

    return (
        <>
        <PageHeader
            title={`${patient.first_name} ${patient.last_name}`}
            breadcrumb={[{ label: 'Patients', href: '/patients' }]}
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
                {/* Action strip — scrollable horizontal row, never makes page wider */}
                <div className="patient-action-strip">
                    <button
                        onClick={() => { setShowConsultationForm(true); setConsultationToEdit(null); handleTabChange('consultations'); }}
                        className="strip-btn strip-btn--primary"
                    >
                        + Consultation
                    </button>
                    <button
                        onClick={() => { setShowReferralForm(true); setReferralToEdit(null); handleTabChange('referrals'); }}
                        className="strip-btn"
                    >
                        + Referral
                    </button>
                    <button
                        onClick={() => { setShowConditionForm(true); handleTabChange('conditions'); }}
                        className="strip-btn"
                    >
                        + Condition
                    </button>
                    <button onClick={handleExportPdf} className="strip-btn">
                        PDF
                    </button>
                    <div className="strip-dropdown" ref={dropdownRef}>
                        <button onClick={() => setShowDropdown(!showDropdown)} className="strip-btn">
                            More ▾
                        </button>
                        {showDropdown && (
                            <ul className="dropdown-menu">
                                {(profile?.access_level ?? 1) >= 2 && (
                                    <li>
                                        <button
                                            onClick={() => { setShowProcedureForm(true); setProcedureToEdit(null); setShowDropdown(false); handleTabChange('procedures'); }}
                                            className="action-button dropdown-item"
                                        >
                                            + Add Procedure
                                        </button>
                                    </li>
                                )}
                                <li>
                                    <button
                                        onClick={() => { setShowAllergyForm(true); setShowDropdown(false); handleTabChange('allergies'); }}
                                        className="action-button dropdown-item"
                                    >
                                        + Add Allergy
                                    </button>
                                </li>
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Note — pinned, visible only to this doctor */}
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

            {/* Forms (modal overlays) */}
            {showConsultationForm && <ConsultationForm patientId={id!} onSuccess={handleSuccess} onCancel={handleCancel} consultationToEdit={consultationToEdit} />}
            {showProcedureForm && <MedicalProcedureForm patientId={id!} onSuccess={handleSuccess} onCancel={handleCancel} procedureToEdit={procedureToEdit} />}
            {showReferralForm && <ReferralForm patientId={id!} onSuccess={handleSuccess} onClose={handleCancel} referralToEdit={referralToEdit ? { ...referralToEdit, comments: referralToEdit.comments ?? undefined } : null} />}

            {/* Tabs */}
            <div className="patient-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        ref={el => { tabRefs.current[tab.key] = el; }}
                        className={`patient-tab${activeTab === tab.key ? ' active' : ''}`}
                        onClick={() => handleTabChange(tab.key)}
                    >
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && <span className="tab-count">{tab.count}</span>}
                    </button>
                ))}
            </div>

            <div className="patient-tab-content">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="tab-panel">
                        <div className="overview-grid">
                            <div className="patient-details-card detail-info-group">
                                <h3>Personal Information</h3>
                                <div className="info-item"><strong>DOB:</strong> {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'}</div>
                                <div className="info-item"><strong>Age:</strong> {patient.age || 'N/A'}</div>
                                <div className="info-item"><strong>Blood Group:</strong> {patient.blood_group || 'N/A'}</div>
                                <div className="info-item"><strong>Address:</strong> {patient.address || 'N/A'}</div>
                                <div className="info-item"><strong>Email:</strong> {patient.email || 'N/A'}</div>
                                <div className="info-item"><strong>Phone:</strong> {patient.phone_number || 'N/A'}</div>
                                <div className="info-item"><strong>Emergency Contact:</strong> {patient.emergency_contact_name || 'N/A'} {patient.emergency_contact_number ? `(${patient.emergency_contact_number})` : ''}</div>
                            </div>

                            <div className="patient-details-card detail-info-group">
                                <h3>Medical History</h3>
                                <p>{patient.medical_history || 'No medical history recorded.'}</p>
                                <hr />
                                <h3>Active Conditions ({patient.conditions?.filter(c => c.status === 'active' || c.status === 'chronic').length || 0})</h3>
                                {patient.conditions?.filter(c => c.status !== 'resolved').slice(0, 3).map(c => (
                                    <div key={c.id} className="mini-condition">
                                        <span className="condition-dot" style={{ background: CONDITION_STATUS_COLORS[c.status] }} />
                                        <span>{c.name}</span>
                                        <span className="condition-status-label">{c.status_display || c.status}</span>
                                    </div>
                                ))}
                                {!patient.conditions?.length && <p className="muted">No conditions recorded.</p>}
                            </div>

                            <div className="patient-details-card detail-info-group">
                                <h3>Recent Consultations</h3>
                                {patient.consultations?.slice(0, 3).map(c => (
                                    <div key={c.id} className="mini-consultation">
                                        <div className="mini-consult-date">{new Date(c.consultation_date).toLocaleDateString()}</div>
                                        <div className="mini-consult-reason">{c.reason_for_consultation}</div>
                                        {c.follow_up_date && <div className="follow-up-chip">Follow-up: {new Date(c.follow_up_date).toLocaleDateString()}</div>}
                                    </div>
                                ))}
                                {!patient.consultations?.length && <p className="muted">No consultations yet.</p>}
                                <button className="btn-view-all" onClick={() => handleTabChange('consultations')}>View all consultations →</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Consultations Tab */}
                {activeTab === 'consultations' && (
                    <div className="tab-panel">
                        <div className="tab-panel-header">
                            <h3>Consultation History</h3>
                            <button className="btn-add-primary" onClick={() => { setConsultationToEdit(null); setShowConsultationForm(true); }}>+ Add Consultation</button>
                        </div>
                        {consultationsLoading ? (
                            <TabSkeleton rows={4} />
                        ) : consultationsData.length > 0 ? (
                            <ul className="detail-list">
                                {consultationsData.map(c => (
                                    <li key={c.id} className="consultation-entry detail-list-item">
                                        <div className="consult-header">
                                            <h4>{new Date(c.consultation_date).toLocaleDateString()}</h4>
                                            <span className="consult-type-badge">{c.consultation_type_display || c.consultation_type}</span>
                                        </div>
                                        <div className="info-item"><strong>Reason:</strong> {c.reason_for_consultation}</div>
                                        {c.symptoms?.length > 0 && (
                                            <div className="info-item">
                                                <strong>Symptoms:</strong>
                                                <div className="symptoms-display">
                                                    {c.symptoms.map(s => <span key={s} className="symptom-tag">{s}</span>)}
                                                </div>
                                            </div>
                                        )}
                                        {c.diagnosis && <div className="info-item"><strong>Diagnosis:</strong> {c.diagnosis}</div>}
                                        {c.medical_report && <div className="info-item"><strong>Report:</strong> {c.medical_report}</div>}
                                        {c.follow_up_date && <div className="follow-up-chip">Follow-up: {new Date(c.follow_up_date).toLocaleDateString()}</div>}
                                        <div className="vitals-row">
                                            {c.weight && <span className="vital-chip">Weight: {c.weight}kg</span>}
                                            {c.height && <span className="vital-chip">Height: {c.height}m</span>}
                                            {c.temperature && <span className="vital-chip">Temp: {c.temperature}°C</span>}
                                            {c.sp2 && <span className="vital-chip">SpO2: {c.sp2}%</span>}
                                            {(c.bp_systolic || c.bp_diastolic) && <span className="vital-chip">BP: {c.blood_pressure_display ?? `${c.bp_systolic ?? '?'}/${c.bp_diastolic ?? '?'}`}</span>}
                                        </div>
                                        <div className="entry-actions">
                                            <button onClick={() => { setConsultationToEdit(c); setShowConsultationForm(true); }} className="edit-button action-button">Edit</button>
                                            <button onClick={() => setConfirmDeleteConsultationId(c.id)} className="delete-button action-button">Delete</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="muted">No consultations recorded.</p>}
                    </div>
                )}

                {/* Conditions Tab */}
                {activeTab === 'conditions' && (
                    <div className="tab-panel">
                        <div className="tab-panel-header">
                            <h3>Medical Conditions</h3>
                            <button className="btn-add-primary" onClick={() => setShowConditionForm(!showConditionForm)}>+ Add Condition</button>
                        </div>
                        {showConditionForm && (
                            <form onSubmit={handleConditionSubmit} className="inline-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Condition Name *</label>
                                        <input required value={conditionForm.name} onChange={e => setConditionForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Type 2 Diabetes" />
                                    </div>
                                    <div className="form-group">
                                        <label>ICD Code</label>
                                        <input value={conditionForm.icd_code} onChange={e => setConditionForm(p => ({ ...p, icd_code: e.target.value }))} placeholder="e.g. E11" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select value={conditionForm.status} onChange={e => setConditionForm(p => ({ ...p, status: e.target.value }))}>
                                            <option value="active">Active</option>
                                            <option value="chronic">Chronic</option>
                                            <option value="in_remission">In Remission</option>
                                            <option value="resolved">Resolved</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Onset Date</label>
                                        <input type="date" value={conditionForm.onset_date} onChange={e => setConditionForm(p => ({ ...p, onset_date: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea rows={2} value={conditionForm.notes} onChange={e => setConditionForm(p => ({ ...p, notes: e.target.value }))} />
                                </div>
                                <div className="form-actions">
                                    <button type="submit" disabled={formLoading}>{formLoading ? 'Saving...' : 'Save Condition'}</button>
                                    <button type="button" onClick={() => setShowConditionForm(false)} className="cancel-button">Cancel</button>
                                </div>
                            </form>
                        )}
                        {patient.conditions?.length ? (
                            <div className="conditions-grid">
                                {patient.conditions.map(c => (
                                    <div key={c.id} className="condition-card">
                                        {editingConditionId === c.id ? (
                                            <form onSubmit={handleConditionSubmit} className="inline-form">
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label>Name *</label>
                                                        <input required value={conditionForm.name} onChange={e => setConditionForm(p => ({ ...p, name: e.target.value }))} />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>ICD Code</label>
                                                        <input value={conditionForm.icd_code} onChange={e => setConditionForm(p => ({ ...p, icd_code: e.target.value }))} />
                                                    </div>
                                                </div>
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label>Status</label>
                                                        <select value={conditionForm.status} onChange={e => setConditionForm(p => ({ ...p, status: e.target.value }))}>
                                                            <option value="active">Active</option>
                                                            <option value="chronic">Chronic</option>
                                                            <option value="resolved">Resolved</option>
                                                            <option value="in_remission">In Remission</option>
                                                        </select>
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Onset Date</label>
                                                        <input type="date" value={conditionForm.onset_date} onChange={e => setConditionForm(p => ({ ...p, onset_date: e.target.value }))} />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label>Notes</label>
                                                    <textarea rows={2} value={conditionForm.notes} onChange={e => setConditionForm(p => ({ ...p, notes: e.target.value }))} />
                                                </div>
                                                <div className="form-actions">
                                                    <button type="submit" disabled={formLoading}>{formLoading ? 'Saving...' : 'Update'}</button>
                                                    <button type="button" onClick={() => { setEditingConditionId(null); setConditionForm({ name: '', icd_code: '', status: 'active', onset_date: '', notes: '' }); }} className="cancel-button">Cancel</button>
                                                </div>
                                            </form>
                                        ) : (
                                            <>
                                                <div className="condition-card-header">
                                                    <div>
                                                        <span className="condition-name">{c.name}</span>
                                                        {c.icd_code && <span className="icd-code">{c.icd_code}</span>}
                                                    </div>
                                                    <span className="condition-status" style={{ background: CONDITION_STATUS_COLORS[c.status] + '22', color: CONDITION_STATUS_COLORS[c.status], border: `1px solid ${CONDITION_STATUS_COLORS[c.status]}` }}>
                                                        {c.status_display || c.status}
                                                    </span>
                                                </div>
                                                {c.onset_date && <div className="condition-meta">Since: {new Date(c.onset_date).toLocaleDateString()}</div>}
                                                {c.notes && <p className="condition-notes">{c.notes}</p>}
                                                <div className="entry-actions">
                                                    <button onClick={() => { setEditingConditionId(c.id); setConditionForm({ name: c.name, icd_code: c.icd_code || '', status: c.status, onset_date: c.onset_date || '', notes: c.notes || '' }); }} className="action-button">Edit</button>
                                                    <button onClick={() => setConfirmDeleteConditionId(c.id)} className="delete-button action-button">Delete</button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : <p className="muted">No conditions recorded.</p>}
                    </div>
                )}

                {/* Allergies Tab */}
                {activeTab === 'allergies' && (
                    <div className="tab-panel">
                        <div className="tab-panel-header">
                            <h3>Allergies</h3>
                            <button className="btn-add-primary" onClick={() => setShowAllergyForm(!showAllergyForm)}>+ Add Allergy</button>
                        </div>
                        {showAllergyForm && (
                            <form onSubmit={handleAllergySubmit} className="inline-form">
                                <div className="form-row">
                                    <div className="form-group" style={{ position: 'relative' }}>
                                        <label>Allergen *</label>
                                        <input
                                            required
                                            value={allergyForm.allergen}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setAllergyForm(p => ({ ...p, allergen: val }));
                                                if (val.length >= 2) {
                                                    setAllergenSuggestions(
                                                        COMMON_ALLERGENS.filter(a => a.toLowerCase().includes(val.toLowerCase())).slice(0, 8)
                                                    );
                                                    setShowAllergenSuggestions(true);
                                                } else {
                                                    setAllergenSuggestions([]);
                                                    setShowAllergenSuggestions(false);
                                                }
                                            }}
                                            onBlur={() => setTimeout(() => setShowAllergenSuggestions(false), 150)}
                                            autoComplete="off"
                                            placeholder="e.g. Penicillin"
                                        />
                                        {showAllergenSuggestions && allergenSuggestions.length > 0 && (
                                            <ul className="allergen-suggestions-dropdown">
                                                {allergenSuggestions.map(a => (
                                                    <li key={a}>
                                                        <button type="button" onMouseDown={() => {
                                                            setAllergyForm(p => ({ ...p, allergen: a }));
                                                            setShowAllergenSuggestions(false);
                                                            setAllergenSuggestions([]);
                                                        }}>
                                                            {a}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Type</label>
                                        <select value={allergyForm.reaction_type} onChange={e => setAllergyForm(p => ({ ...p, reaction_type: e.target.value }))}>
                                            <option value="drug">Drug</option>
                                            <option value="food">Food</option>
                                            <option value="environmental">Environmental</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Severity</label>
                                    <select value={allergyForm.severity} onChange={e => setAllergyForm(p => ({ ...p, severity: e.target.value }))}>
                                        <option value="mild">Mild</option>
                                        <option value="moderate">Moderate</option>
                                        <option value="severe">Severe</option>
                                        <option value="life_threatening">Life Threatening</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Reaction Description</label>
                                    <textarea rows={2} value={allergyForm.reaction_description} onChange={e => setAllergyForm(p => ({ ...p, reaction_description: e.target.value }))} />
                                </div>
                                <div className="form-actions">
                                    <button type="submit" disabled={formLoading}>{formLoading ? 'Saving...' : 'Save Allergy'}</button>
                                    <button type="button" onClick={() => setShowAllergyForm(false)} className="cancel-button">Cancel</button>
                                </div>
                            </form>
                        )}
                        {patient.allergy_records?.length ? (
                            <div className="allergies-list">
                                {patient.allergy_records.map(a => (
                                    <div key={a.id} className={`allergy-card${!a.is_active ? ' inactive' : ''}`}>
                                        <div className="allergy-card-header">
                                            <div>
                                                <span className="allergen-name">{a.allergen}</span>
                                                <span className="allergy-type">{a.reaction_type_display || a.reaction_type}</span>
                                            </div>
                                            <span className="severity-badge" style={{ background: SEVERITY_COLORS[a.severity] + '22', color: SEVERITY_COLORS[a.severity], border: `1px solid ${SEVERITY_COLORS[a.severity]}` }}>
                                                {a.severity_display || a.severity}
                                            </span>
                                        </div>
                                        {a.reaction_description && <p className="allergy-desc">{a.reaction_description}</p>}
                                        {!a.is_active && <span className="inactive-label">Inactive</span>}
                                        <div className="entry-actions">
                                            <button onClick={() => handleToggleAllergy(a.id, a.is_active)} className="action-button">
                                                {a.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button onClick={() => setConfirmDeleteAllergyId(a.id)} className="delete-button action-button">Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="muted">No allergies recorded.</p>}
                    </div>
                )}

                {/* Notes Tab */}
                {activeTab === 'notes' && (
                    <div className="tab-panel">
                        <div className="tab-panel-header">
                            <h3>Clinical Notes</h3>
                            <Link to={`/notes?patient=${id}`} className="btn-add-primary">+ Add Note</Link>
                        </div>
                        {patient.patient_notes?.length ? (
                            <ul className="detail-list">
                                {patient.patient_notes.map(n => (
                                    <li key={n.id} className="detail-list-item">
                                        <div className="note-header">
                                            <strong>{n.title}</strong>
                                            <span className="note-type-badge">{n.note_type_display || n.note_type}</span>
                                            <span className="note-date">{new Date(n.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className="note-content">{n.content}</p>
                                        {n.author_name && <div className="note-author">By Dr. {n.author_name}</div>}
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="muted">No clinical notes recorded for this patient.</p>}
                    </div>
                )}

                {/* Procedures Tab */}
                {activeTab === 'procedures' && (
                    <div className="tab-panel">
                        <div className="tab-panel-header">
                            <h3>Medical Procedures</h3>
                            {(profile?.access_level ?? 1) >= 2 && (
                                <button className="btn-add-primary" onClick={() => { setProcedureToEdit(null); setShowProcedureForm(true); }}>+ Add Procedure</button>
                            )}
                        </div>
                        {proceduresLoading ? (
                            <TabSkeleton rows={4} />
                        ) : proceduresData.length > 0 ? (
                            <ul className="detail-list">
                                {proceduresData.map(p => (
                                    <li key={p.id} className="procedure-entry detail-list-item">
                                        <h4>{p.procedure_type} — {new Date(p.procedure_date).toLocaleDateString()}</h4>
                                        {p.result && <div className="info-item"><strong>Result:</strong> {p.result}</div>}
                                        {p.attachments && (
                                            <button onClick={() => downloadFile(p.attachments, `procedure_${p.id}`)} className="download-link">Download attachment</button>
                                        )}
                                        <div className="entry-actions">
                                            <button onClick={() => { setProcedureToEdit(p); setShowProcedureForm(true); }} className="edit-button action-button">Edit</button>
                                            <button onClick={() => setConfirmDeleteProcedureId(p.id)} className="delete-button action-button">Delete</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="muted">No procedures recorded.</p>}
                    </div>
                )}

                {/* Vitals Tab — Recharts LineCharts */}
                {activeTab === 'vitals' && (
                    <div className="tab-panel">
                        <div className="tab-panel-header">
                            <h3>Vitals History</h3>
                        </div>
                        {vitalsLoading ? (
                            <TabSkeleton rows={3} />
                        ) : vitalsTrend.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📈</div>
                                <div className="empty-state-title">No vitals recorded yet</div>
                                <div className="empty-state-subtitle">Vitals are captured during consultations.</div>
                            </div>
                        ) : (() => {
                            // Format date labels
                            const chartData = vitalsTrend.map(v => ({
                                ...v,
                                label: new Date(v.consultation_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                            }));

                            // Last readings for StatCards
                            const last = vitalsTrend[vitalsTrend.length - 1];

                            const bpData = chartData.filter(v => v.bp_systolic !== null || v.bp_diastolic !== null);
                            const spo2Data = chartData.filter(v => v.sp2 !== null);
                            const tempData = chartData.filter(v => v.temperature !== null);
                            const weightData = chartData.filter(v => v.weight !== null);

                            return (
                                <div>
                                    {/* Per-vital toggle checkboxes */}
                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                                        {([
                                            { key: 'bp', label: 'Blood Pressure' },
                                            { key: 'spo2', label: 'SpO₂' },
                                            { key: 'temperature', label: 'Temperature' },
                                            { key: 'weight', label: 'Weight' },
                                        ] as const).map(({ key, label }) => (
                                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={visibleVitals[key]}
                                                    onChange={() => toggleVital(key)}
                                                />
                                                {label}
                                            </label>
                                        ))}
                                    </div>

                                    {/* Blood Pressure Chart */}
                                    {visibleVitals.bp && bpData.length > 0 && (
                                        <div className="section-card" style={{ marginBottom: '1rem' }}>
                                            <div className="section-card-header">
                                                <span className="section-card-title">Blood Pressure (mmHg)</span>
                                                {(last.bp_systolic || last.bp_diastolic) && (
                                                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                                        Latest: {last.bp_systolic ?? '?'}/{last.bp_diastolic ?? '?'} mmHg
                                                    </span>
                                                )}
                                            </div>
                                            <div className="section-card-body" style={{ height: 220 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={bpData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                        <YAxis domain={[60, 200]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                        <Tooltip contentStyle={VITALS_TOOLTIP_STYLE} />
                                                        <ReferenceLine y={180} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'Crisis', fontSize: 10, fill: 'var(--danger)' }} />
                                                        <ReferenceLine y={90} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Hypotension', fontSize: 10, fill: 'var(--warning)' }} />
                                                        <Line type="monotone" dataKey="bp_systolic" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} name="Systolic" connectNulls />
                                                        <Line type="monotone" dataKey="bp_diastolic" stroke="var(--accent-secondary)" strokeWidth={2} dot={{ r: 3 }} name="Diastolic" connectNulls />
                                                        <Legend />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}

                                    {/* SpO₂ Chart */}
                                    {visibleVitals.spo2 && spo2Data.length > 0 && (
                                        <div className="section-card" style={{ marginBottom: '1rem' }}>
                                            <div className="section-card-header">
                                                <span className="section-card-title">SpO₂ (%)</span>
                                                {last.sp2 && (
                                                    <span style={{ fontSize: '0.8125rem', color: Number(last.sp2) < 94 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                                        Latest: {last.sp2}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="section-card-body" style={{ height: 220 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={spo2Data}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                        <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                        <Tooltip contentStyle={VITALS_TOOLTIP_STYLE} />
                                                        <ReferenceLine y={94} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Low SpO₂', fontSize: 10, fill: 'var(--warning)' }} />
                                                        <Line type="monotone" dataKey="sp2" stroke="var(--success)" strokeWidth={2} dot={{ r: 3 }} name="SpO₂ %" connectNulls />
                                                        <Legend />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}

                                    {/* Temperature Chart */}
                                    {visibleVitals.temperature && tempData.length > 0 && (
                                        <div className="section-card" style={{ marginBottom: '1rem' }}>
                                            <div className="section-card-header">
                                                <span className="section-card-title">Temperature (°C)</span>
                                                {last.temperature && (
                                                    <span style={{ fontSize: '0.8125rem', color: Number(last.temperature) > 38.5 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                                        Latest: {last.temperature}°C
                                                    </span>
                                                )}
                                            </div>
                                            <div className="section-card-body" style={{ height: 220 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={tempData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                        <YAxis domain={[34, 42]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                        <Tooltip contentStyle={VITALS_TOOLTIP_STYLE} />
                                                        <ReferenceLine y={38.5} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'Fever', fontSize: 10, fill: 'var(--danger)' }} />
                                                        <ReferenceLine y={35.5} stroke="var(--info)" strokeDasharray="4 4" label={{ value: 'Hypothermia', fontSize: 10, fill: 'var(--info)' }} />
                                                        <Line type="monotone" dataKey="temperature" stroke="var(--warning)" strokeWidth={2} dot={{ r: 3 }} name="Temp °C" connectNulls />
                                                        <Legend />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}

                                    {/* Weight Chart */}
                                    {visibleVitals.weight && weightData.length > 0 && (
                                        <div className="section-card" style={{ marginBottom: '1rem' }}>
                                            <div className="section-card-header">
                                                <span className="section-card-title">Weight (kg)</span>
                                                {last.weight && (
                                                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                                        Latest: {last.weight} kg
                                                    </span>
                                                )}
                                            </div>
                                            <div className="section-card-body" style={{ height: 220 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={weightData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                        <Tooltip contentStyle={VITALS_TOOLTIP_STYLE} />
                                                        <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} name="Weight kg" connectNulls />
                                                        <Legend />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'referrals' && (
                    <div className="tab-panel">
                        <div className="tab-panel-header">
                            <h3>Referral History</h3>
                            <button className="btn-add-primary" onClick={() => { setReferralToEdit(null); setShowReferralForm(true); }}>+ Add Referral</button>
                        </div>
                        {referralsLoading ? (
                            <TabSkeleton rows={4} />
                        ) : referralsData.length > 0 ? (
                            <ul className="detail-list">
                                {referralsData.map(r => (
                                    <li key={r.id} className="referral-entry detail-list-item">
                                        <h4>{new Date(r.date_of_referral).toLocaleDateString()}</h4>
                                        <div className="info-item"><strong>Referred to:</strong> {r.referred_to_details?.full_name || 'Unknown'}</div>
                                        <div className="info-item"><strong>Reason:</strong> {r.reason_for_referral}</div>
                                        <div className="info-item"><strong>Specialty:</strong> {r.specialty_display || r.specialty_requested}</div>
                                        <div className="info-item"><strong>Status:</strong> <span className={`status-badge status-${r.status}`}>{r.status_display || r.status}</span></div>
                                        {r.comments && <div className="info-item"><strong>Comments:</strong> {r.comments}</div>}
                                        <div className="entry-actions">
                                            <button onClick={() => { setReferralToEdit(r); setShowReferralForm(true); }} className="edit-button action-button">Edit</button>
                                            <button onClick={() => setConfirmDeleteReferralId(r.id)} className="delete-button action-button">Delete</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="muted">No referrals recorded.</p>}
                    </div>
                )}
                {/* Lab Results Tab */}
                {/* Appointments Tab — read-only history; create/edit from /appointments */}
                {activeTab === 'appointments' && (
                    <div className="tab-panel">
                        <h3>Appointment History</h3>
                        {appointmentsLoading ? (
                            <TabSkeleton rows={3} />
                        ) : patientAppointments.length === 0 ? (
                            <p className="muted">No appointments on record for this patient.</p>
                        ) : (
                            <ul className="detail-list">
                                {patientAppointments
                                    .slice()
                                    .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())
                                    .map(appt => (
                                        <li key={appt.id} className="detail-list-item">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <strong>{new Date(appt.appointment_date).toLocaleString()}</strong>
                                                <span className={`status-badge status-${appt.status}`}>{appt.status}</span>
                                            </div>
                                            {appt.reason_for_appointment && (
                                                <div className="info-item"><strong>Reason:</strong> {appt.reason_for_appointment}</div>
                                            )}
                                        </li>
                                    ))
                                }
                            </ul>
                        )}
                    </div>
                )}

                {activeTab === 'labs' && (
                    <div className="tab-panel">
                        <div className="tab-panel-header">
                            <h3>Lab Results</h3>
                            <button className="btn-add-primary" onClick={() => {
                                setEditingLabId(null);
                                setLabForm({ test_name: '', test_date: '', result_value: '', unit: '', reference_range: '', status: 'pending', notes: '' });
                                setShowLabForm(true);
                            }}>+ Add Lab Result</button>
                        </div>
                        {showLabForm && (
                            <form onSubmit={handleLabSubmit} className="inline-form" style={{ marginBottom: 'var(--space-4)' }}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Test Name *</label>
                                        <input required value={labForm.test_name} onChange={e => setLabForm(p => ({ ...p, test_name: e.target.value }))} placeholder="e.g. CBC, HbA1c, TSH" />
                                    </div>
                                    <div className="form-group">
                                        <label>Date *</label>
                                        <input type="date" required value={labForm.test_date} onChange={e => setLabForm(p => ({ ...p, test_date: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Result Value</label>
                                        <input value={labForm.result_value} onChange={e => setLabForm(p => ({ ...p, result_value: e.target.value }))} placeholder="e.g. 5.4" />
                                    </div>
                                    <div className="form-group">
                                        <label>Unit</label>
                                        <input value={labForm.unit} onChange={e => setLabForm(p => ({ ...p, unit: e.target.value }))} placeholder="e.g. mmol/L, g/dL" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Reference Range</label>
                                        <input value={labForm.reference_range} onChange={e => setLabForm(p => ({ ...p, reference_range: e.target.value }))} placeholder="e.g. 3.5–5.5" />
                                    </div>
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select value={labForm.status} onChange={e => setLabForm(p => ({ ...p, status: e.target.value }))}>
                                            <option value="pending">Pending</option>
                                            <option value="normal">Normal</option>
                                            <option value="abnormal">Abnormal</option>
                                            <option value="critical">Critical</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea rows={2} value={labForm.notes} onChange={e => setLabForm(p => ({ ...p, notes: e.target.value }))} />
                                </div>
                                <div className="form-actions">
                                    <button type="submit" disabled={labFormLoading}>{labFormLoading ? 'Saving...' : (editingLabId ? 'Update' : 'Save')}</button>
                                    <button type="button" onClick={() => setShowLabForm(false)} className="cancel-button">Cancel</button>
                                </div>
                            </form>
                        )}
                        {labsLoading ? (
                            <TabSkeleton rows={3} />
                        ) : labResults.length === 0 ? (
                            <p className="muted">No lab results recorded.</p>
                        ) : (
                            <ul className="detail-list">
                                {labResults.map(lab => (
                                    <li key={lab.id} className="detail-list-item">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <div>
                                                <strong>{lab.test_name}</strong>
                                                <span style={{ marginLeft: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                    {new Date(lab.test_date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <span style={{
                                                fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px',
                                                background: LAB_STATUS_COLORS[lab.status] + '22',
                                                color: LAB_STATUS_COLORS[lab.status],
                                                border: `1px solid ${LAB_STATUS_COLORS[lab.status]}`,
                                            }}>
                                                {lab.status_display || lab.status}
                                            </span>
                                        </div>
                                        {(lab.result_value || lab.unit) && (
                                            <div className="info-item">
                                                <strong>Result:</strong> {lab.result_value} {lab.unit}
                                                {lab.reference_range && <span className="muted" style={{ marginLeft: '8px' }}>Ref: {lab.reference_range}</span>}
                                            </div>
                                        )}
                                        {lab.notes && <p className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>{lab.notes}</p>}
                                        <div className="entry-actions">
                                            <button onClick={() => {
                                                setEditingLabId(lab.id);
                                                setLabForm({ test_name: lab.test_name, test_date: lab.test_date, result_value: lab.result_value, unit: lab.unit, reference_range: lab.reference_range, status: lab.status, notes: lab.notes });
                                                setShowLabForm(true);
                                            }} className="edit-button action-button">Edit</button>
                                            <button onClick={() => setConfirmDeleteLabId(lab.id)} className="delete-button action-button">Delete</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* Medications Tab */}
                {activeTab === 'medications' && (
                    <div className="tab-panel">
                        <h3>Active Medications</h3>
                        {medicationsLoading ? (
                            <TabSkeleton rows={3} />
                        ) : medications.length === 0 ? (
                            <p className="muted">No active medications on record.</p>
                        ) : (
                            <ul className="detail-list">
                                {medications.map(rx => (
                                    <li key={rx.id} className="detail-list-item">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <strong>{rx.medication_name}</strong>
                                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: '#e6fffa', color: '#234e52', border: '1px solid #81e6d9' }}>
                                                Active
                                            </span>
                                        </div>
                                        <div className="info-item"><strong>Dosage:</strong> {rx.dosage}</div>
                                        <div className="info-item"><strong>Frequency:</strong> {rx.frequency_display || rx.frequency}</div>
                                        {rx.duration_days && <div className="info-item"><strong>Duration:</strong> {rx.duration_days} days</div>}
                                        {rx.instructions && <div className="info-item"><strong>Instructions:</strong> {rx.instructions}</div>}
                                        <div className="info-item" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                            Prescribed: {new Date(rx.prescribed_at).toLocaleDateString()}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>

        {confirmDeleteConsultationId !== null && (
            <ConfirmModal message={t('patient_detail.error.delete_consultation')} onConfirm={() => handleDeleteConsultation(confirmDeleteConsultationId)} onCancel={() => setConfirmDeleteConsultationId(null)} />
        )}
        {confirmDeleteProcedureId !== null && (
            <ConfirmModal message={t('patient_detail.error.delete_procedure')} onConfirm={() => handleDeleteProcedure(confirmDeleteProcedureId)} onCancel={() => setConfirmDeleteProcedureId(null)} />
        )}
        {confirmDeleteReferralId !== null && (
            <ConfirmModal message={t('patient_detail.error.delete_referral')} onConfirm={() => handleDeleteReferral(confirmDeleteReferralId)} onCancel={() => setConfirmDeleteReferralId(null)} />
        )}
        {confirmDeleteConditionId !== null && (
            <ConfirmModal message="Delete this condition?" onConfirm={() => handleDeleteCondition(confirmDeleteConditionId)} onCancel={() => setConfirmDeleteConditionId(null)} />
        )}
        {confirmDeleteAllergyId !== null && (
            <ConfirmModal message="Delete this allergy?" onConfirm={() => handleDeleteAllergy(confirmDeleteAllergyId)} onCancel={() => setConfirmDeleteAllergyId(null)} />
        )}
        {confirmDeleteLabId !== null && (
            <ConfirmModal message="Delete this lab result?" onConfirm={() => handleDeleteLab(confirmDeleteLabId)} onCancel={() => setConfirmDeleteLabId(null)} />
        )}

        <Dialog
            open={pendingStatus !== null}
            onClose={() => setPendingStatus(null)}
            onConfirm={() => executeStatusChange()}
            title={`Mark patient as ${pendingStatus}?`}
            message={pendingStatus === 'deceased'
                ? 'This will mark the patient as deceased. This action is significant and should be confirmed.'
                : 'This will mark the patient as transferred. The patient record will remain accessible.'}
            tone="danger"
            confirmLabel={pendingStatus === 'deceased' ? 'Mark Deceased' : 'Mark Transferred'}
        />
        </>
    );
};

export default PatientDetails;
