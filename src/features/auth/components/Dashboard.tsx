// src/features/auth/components/Dashboard.tsx
// Phase 1: Action Center — Outstanding Tasks panel + Today's Schedule + vital alerts banner

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { queryKeys } from '../../../shared/queryKeys';
import { StatCard } from '../../../shared/components/StatCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { Avatar } from '../../../shared/components/Avatar';
import { SectionCard } from '../../../shared/components/SectionCard';
import { toast } from '../../../shared/components/ui';
import type { LabResult, FollowUpConsultation } from '../../../shared/types';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

interface DashboardStats {
    total_patients: number;
    total_consultations: number;
    total_referrals: number;
    total_appointments: number;
    total_procedures: number;
    pending_referrals: number;
    pending_patient_requests: number;
    scheduled_appointments: number;
    follow_up_today: number;
    new_patients_this_week: number;
    new_consultations_this_week: number;
    pending_lab_reviews: number;
    vital_alert_patients: number;
    vital_alert_patient_list: { id: string; name: string }[];
}

interface UpcomingAppt {
    id: number;
    appointment_date: string;
    patient_details?: { first_name: string; last_name: string; unique_id: string };
    reason_for_appointment: string;
    status: string;
    status_display?: string;
}

interface RecentPatient {
    unique_id: string;
    first_name: string;
    last_name: string;
    status: string;
    status_display?: string;
}

interface PendingRequest {
    id: number;
    appointment_date: string;
    reason: string;
    appointment_type: string;
    patient_id: string;
    patient_name: string;
}

interface DashboardData {
    stats: DashboardStats;
    upcoming_appointments: UpcomingAppt[];
    recent_patients: RecentPatient[];
    due_followups: FollowUpConsultation[];
}

type TaskTab = 'labs' | 'requests' | 'followups';

function getGreeting(timezone?: string | null): string {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hour = parseInt(
        new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, hourCycle: 'h23', timeZone: tz }).format(new Date()),
        10,
    );
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

// Inline SVG icons
const PatientIcon = () => (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
);
const CalendarIcon = () => (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
);
const StethIcon = () => (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
        <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
        <circle cx="20" cy="10" r="2"/>
    </svg>
);
const ChatIcon = () => (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
);
const ListIcon = () => (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
);

function Dashboard() {
    const { t } = useTranslation();
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const qc = useQueryClient();
    usePageTitle(t('pages.dashboard', 'Dashboard'));

    const [activeTaskTab, setActiveTaskTab] = useState<TaskTab>('labs');
    const [vitalAlertDismissed, setVitalAlertDismissed] = useState(false);
    const [rejectLabModal, setRejectLabModal] = useState<{ id: number; testName: string } | null>(null);
    const [rejectLabReason, setRejectLabReason] = useState('');
    const [rejectApptModal, setRejectApptModal] = useState<{ id: number; patientName: string } | null>(null);
    const [rejectApptReason, setRejectApptReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: queryKeys.dashboard(),
        queryFn: async (): Promise<DashboardData> => {
            const res = await api.get('/dashboard/');
            return res.data;
        },
        staleTime: 60 * 1000,
    });

    const { data: pendingLabReviews = [], refetch: refetchLabs } = useQuery<LabResult[]>({
        queryKey: ['labs', 'pending-review'],
        queryFn: async () => {
            const res = await api.get('/lab-results/', { params: { review_status: 'pending_review', submitted_by_patient: true } });
            return res.data.results ?? res.data;
        },
        staleTime: 60_000,
    });

    const { data: appointmentRequests = [], refetch: refetchRequests } = useQuery<PendingRequest[]>({
        queryKey: ['appointments', 'pending-requests'],
        queryFn: async () => {
            const res = await api.get('/doctor/appointment-requests/');
            return res.data.results ?? res.data;
        },
        staleTime: 30_000,
    });

    const stats = data?.stats;
    const upcomingAppointments = data?.upcoming_appointments ?? [];
    const recentPatients = data?.recent_patients ?? [];
    const followUps = data?.due_followups ?? [];

    const timezone = ((profile as unknown) as Record<string, unknown> | null)?.timezone as string | null ?? null;
    const todayStr = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        ...(timezone ? { timeZone: timezone } : {}),
    });
    const doctorName = user?.full_name ?? profile?.full_name ?? '';
    const isNewDoctor = !isLoading && (stats?.total_patients ?? 0) === 0;

    const invalidateDashboard = () => qc.invalidateQueries({ queryKey: queryKeys.dashboard() });

    const handleAcceptLab = async (labId: number) => {
        try {
            setActionLoading(true);
            await api.post(`/lab-results/${labId}/review/`, { action: 'accept' });
            toast.success('Lab accepted.');
            refetchLabs();
            invalidateDashboard();
        } catch {
            toast.error('Failed to accept lab.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectLab = async () => {
        if (!rejectLabModal) return;
        if (!rejectLabReason.trim()) { toast.error('Please provide a rejection reason.'); return; }
        try {
            setActionLoading(true);
            await api.post(`/lab-results/${rejectLabModal.id}/review/`, { action: 'reject', rejection_reason: rejectLabReason });
            toast.success('Lab rejected.');
            setRejectLabModal(null);
            setRejectLabReason('');
            refetchLabs();
            invalidateDashboard();
        } catch {
            toast.error('Failed to reject lab.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleApproveAppt = async (apptId: number) => {
        try {
            setActionLoading(true);
            await api.post(`/appointments/${apptId}/approve/`, {});
            toast.success('Appointment approved.');
            refetchRequests();
            invalidateDashboard();
        } catch {
            toast.error('Failed to approve appointment.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectAppt = async () => {
        if (!rejectApptModal) return;
        if (!rejectApptReason.trim()) { toast.error('Please provide a reason.'); return; }
        try {
            setActionLoading(true);
            await api.post(`/appointments/${rejectApptModal.id}/reject/`, { reason: rejectApptReason });
            toast.success('Request rejected.');
            setRejectApptModal(null);
            setRejectApptReason('');
            refetchRequests();
            invalidateDashboard();
        } catch {
            toast.error('Failed to reject.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAcknowledgeFollowUp = async (consultationId: number) => {
        try {
            setActionLoading(true);
            await api.patch(`/consultations/${consultationId}/`, { follow_up_notification_sent: true });
            toast.success('Follow-up acknowledged.');
            await qc.refetchQueries({ queryKey: queryKeys.dashboard() });
        } catch {
            toast.error('Failed to acknowledge.');
        } finally {
            setActionLoading(false);
        }
    };

    const taskTabCounts: Record<TaskTab, number> = {
        labs: pendingLabReviews.length,
        requests: appointmentRequests.length,
        followups: followUps.length,
    };

    return (
        <div>
            {/* Greeting */}
            <div className="dashboard-greeting">
                <h1>{getGreeting(timezone)}{doctorName ? `, Dr. ${doctorName.split(' ')[0]}` : ''}.</h1>
                <div className="dashboard-date">{todayStr}</div>
            </div>

            {/* Vital alerts banner */}
            {!vitalAlertDismissed && (stats?.vital_alert_patients ?? 0) > 0 && (() => {
                const count = stats!.vital_alert_patients;
                const list = stats!.vital_alert_patient_list ?? [];
                const single = count === 1 && list[0];
                return (
                    <div className="vital-alerts-banner">
                        <span className="vital-alerts-icon">⚠</span>
                        <div className="vital-alerts-text">
                            {single
                                ? <><strong>{single.name}</strong> has a recent vital alert.</>
                                : <><strong>{count} patients</strong> have recent vital alerts in the last 30 days.</>
                            }
                        </div>
                        {single
                            ? <Link to={`/patients/${single.id}`} className="vital-alerts-link">View Patient →</Link>
                            : <Link to="/patients?vital_alert_recent=true" className="vital-alerts-link">Review Patients →</Link>
                        }
                        <button className="vital-alerts-dismiss" onClick={() => setVitalAlertDismissed(true)} aria-label="Dismiss">✕</button>
                    </div>
                );
            })()}

            {/* Stats grid */}
            <div className="stats-grid">
                <StatCard
                    icon={<PatientIcon />}
                    label={t('dashboard.stats.patients', 'Total Patients')}
                    value={isLoading ? '…' : stats?.total_patients ?? 0}
                    variant="default"
                    href="/patients"
                />
                <StatCard
                    icon={<StethIcon />}
                    label={t('dashboard.stats.consultations', 'Consultations')}
                    value={isLoading ? '…' : stats?.total_consultations ?? 0}
                    variant="success"
                />
                <StatCard
                    icon={<CalendarIcon />}
                    label={t('dashboard.stats.appointments', 'Appointments')}
                    value={isLoading ? '…' : stats?.total_appointments ?? 0}
                    variant="default"
                    href="/appointments"
                />
                <StatCard
                    icon={<ChatIcon />}
                    label={t('dashboard.stats.pending_referrals', 'Pending Referrals')}
                    value={isLoading ? '…' : stats?.pending_referrals ?? 0}
                    variant={stats?.pending_referrals ? 'warning' : 'default'}
                    href="/referrals"
                />
                <StatCard
                    icon={<ListIcon />}
                    label={t('dashboard.stats.procedures', 'Procedures')}
                    value={isLoading ? '…' : stats?.total_procedures ?? 0}
                    variant="default"
                />
                {(stats?.follow_up_today ?? 0) > 0 && (
                    <StatCard
                        icon={<CalendarIcon />}
                        label="Follow-ups Due Today"
                        value={isLoading ? '…' : stats?.follow_up_today ?? 0}
                        variant="warning"
                        href="/follow-ups"
                    />
                )}
                {(stats?.pending_patient_requests ?? 0) > 0 && (
                    <StatCard
                        icon={<CalendarIcon />}
                        label="Patient Appointment Requests"
                        value={isLoading ? '…' : stats?.pending_patient_requests ?? 0}
                        variant="warning"
                        href="/appointments?section=requests"
                    />
                )}
            </div>

            {/* Quick actions */}
            <div className="quick-actions">
                <Link to="/patients/add" className="btn btn-primary btn-sm">+ New Patient</Link>
                <Link to="/appointments" className="btn btn-secondary btn-sm">+ New Appointment</Link>
                <Link to="/referrals" className="btn btn-secondary btn-sm">+ New Referral</Link>
                <Link to="/my-stats" className="btn btn-ghost btn-sm">My Stats →</Link>
            </div>

            {/* Empty state for new doctors */}
            {isNewDoctor && (
                <div className="section-card" style={{ marginBottom: '1rem' }}>
                    <div className="section-card-body">
                        <div className="empty-state">
                            <div className="empty-state-icon">🏥</div>
                            <div className="empty-state-title">{t('dashboard.empty.title', 'Welcome to Altheon Connect!')}</div>
                            <div className="empty-state-subtitle">{t('dashboard.empty.subtitle', "You're all set up. Start by adding your first patient.")}</div>
                            <Link to="/patients/add" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                                Add your first patient →
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Action grid: Outstanding Tasks + Today's Schedule */}
            {!isNewDoctor && (
                <div className="dashboard-action-grid">
                    {/* Outstanding Tasks */}
                    <div className="section-card dashboard-tasks-card">
                        <div className="section-card-header">
                            <span className="section-card-title">Outstanding Tasks</span>
                        </div>
                        <div className="task-tabs">
                            {(['labs', 'requests', 'followups'] as TaskTab[]).map(tab => (
                                <button
                                    key={tab}
                                    type="button"
                                    className={`task-tab-btn${activeTaskTab === tab ? ' active' : ''}`}
                                    onClick={() => setActiveTaskTab(tab)}
                                >
                                    {tab === 'labs' ? 'Lab Reviews' : tab === 'requests' ? 'Appt Requests' : 'Follow-ups'}
                                    {taskTabCounts[tab] > 0 && (
                                        <span className="task-tab-count">{taskTabCounts[tab]}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="section-card-body" style={{ padding: 0 }}>
                            {/* Lab Reviews tab */}
                            {activeTaskTab === 'labs' && (
                                pendingLabReviews.length === 0 ? (
                                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                                        <div className="empty-state-icon">✅</div>
                                        <div className="empty-state-title">No pending lab reviews</div>
                                    </div>
                                ) : (
                                    <ul className="dashboard-task-list">
                                        {pendingLabReviews.map(lab => (
                                            <li key={lab.id} className="dashboard-task-item">
                                                <div className="task-item-info">
                                                    <div className="task-item-title">{lab.test_name}</div>
                                                    <div className="task-item-meta">
                                                        Patient: {lab.patient} ·{' '}
                                                        {new Date(lab.test_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                    </div>
                                                </div>
                                                <div className="task-item-actions">
                                                    <button
                                                        type="button"
                                                        className="btn-task-accept"
                                                        disabled={actionLoading}
                                                        onClick={() => handleAcceptLab(lab.id)}
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-task-reject"
                                                        disabled={actionLoading}
                                                        onClick={() => { setRejectLabModal({ id: lab.id, testName: lab.test_name }); setRejectLabReason(''); }}
                                                    >
                                                        Reject
                                                    </button>
                                                    <Link to={`/patients/${lab.patient}`} className="btn-task-view">View →</Link>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )
                            )}

                            {/* Appointment Requests tab */}
                            {activeTaskTab === 'requests' && (
                                appointmentRequests.length === 0 ? (
                                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                                        <div className="empty-state-icon">✅</div>
                                        <div className="empty-state-title">No pending appointment requests</div>
                                    </div>
                                ) : (
                                    <ul className="dashboard-task-list">
                                        {appointmentRequests.map(req => (
                                            <li key={req.id} className="dashboard-task-item">
                                                <div className="task-item-info">
                                                    <div className="task-item-title">{req.patient_name}</div>
                                                    <div className="task-item-meta">
                                                        {new Date(req.appointment_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                                                        {req.reason}
                                                    </div>
                                                </div>
                                                <div className="task-item-actions">
                                                    <button
                                                        type="button"
                                                        className="btn-task-accept"
                                                        disabled={actionLoading}
                                                        onClick={() => handleApproveAppt(req.id)}
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-task-reject"
                                                        disabled={actionLoading}
                                                        onClick={() => { setRejectApptModal({ id: req.id, patientName: req.patient_name }); setRejectApptReason(''); }}
                                                    >
                                                        Decline
                                                    </button>
                                                    <Link to={`/patients/${req.patient_id}`} className="btn-task-view">View →</Link>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )
                            )}

                            {/* Follow-ups Due tab */}
                            {activeTaskTab === 'followups' && (
                                followUps.length === 0 ? (
                                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                                        <div className="empty-state-icon">✅</div>
                                        <div className="empty-state-title">No follow-ups due</div>
                                    </div>
                                ) : (
                                    <ul className="dashboard-task-list">
                                        {followUps.map(f => {
                                            const isOverdue = new Date(f.follow_up_date) < new Date();
                                            return (
                                                <li key={f.id} className="dashboard-task-item">
                                                    <div className="task-item-info">
                                                        <div className="task-item-title">{f.patient_name || f.patient}</div>
                                                        <div className="task-item-meta">
                                                            <span style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: isOverdue ? 700 : 400 }}>
                                                                {isOverdue ? '⚠ Overdue · ' : ''}
                                                                {new Date(f.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                            </span>
                                                            {' · '}{f.reason_for_consultation}
                                                        </div>
                                                    </div>
                                                    <div className="task-item-actions">
                                                        <button
                                                            type="button"
                                                            className="btn-task-accept"
                                                            onClick={() => navigate(`/appointments?patient_id=${f.patient}`)}
                                                        >
                                                            Book Appt
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-task-secondary"
                                                            disabled={actionLoading}
                                                            onClick={() => handleAcknowledgeFollowUp(f.id)}
                                                        >
                                                            Acknowledge
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )
                            )}
                        </div>

                        {activeTaskTab === 'followups' && followUps.length > 0 && (
                            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-subtle)' }}>
                                <Link to="/follow-ups" style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}>View all follow-ups →</Link>
                            </div>
                        )}
                    </div>

                    {/* Today's Schedule */}
                    <SectionCard
                        title="Today's Schedule"
                        action={<Link to="/appointments" style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}>View all →</Link>}
                        loading={isLoading}
                        empty={{ title: 'No upcoming appointments', subtitle: 'New appointments will appear here.' }}
                    >
                        <ul className="dashboard-panel-list">
                            {upcomingAppointments.map(a => {
                                const apptDate = new Date(a.appointment_date);
                                return (
                                    <li key={a.id} className="dashboard-panel-item" style={{ paddingLeft: '0.75rem', paddingRight: '0.75rem' }}>
                                        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 48 }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                                {apptDate.toLocaleDateString('en-GB', { month: 'short' })}
                                            </div>
                                            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                                                {apptDate.getDate()}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                                {a.patient_details
                                                    ? <Link to={`/patients/${a.patient_details.unique_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{a.patient_details.first_name} {a.patient_details.last_name}</Link>
                                                    : 'Patient'}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {a.reason_for_appointment}
                                            </div>
                                        </div>
                                        <StatusBadge status={a.status} label={a.status_display} />
                                    </li>
                                );
                            })}
                        </ul>
                    </SectionCard>
                </div>
            )}

            {/* Recent patients */}
            {!isNewDoctor && (
                <SectionCard
                    title="Recent Patients"
                    action={<Link to="/patients" style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}>View all →</Link>}
                    loading={isLoading}
                    empty={{ title: 'No patients yet', subtitle: 'Recently viewed patients will appear here.' }}
                >
                    <ul className="dashboard-panel-list">
                        {recentPatients.map(p => (
                            <li key={p.unique_id} className="dashboard-panel-item" style={{ paddingLeft: '0.75rem', paddingRight: '0.75rem' }}>
                                <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Link
                                        to={`/patients/${p.unique_id}`}
                                        style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', textDecoration: 'none' }}
                                    >
                                        {p.first_name} {p.last_name}
                                    </Link>
                                </div>
                                <StatusBadge status={p.status} label={p.status_display} />
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}

            {/* Reject lab modal */}
            {rejectLabModal && (
                <div className="modal-overlay" onClick={() => setRejectLabModal(null)}>
                    <div className="modal-dialog" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Reject Lab: {rejectLabModal.testName}</h3>
                            <button className="modal-close" onClick={() => setRejectLabModal(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <label style={{ fontWeight: 600, fontSize: '0.875rem', display: 'block', marginBottom: '0.375rem' }}>
                                Rejection reason <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <textarea
                                value={rejectLabReason}
                                onChange={e => setRejectLabReason(e.target.value)}
                                rows={3}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                                placeholder="Explain why this document cannot be accepted…"
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary btn-sm" onClick={() => setRejectLabModal(null)}>Cancel</button>
                            <button className="btn btn-danger btn-sm" disabled={actionLoading} onClick={handleRejectLab}>
                                {actionLoading ? 'Saving…' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject appointment modal */}
            {rejectApptModal && (
                <div className="modal-overlay" onClick={() => setRejectApptModal(null)}>
                    <div className="modal-dialog" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Decline Request — {rejectApptModal.patientName}</h3>
                            <button className="modal-close" onClick={() => setRejectApptModal(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <label style={{ fontWeight: 600, fontSize: '0.875rem', display: 'block', marginBottom: '0.375rem' }}>
                                Reason for declining <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <textarea
                                value={rejectApptReason}
                                onChange={e => setRejectApptReason(e.target.value)}
                                rows={3}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                                placeholder="Reason for declining this request…"
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary btn-sm" onClick={() => setRejectApptModal(null)}>Cancel</button>
                            <button className="btn btn-danger btn-sm" disabled={actionLoading} onClick={handleRejectAppt}>
                                {actionLoading ? 'Saving…' : 'Decline'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
