import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../auth/hooks/useAuth';
import {
    type PatientWithHistory,
    type Consultation,
    type MedicalProcedure,
    type Referral,
} from '../../../shared/types';
import jsPDF from 'jspdf';
import '../../../shared/styles/DetailStyles.css';
import './PatientDetail.css';
import ConsultationForm from '../../consultations/components/ConsultationForm';
import MedicalProcedureForm from '../../procedures/components/MedicalProcedureForm';
import ReferralForm from '../../referrals/components/ReferralForm';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import PageLoader from '../../../shared/components/PageLoader';

type Tab = 'overview' | 'consultations' | 'conditions' | 'allergies' | 'notes' | 'procedures' | 'referrals' | 'vitals';

interface VitalsPoint {
    id: number;
    consultation_date: string;
    weight: number | null;
    height: number | null;
    sp2: number | null;
    temperature: number | null;
    blood_pressure: string | null;
}

// ── Inline SVG sparkline for vitals trend ──────────────────────────────────
function VitalSparkline({ label, data, color, dangerAbove, dangerBelow }: {
    label: string;
    data: { x: string; y: number }[];
    color: string;
    dangerAbove?: number;
    dangerBelow?: number;
}) {
    const W = 240, H = 70, PAD = 8;
    const ys = data.map(d => d.y);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeY = maxY - minY || 1;
    const toX = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const toY = (v: number) => H - PAD - ((v - minY) / rangeY) * (H - PAD * 2);
    const pts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.y).toFixed(1)}`).join(' ');

    return (
        <div className="vital-sparkline-card">
            <div className="vital-sparkline-label">{label}</div>
            <div className="vital-sparkline-range">
                <span>{maxY}</span>
                <span>{minY}</span>
            </div>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                {dangerAbove && <line x1={PAD} x2={W - PAD} y1={toY(dangerAbove)} y2={toY(dangerAbove)} stroke="#e53e3e" strokeDasharray="3 2" strokeWidth={1} opacity={0.6} />}
                {dangerBelow && <line x1={PAD} x2={W - PAD} y1={toY(dangerBelow)} y2={toY(dangerBelow)} stroke="#e53e3e" strokeDasharray="3 2" strokeWidth={1} opacity={0.6} />}
                <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                {data.map((d, i) => (
                    <circle key={i} cx={toX(i)} cy={toY(d.y)} r={3} fill={
                        (dangerAbove && d.y > dangerAbove) || (dangerBelow && d.y < dangerBelow) ? '#e53e3e' : color
                    } />
                ))}
            </svg>
            <div className="vital-sparkline-last">Latest: <strong>{data[data.length - 1].y}</strong></div>
        </div>
    );
}

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
    const { token, user, profile, logout } = useAuth();
    const [patient, setPatient] = useState<PatientWithHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('overview');

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
    const [confirmDeleteConditionId, setConfirmDeleteConditionId] = useState<number | null>(null);
    const [confirmDeleteAllergyId, setConfirmDeleteAllergyId] = useState<number | null>(null);

    // Inline condition form state
    const [conditionForm, setConditionForm] = useState({ name: '', icd_code: '', status: 'active', onset_date: '', notes: '' });
    const [allergyForm, setAllergyForm] = useState({ allergen: '', reaction_type: 'drug', severity: 'moderate', reaction_description: '', is_active: true });
    const [formLoading, setFormLoading] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [vitalsTrend, setVitalsTrend] = useState<VitalsPoint[]>([]);
    const [vitalsLoading, setVitalsLoading] = useState(false);

    useEffect(() => {
        if (id && token) {
            fetchPatientDetails();
        } else if (!token) {
            navigate('/login');
        }
    }, [id, token]);

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
        } catch (err: any) {
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                logout();
                navigate('/login');
            } else if (axios.isAxiosError(err) && err.response?.status === 404) {
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

    const fetchVitalsTrend = async () => {
        if (!id || vitalsTrend.length > 0) return;
        setVitalsLoading(true);
        try {
            const res = await api.get(`/patients/${id}/vitals-trend/`);
            setVitalsTrend(res.data.vitals || []);
        } catch {
            /* silently fail */
        } finally {
            setVitalsLoading(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!patient) return;
        setStatusUpdating(true);
        try {
            await api.patch(`/patients/${patient.unique_id}/set-status/`, { status: newStatus });
            setPatient(prev => prev ? { ...prev, status: newStatus as PatientWithHistory['status'] } : null);
        } catch {
            /* silently fail */
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleDeleteConsultation = async (consultationId: number) => {
        try {
            await api.delete(`/consultations/${consultationId}/`);
            setConfirmDeleteConsultationId(null);
            fetchPatientDetails();
        } catch (err: any) {
            setError(t('patient_detail.error.delete_general'));
        }
    };

    const handleDeleteProcedure = async (procedureId: number) => {
        try {
            await api.delete(`/medical-procedures/${procedureId}/`);
            setConfirmDeleteProcedureId(null);
            fetchPatientDetails();
        } catch {
            setError(t('patient_detail.error.delete_general'));
        }
    };

    const handleDeleteReferral = async (referralId: number) => {
        try {
            await api.delete(`/referrals/${referralId}/`);
            setConfirmDeleteReferralId(null);
            fetchPatientDetails();
        } catch {
            setError(t('patient_detail.error.delete_general'));
        }
    };

    const handleDeleteCondition = async (conditionId: number) => {
        try {
            await api.delete(`/conditions/${conditionId}/`);
            setConfirmDeleteConditionId(null);
            fetchPatientDetails();
        } catch {
            setError('Failed to delete condition.');
        }
    };

    const handleDeleteAllergy = async (allergyId: number) => {
        try {
            await api.delete(`/allergies/${allergyId}/`);
            setConfirmDeleteAllergyId(null);
            fetchPatientDetails();
        } catch {
            setError('Failed to delete allergy.');
        }
    };

    const handleConditionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            await api.post('/conditions/', { ...conditionForm, patient: id });
            setShowConditionForm(false);
            setConditionForm({ name: '', icd_code: '', status: 'active', onset_date: '', notes: '' });
            fetchPatientDetails();
        } catch {
            setError('Failed to save condition.');
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
            fetchPatientDetails();
        } catch {
            setError('Failed to save allergy.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleExportPdf = async () => {
        if (!patient || !user) return;
        const doc = new jsPDF();
        let y = 10;
        const addText = (text: string, x: number, yPos: number, size: number, style: 'normal' | 'bold' = 'normal') => {
            doc.setFontSize(size); doc.setFont('helvetica', style); doc.text(text, x, yPos);
        };
        const addSection = (title: string, yPos: number) => {
            const newY = yPos + 5; addText(title, 10, newY, 16, 'bold'); doc.line(10, newY + 2, 200, newY + 2); return newY + 10;
        };
        y = addSection(`Patient: ${patient.first_name} ${patient.last_name}`, y);
        addText(`DOB: ${patient.date_of_birth || 'N/A'} | Blood: ${patient.blood_group || 'N/A'}`, 10, y, 12); y += 10;
        if (patient.consultations?.length) {
            y = addSection('Consultations', y);
            patient.consultations.forEach(c => {
                if (y > 270) { doc.addPage(); y = 20; }
                addText(new Date(c.consultation_date).toLocaleDateString(), 10, y, 12, 'bold'); y += 7;
                addText(`Reason: ${c.reason_for_consultation}`, 10, y, 11); y += 7;
                if (c.diagnosis) { addText(`Diagnosis: ${c.diagnosis}`, 10, y, 11); y += 7; }
                y += 3;
            });
        }
        doc.save(`${patient.first_name}_${patient.last_name}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const downloadFile = async (attachmentUrl: string | null | undefined, attachmentName?: string) => {
        if (!attachmentUrl) return;
        const fileNameToUse = attachmentName || 'attachment';
        try {
            const response = await axios({ method: 'get', url: attachmentUrl, responseType: 'blob', headers: { Authorization: `Bearer ${token}` } });
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

    const TABS: { key: Tab; label: string; count?: number }[] = [
        { key: 'overview', label: 'Overview' },
        { key: 'consultations', label: 'Consultations', count: patient.consultations?.length },
        { key: 'vitals', label: 'Vitals Trend' },
        { key: 'conditions', label: 'Conditions', count: patient.conditions?.length },
        { key: 'allergies', label: 'Allergies', count: activeAllergies.length },
        { key: 'notes', label: 'Notes', count: patient.patient_notes?.length },
        { key: 'procedures', label: 'Procedures', count: patient.medical_procedures?.length },
        { key: 'referrals', label: 'Referrals', count: patient.referrals?.length },
    ];

    return (
        <>
        <div className="patient-details-container detail-container">
            {/* Header */}
            <div className="patient-info-header detail-header">
                <div>
                    <h2 className="patient-name">{patient.first_name} {patient.last_name}</h2>
                    <div className="patient-meta">
                        {patient.date_of_birth && <span>{patient.age} yrs</span>}
                        {patient.blood_group && <span className="meta-badge">{patient.blood_group}</span>}
                        <select
                            className={`patient-status-select status-${patient.status}`}
                            value={patient.status || 'active'}
                            onChange={e => handleStatusChange(e.target.value)}
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
                <div className="patient-quick-actions">
                    <button onClick={() => { setShowConsultationForm(true); setConsultationToEdit(null); setActiveTab('consultations'); }} className="pqa-btn pqa-btn--primary">+ Consultation</button>
                    {(profile?.access_level ?? 1) >= 2 && (
                        <button onClick={() => { setShowReferralForm(true); setReferralToEdit(null); setActiveTab('referrals'); }} className="pqa-btn pqa-btn--secondary">+ Referral</button>
                    )}
                    <button onClick={() => { setShowConditionForm(true); setActiveTab('conditions'); }} className="pqa-btn pqa-btn--secondary">+ Condition</button>
                    <button onClick={handleExportPdf} className="pqa-btn pqa-btn--ghost">PDF</button>
                    {/* Legacy dropdown for remaining actions */}
                    <div className="dropdown" ref={dropdownRef}>
                        <button onClick={() => setShowDropdown(!showDropdown)} className="pqa-btn pqa-btn--ghost">
                            More ▾
                        </button>
                        {showDropdown && (
                            <ul className="dropdown-menu">
                                {(profile?.access_level ?? 1) >= 2 && (
                                    <li><button onClick={() => { setShowProcedureForm(true); setProcedureToEdit(null); setShowDropdown(false); setActiveTab('procedures'); }} className="action-button dropdown-item">+ Add Procedure</button></li>
                                )}
                                <li><button onClick={() => { setShowAllergyForm(true); setShowDropdown(false); setActiveTab('allergies'); }} className="action-button dropdown-item">+ Add Allergy</button></li>
                            </ul>
                        )}
                    </div>
                </div>
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
            {showReferralForm && <ReferralForm patientId={id!} onSuccess={handleSuccess} onClose={handleCancel} referralToEdit={referralToEdit} />}

            {/* Tabs */}
            <div className="patient-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`patient-tab${activeTab === tab.key ? ' active' : ''}`}
                        onClick={() => { setActiveTab(tab.key); if (tab.key === 'vitals') fetchVitalsTrend(); }}
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
                                <button className="btn-view-all" onClick={() => setActiveTab('consultations')}>View all consultations →</button>
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
                        {patient.consultations && patient.consultations.length > 0 ? (
                            <ul className="detail-list">
                                {patient.consultations.map(c => (
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
                                        {c.medications && <div className="info-item"><strong>Medications:</strong> {c.medications}</div>}
                                        {c.medical_report && <div className="info-item"><strong>Report:</strong> {c.medical_report}</div>}
                                        {c.follow_up_date && <div className="follow-up-chip">Follow-up: {new Date(c.follow_up_date).toLocaleDateString()}</div>}
                                        <div className="vitals-row">
                                            {c.weight && <span className="vital-chip">Weight: {c.weight}kg</span>}
                                            {c.height && <span className="vital-chip">Height: {c.height}m</span>}
                                            {c.temperature && <span className="vital-chip">Temp: {c.temperature}°C</span>}
                                            {c.sp2 && <span className="vital-chip">SpO2: {c.sp2}%</span>}
                                            {c.blood_pressure && <span className="vital-chip">BP: {c.blood_pressure}</span>}
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
                                            <button onClick={() => setConfirmDeleteConditionId(c.id)} className="delete-button action-button">Delete</button>
                                        </div>
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
                                    <div className="form-group">
                                        <label>Allergen *</label>
                                        <input required value={allergyForm.allergen} onChange={e => setAllergyForm(p => ({ ...p, allergen: e.target.value }))} placeholder="e.g. Penicillin" />
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
                        {patient.medical_procedures?.length ? (
                            <ul className="detail-list">
                                {patient.medical_procedures.map(p => (
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

                {/* Referrals Tab */}
                {activeTab === 'vitals' && (
                    <div className="tab-panel">
                        <h3>Vitals History</h3>
                        {vitalsLoading ? (
                            <p className="muted">Loading vitals...</p>
                        ) : vitalsTrend.length === 0 ? (
                            <p className="muted">No vitals recorded yet. Vitals are captured during consultations.</p>
                        ) : (
                            <div className="vitals-trend-container">
                                <div className="vitals-trend-table-wrapper">
                                    <table className="vitals-trend-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Weight (kg)</th>
                                                <th>Height (cm)</th>
                                                <th>SpO₂ (%)</th>
                                                <th>Temp (°C)</th>
                                                <th>Blood Pressure</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vitalsTrend.map(v => (
                                                <tr key={v.id}>
                                                    <td>{new Date(v.consultation_date).toLocaleDateString()}</td>
                                                    <td className={v.weight ? '' : 'muted'}>{v.weight ?? '—'}</td>
                                                    <td className={v.height ? '' : 'muted'}>{v.height ?? '—'}</td>
                                                    <td className={v.sp2 ? (Number(v.sp2) < 95 ? 'vitals-warning' : '') : 'muted'}>{v.sp2 ?? '—'}</td>
                                                    <td className={v.temperature ? (Number(v.temperature) > 37.5 ? 'vitals-warning' : '') : 'muted'}>{v.temperature ?? '—'}</td>
                                                    <td className={v.blood_pressure ? '' : 'muted'}>{v.blood_pressure ?? '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Inline sparklines */}
                                {vitalsTrend.filter(v => v.weight).length >= 2 && (
                                    <div className="vitals-sparklines">
                                        <VitalSparkline
                                            label="Weight (kg)"
                                            data={vitalsTrend.filter(v => v.weight !== null).map(v => ({ x: v.consultation_date, y: Number(v.weight) }))}
                                            color="#6366f1"
                                        />
                                        {vitalsTrend.filter(v => v.sp2).length >= 2 && (
                                            <VitalSparkline
                                                label="SpO₂ (%)"
                                                data={vitalsTrend.filter(v => v.sp2 !== null).map(v => ({ x: v.consultation_date, y: Number(v.sp2) }))}
                                                color="#38a169"
                                                dangerBelow={95}
                                            />
                                        )}
                                        {vitalsTrend.filter(v => v.temperature).length >= 2 && (
                                            <VitalSparkline
                                                label="Temperature (°C)"
                                                data={vitalsTrend.filter(v => v.temperature !== null).map(v => ({ x: v.consultation_date, y: Number(v.temperature) }))}
                                                color="#ed8936"
                                                dangerAbove={37.5}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'referrals' && (
                    <div className="tab-panel">
                        <div className="tab-panel-header">
                            <h3>Referral History</h3>
                            {(profile?.access_level ?? 1) >= 2 && (
                                <button className="btn-add-primary" onClick={() => { setReferralToEdit(null); setShowReferralForm(true); }}>+ Add Referral</button>
                            )}
                        </div>
                        {patient.referrals?.length ? (
                            <ul className="detail-list">
                                {patient.referrals.map(r => (
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
        </>
    );
};

export default PatientDetails;
