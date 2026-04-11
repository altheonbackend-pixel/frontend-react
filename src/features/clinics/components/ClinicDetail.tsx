import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type Workplace, type ClinicMember, type JoinRequest } from '../../../shared/types';
import { useAuth } from '../../auth/hooks/useAuth';
import '../../../shared/styles/DetailStyles.css';
import './ClinicDetail.css';
import api from '../../../shared/services/api';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import PageLoader from '../../../shared/components/PageLoader';

interface DoctorStats { id: number; name: string; consultations: number; appointments: number; medical_procedures: number; }
interface TotalStats { doctors: number; patients: number; appointments: number; consultations: number; medical_procedures: number; }
interface ClinicStats { total_stats: TotalStats; doctors_breakdown: DoctorStats[]; }

type Tab = 'info' | 'members' | 'requests' | 'stats';

const ClinicDetail = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();

    const [clinic, setClinic] = useState<Workplace | null>(null);
    const [members, setMembers] = useState<ClinicMember[]>([]);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [stats, setStats] = useState<ClinicStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('info');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [confirmRemoveMember, setConfirmRemoveMember] = useState<ClinicMember | null>(null);
    const [joinMessage, setJoinMessage] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState('');

    const fetchClinic = async () => {
        if (!token || !id) return;
        try {
            setIsLoading(true);
            const res = await api.get(`/workplaces/${id}/`);
            setClinic(res.data);
        } catch {
            setError(t('clinics.error.detail_load'));
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMembers = async () => {
        if (!id) return;
        try {
            const res = await api.get(`/workplaces/${id}/members/`);
            setMembers(res.data);
        } catch { /* silent */ }
    };

    const fetchJoinRequests = async () => {
        if (!id || !clinic?.is_creator) return;
        try {
            const res = await api.get(`/workplaces/${id}/join_requests/`);
            setJoinRequests(res.data);
        } catch { /* silent */ }
    };

    const fetchStats = async () => {
        if (!id) return;
        try {
            const res = await api.get(`/workplaces/${id}/statistics/`);
            setStats(res.data);
        } catch { /* silent */ }
    };

    useEffect(() => { fetchClinic(); }, [id, token]);
    useEffect(() => {
        if (!clinic) return;
        fetchMembers();
        if (clinic.is_creator) fetchJoinRequests();
    }, [clinic?.id, clinic?.is_creator]);

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        if (tab === 'stats' && !stats) fetchStats();
    };

    const handleJoin = async () => {
        setActionLoading(true);
        setActionMsg('');
        try {
            const res = await api.post(`/workplaces/${id}/join/`, { message: joinMessage });
            setActionMsg(res.data.detail);
            fetchClinic();
        } catch (err: any) {
            setActionMsg(err.response?.data?.detail || 'Failed to join.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeave = async () => {
        setActionLoading(true);
        try {
            await api.post(`/workplaces/${id}/leave/`);
            fetchClinic();
        } catch (err: any) {
            setActionMsg(err.response?.data?.detail || 'Failed to leave.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveMember = async (member: ClinicMember) => {
        try {
            await api.post(`/workplaces/${id}/remove_member/`, { doctor_id: member.id });
            setConfirmRemoveMember(null);
            fetchMembers();
        } catch (err: any) {
            setActionMsg(err.response?.data?.detail || 'Failed to remove member.');
        }
    };

    const handleApproveRequest = async (reqId: number) => {
        try {
            await api.post(`/workplaces/${id}/join_requests/${reqId}/approve/`);
            fetchJoinRequests(); fetchMembers();
        } catch (err: any) {
            setActionMsg(err.response?.data?.detail || 'Failed.');
        }
    };

    const handleRejectRequest = async (reqId: number) => {
        try {
            await api.post(`/workplaces/${id}/join_requests/${reqId}/reject/`);
            fetchJoinRequests();
        } catch (err: any) {
            setActionMsg(err.response?.data?.detail || 'Failed.');
        }
    };

    const handleDeleteClinic = async () => {
        try {
            await api.delete(`/workplaces/${id}/`);
            navigate('/clinics');
        } catch {
            setError(t('clinics.error.delete_detail'));
        }
    };

    if (isLoading) return <PageLoader message={t('clinics.loading_detail')} />;
    if (error) return <div className="error-message">{error}</div>;
    if (!clinic) return <div className="loading-message">{t('clinics.not_found')}</div>;

    const TABS: { key: Tab; label: string; count?: number }[] = [
        { key: 'info', label: 'Info' },
        { key: 'members', label: 'Members', count: clinic.member_count },
        ...(clinic.is_creator ? [{ key: 'requests' as Tab, label: 'Join Requests', count: joinRequests.length }] : []),
        { key: 'stats', label: 'Statistics' },
    ];

    return (
        <div className="detail-container clinic-detail">
            {/* Header */}
            <div className="detail-header">
                <div>
                    <h1>{clinic.name}</h1>
                    <div className="clinic-meta">
                        <span className={`clinic-visibility ${clinic.is_public ? 'public' : 'private'}`}>
                            {clinic.is_public ? 'Public' : 'Private'}
                        </span>
                        <span className="clinic-policy">{clinic.join_policy_display || clinic.join_policy}</span>
                        <span className="clinic-members-count">{clinic.member_count || 0} / {clinic.max_doctors} doctors</span>
                    </div>
                </div>
                <div className="patient-actions">
                    {clinic.is_creator && (
                        <>
                            <button onClick={() => navigate(`/clinics/edit/${id}`)} className="edit-button action-button">{t('appointments.edit')}</button>
                            <button onClick={() => setShowDeleteConfirm(true)} className="delete-button action-button">{t('appointments.delete')}</button>
                        </>
                    )}
                    {!clinic.is_creator && clinic.is_member && (
                        <button onClick={handleLeave} disabled={actionLoading} className="delete-button action-button">Leave Clinic</button>
                    )}
                    {!clinic.is_member && (
                        <button onClick={handleJoin} disabled={actionLoading} className="btn-join">
                            {actionLoading ? 'Sending…' : clinic.join_policy === 'open' ? 'Join Clinic' : 'Request to Join'}
                        </button>
                    )}
                </div>
            </div>

            {actionMsg && <div className="info-message">{actionMsg}</div>}

            {/* Join message field for request-based clinics */}
            {!clinic.is_member && clinic.join_policy === 'request' && (
                <div className="join-message-field">
                    <textarea
                        placeholder="Message to clinic owner (optional)..."
                        value={joinMessage}
                        onChange={e => setJoinMessage(e.target.value)}
                        rows={2}
                    />
                </div>
            )}

            {/* Tabs */}
            <div className="patient-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`patient-tab${activeTab === tab.key ? ' active' : ''}`}
                        onClick={() => handleTabChange(tab.key)}
                    >
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && <span className="tab-count">{tab.count}</span>}
                    </button>
                ))}
            </div>

            <div className="patient-tab-content">
                {/* Info Tab */}
                {activeTab === 'info' && (
                    <div className="tab-panel">
                        <div className="detail-info-group">
                            <div className="info-item"><strong>Address:</strong> {clinic.address}</div>
                            {clinic.description && <div className="info-item"><strong>Description:</strong> {clinic.description}</div>}
                            {clinic.phone && <div className="info-item"><strong>Phone:</strong> {clinic.phone}</div>}
                            {clinic.email && <div className="info-item"><strong>Email:</strong> {clinic.email}</div>}
                            {clinic.website && <div className="info-item"><strong>Website:</strong> <a href={clinic.website} target="_blank" rel="noreferrer">{clinic.website}</a></div>}
                            {clinic.creator_details && <div className="info-item"><strong>Owner:</strong> Dr. {clinic.creator_details.full_name}</div>}
                            {clinic.created_at && <div className="info-item"><strong>Created:</strong> {new Date(clinic.created_at).toLocaleDateString()}</div>}
                        </div>
                    </div>
                )}

                {/* Members Tab */}
                {activeTab === 'members' && (
                    <div className="tab-panel">
                        <h3>Members ({members.length})</h3>
                        {members.length ? (
                            <ul className="detail-list clinic-members-list">
                                {members.map(m => (
                                    <li key={m.id} className="detail-list-item member-item">
                                        <div className="member-avatar">{m.full_name.charAt(0).toUpperCase()}</div>
                                        <div className="member-info">
                                            <div className="member-name">Dr. {m.full_name} {m.is_creator && <span className="owner-badge">Owner</span>}</div>
                                            <div className="member-specialty">{m.specialty_display || m.specialty || 'No specialty'}</div>
                                        </div>
                                        {clinic.is_creator && !m.is_creator && (
                                            <button
                                                onClick={() => setConfirmRemoveMember(m)}
                                                className="delete-button action-button"
                                                style={{ marginLeft: 'auto' }}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="muted">No members yet.</p>}
                    </div>
                )}

                {/* Join Requests Tab (creator only) */}
                {activeTab === 'requests' && clinic.is_creator && (
                    <div className="tab-panel">
                        <h3>Pending Join Requests</h3>
                        {joinRequests.length ? (
                            <ul className="detail-list">
                                {joinRequests.map(jr => (
                                    <li key={jr.id} className="detail-list-item join-request-item">
                                        <div>
                                            <div className="member-name">Dr. {jr.doctor_name}</div>
                                            {jr.doctor_specialty && <div className="member-specialty">{jr.doctor_specialty}</div>}
                                            {jr.message && <p className="request-message">"{jr.message}"</p>}
                                            <div className="request-date">{new Date(jr.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <div className="request-actions">
                                            <button onClick={() => handleApproveRequest(jr.id)} className="btn-approve">Approve</button>
                                            <button onClick={() => handleRejectRequest(jr.id)} className="delete-button action-button">Reject</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="muted">No pending join requests.</p>}
                    </div>
                )}

                {/* Stats Tab */}
                {activeTab === 'stats' && (
                    <div className="tab-panel">
                        {stats ? (
                            <>
                                <div className="detail-info-group">
                                    <h3>{t('clinics.stats.general')}</h3>
                                    <div className="clinic-stats-grid">
                                        {[
                                            { label: t('clinics.stats.doctors'), val: stats.total_stats.doctors },
                                            { label: t('clinics.stats.patients'), val: stats.total_stats.patients },
                                            { label: t('clinics.stats.appointments'), val: stats.total_stats.appointments },
                                            { label: t('clinics.stats.consultations'), val: stats.total_stats.consultations },
                                            { label: t('clinics.stats.procedures'), val: stats.total_stats.medical_procedures },
                                        ].map(s => (
                                            <div key={s.label} className="clinic-stat-card">
                                                <span className="clinic-stat-number">{s.val}</span>
                                                <span className="clinic-stat-label">{s.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="detail-info-group">
                                    <h3>{t('clinics.stats.breakdown')}</h3>
                                    <ul className="detail-list">
                                        {stats.doctors_breakdown.map(doctor => (
                                            <li key={doctor.id} className="detail-list-item">
                                                <strong>{doctor.name}</strong>
                                                <div className="clinic-doctor-stats">
                                                    <p>{t('clinics.stats.consultations')}: <strong>{doctor.consultations}</strong></p>
                                                    <p>{t('clinics.stats.appointments')}: <strong>{doctor.appointments}</strong></p>
                                                    <p>{t('clinics.stats.procedures')}: <strong>{doctor.medical_procedures}</strong></p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </>
                        ) : <p className="muted">Loading statistics...</p>}
                    </div>
                )}
            </div>

            {showDeleteConfirm && (
                <ConfirmModal message={t('clinics.error.delete_confirm')} onConfirm={handleDeleteClinic} onCancel={() => setShowDeleteConfirm(false)} />
            )}
            {confirmRemoveMember && (
                <ConfirmModal
                    message={`Remove Dr. ${confirmRemoveMember.full_name} from this clinic?`}
                    onConfirm={() => handleRemoveMember(confirmRemoveMember)}
                    onCancel={() => setConfirmRemoveMember(null)}
                />
            )}
        </div>
    );
};

export default ClinicDetail;
