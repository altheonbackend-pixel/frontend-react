// src/features/auth/components/Dashboard.tsx

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { queryKeys } from '../../../shared/queryKeys';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { Avatar } from '../../../shared/components/Avatar';
import { toast, Dialog } from '../../../shared/components/ui';
import type { LabResult } from '../../../shared/types';
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
}

type TaskTab = 'labs' | 'requests';

function getGreeting(t: (k: string, d: string) => string, timezone?: string | null): string {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hour = parseInt(
        new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, hourCycle: 'h23', timeZone: tz }).format(new Date()),
        10,
    );
    if (hour < 12) return t('dashboard.greeting.morning', 'Good morning');
    if (hour < 17) return t('dashboard.greeting.afternoon', 'Good afternoon');
    return t('dashboard.greeting.evening', 'Good evening');
}

function fmtApptTime(iso: string) {
    const d = new Date(iso);
    return {
        hour: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        day:  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    };
}

function Dashboard() {
    const { t } = useTranslation();
    const { user, profile } = useAuth();
    const qc = useQueryClient();
    usePageTitle(t('pages.dashboard', 'Dashboard'));

    const [activeTaskTab, setActiveTaskTab] = useState<TaskTab>('requests');
    const [vitalAlertDismissed, setVitalAlertDismissed] = useState(false);
    const [rejectLabModal, setRejectLabModal] = useState<{ id: number; testName: string } | null>(null);
    const [rejectApptModal, setRejectApptModal] = useState<{ id: number; patientName: string } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: queryKeys.dashboard(),
        queryFn: async (): Promise<DashboardData> => {
            const res = await api.get('/dashboard/');
            return res.data;
        },
        staleTime: 60_000,
    });

    const { data: pendingLabReviews = [] } = useQuery<LabResult[]>({
        queryKey: ['labs', 'pending-review'],
        queryFn: async () => {
            const res = await api.get('/lab-results/', { params: { review_status: 'pending_review', submitted_by_patient: true } });
            return res.data.results ?? res.data;
        },
        staleTime: 60_000,
    });

    const { data: appointmentRequests = [] } = useQuery<PendingRequest[]>({
        queryKey: ['appointments', 'pending-requests'],
        queryFn: async () => {
            const res = await api.get('/doctor/appointment-requests/');
            return res.data.results ?? res.data;
        },
        staleTime: 30_000,
    });

    const stats                = data?.stats;
    const upcomingAppointments = data?.upcoming_appointments ?? [];
    const recentPatients       = data?.recent_patients ?? [];

    const timezone   = ((profile as unknown) as Record<string, unknown> | null)?.timezone as string | null ?? null;
    const todayStr   = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        ...(timezone ? { timeZone: timezone } : {}),
    });
    const doctorName  = user?.full_name ?? profile?.full_name ?? '';
    const isNewDoctor = !isLoading && (stats?.total_patients ?? 0) === 0 &&
                        pendingLabReviews.length === 0 && appointmentRequests.length === 0;

    const taskTabCounts: Record<TaskTab, number> = {
        labs:     pendingLabReviews.length,
        requests: appointmentRequests.length,
    };

    // ── optimistic helpers ─────────────────────────────────────────────────────
    const removeLab = (id: number) =>
        qc.setQueryData<LabResult[]>(['labs', 'pending-review'], old => old?.filter(l => l.id !== id));

    const removeRequest = (id: number) =>
        qc.setQueryData<PendingRequest[]>(['appointments', 'pending-requests'], old => old?.filter(r => r.id !== id));

    // ── action handlers ────────────────────────────────────────────────────────
    const handleAcceptLab = async (labId: number) => {
        removeLab(labId);
        try {
            setActionLoading(true);
            await api.post(`/lab-results/${labId}/review/`, { action: 'accept' });
            toast.success('Lab accepted.');
            qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
        } catch {
            toast.error('Failed to accept lab.');
            qc.invalidateQueries({ queryKey: ['labs', 'pending-review'] });
        } finally {
            setActionLoading(false);
        }
    };


    const handleApproveAppt = async (apptId: number) => {
        removeRequest(apptId);
        try {
            setActionLoading(true);
            await api.post(`/appointments/${apptId}/approve/`, {});
            toast.success(t('dashboard.toast.appointment_approved', 'Appointment approved.'));
            qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
            qc.invalidateQueries({ queryKey: ['appointments'] });
        } catch {
            toast.error(t('dashboard.toast.approve_failed', 'Failed to approve.'));
            qc.invalidateQueries({ queryKey: ['appointments', 'pending-requests'] });
        } finally {
            setActionLoading(false);
        }
    };


    // ── render ─────────────────────────────────────────────────────────────────
    return (
        <div>
            {/* ── Greeting ── */}
            <div className="db-header">
                <div>
                    <h1 className="db-greeting">
                        {getGreeting(t, timezone)}{doctorName ? `, Dr. ${doctorName.split(' ')[0]}` : ''}.
                    </h1>
                    <div className="db-date">{todayStr}</div>
                </div>
            </div>

            {/* ── Vital alerts banner ── */}
            {!vitalAlertDismissed && (stats?.vital_alert_patients ?? 0) > 0 && (() => {
                const count  = stats!.vital_alert_patients;
                const list   = stats!.vital_alert_patient_list ?? [];
                const single = count === 1 && list[0];
                return (
                    <div className="vital-alerts-banner">
                        <span className="vital-alerts-icon">⚠</span>
                        <div className="vital-alerts-text">
                            {single
                                ? <><strong>{single.name}</strong> {t('dashboard.vital_alerts.single', 'has a recent vital alert.')}</>
                                : <><strong>{count} {t('common.patients', 'patients')}</strong> {t('dashboard.vital_alerts.multi', 'have recent vital alerts in the last 30 days.')}</>
                            }
                        </div>
                        {single
                            ? <Link to={`/patients/${single.id}`} className="vital-alerts-link">{t('dashboard.vital_alerts.view_patient', 'View Patient →')}</Link>
                            : <Link to="/patients?vital_alert_recent=true" className="vital-alerts-link">{t('dashboard.vital_alerts.review', 'Review →')}</Link>
                        }
                        <button className="vital-alerts-dismiss" onClick={() => setVitalAlertDismissed(true)} aria-label={t('common.dismiss', 'Dismiss')}>✕</button>
                    </div>
                );
            })()}

            {/* ── KPI row ── */}
            <div className="db-kpi-row">
                <Link to="/patients" className="db-kpi">
                    <div className="db-kpi-num">{isLoading ? '—' : stats?.total_patients ?? 0}</div>
                    <div className="db-kpi-label">{t('dashboard.kpi.total_patients', 'Total Patients')}</div>
                </Link>

                <Link to="/appointments" className="db-kpi">
                    <div className="db-kpi-num">{isLoading ? '—' : stats?.scheduled_appointments ?? 0}</div>
                    <div className="db-kpi-label">{t('dashboard.kpi.upcoming_appointments', 'Upcoming Appointments')}</div>
                </Link>

                <Link
                    to="/referrals"
                    className={`db-kpi${(stats?.pending_referrals ?? 0) > 0 ? ' db-kpi--warn' : ''}`}
                >
                    <div className={`db-kpi-num${(stats?.pending_referrals ?? 0) > 0 ? ' db-kpi-num--warn' : ''}`}>
                        {isLoading ? '—' : stats?.pending_referrals ?? 0}
                    </div>
                    <div className="db-kpi-label">{t('dashboard.kpi.pending_referrals', 'Pending Referrals')}</div>
                </Link>

                <Link
                    to="/lab-results"
                    className={`db-kpi${(stats?.pending_lab_reviews ?? 0) > 0 ? ' db-kpi--warn' : ''}`}
                >
                    <div className={`db-kpi-num${(stats?.pending_lab_reviews ?? 0) > 0 ? ' db-kpi-num--warn' : ''}`}>
                        {isLoading ? '—' : stats?.pending_lab_reviews ?? 0}
                    </div>
                    <div className="db-kpi-label">{t('dashboard.kpi.lab_reviews', 'Lab Reviews')}</div>
                </Link>
            </div>

            {/* ── Quick actions ── */}
            <div className="db-quick">
                <Link to="/patients/add"  className="btn btn-primary btn-sm">{t('dashboard.quick.new_patient', '+ New Patient')}</Link>
                <Link to="/appointments"  className="btn btn-secondary btn-sm">{t('dashboard.quick.new_appointment', '+ Appointment')}</Link>
                <Link to="/referrals"     className="btn btn-secondary btn-sm">{t('dashboard.quick.new_referral', '+ Referral')}</Link>
            </div>

            {/* ── New-doctor welcome ── */}
            {isNewDoctor && (
                <div className="db-welcome">
                    <div className="db-welcome-icon">🏥</div>
                    <div className="db-welcome-title">{t('dashboard.empty.title', 'Welcome to Altheon Connect!')}</div>
                    <div className="db-welcome-sub">{t('dashboard.empty.subtitle', "You're all set up. Start by adding your first patient.")}</div>
                    <Link to="/patients/add" className="btn btn-primary">{t('dashboard.empty.cta', 'Add your first patient →')}</Link>
                </div>
            )}

            {/* ── Main grid: Schedule + Needs Attention ── */}
            {!isNewDoctor && (
                <div className="db-main">

                    {/* Today's Schedule */}
                    <div className="db-panel">
                        <div className="db-panel-head">
                            <span className="db-panel-title">{t('dashboard.panel.upcoming', 'Upcoming')}</span>
                            <Link to="/appointments" className="db-panel-link">{t('common.view_all', 'View all →')}</Link>
                        </div>

                        {isLoading ? (
                            <div className="db-schedule-empty">{t('common.loading', 'Loading…')}</div>
                        ) : upcomingAppointments.length === 0 ? (
                            <div className="db-schedule-empty">{t('dashboard.panel.no_upcoming', 'No upcoming appointments')}</div>
                        ) : (
                            <ul className="db-schedule-list">
                                {upcomingAppointments.map(a => {
                                    const { hour, day } = fmtApptTime(a.appointment_date);
                                    return (
                                        <li key={a.id} className="db-schedule-item">
                                            <div className="db-schedule-time">
                                                <div className="db-schedule-hour">{hour}</div>
                                                <div className="db-schedule-day">{day}</div>
                                            </div>
                                            <div className="db-schedule-info">
                                                {a.patient_details ? (
                                                    <Link
                                                        to={`/patients/${a.patient_details.unique_id}`}
                                                        className="db-schedule-patient"
                                                    >
                                                        {a.patient_details.first_name} {a.patient_details.last_name}
                                                    </Link>
                                                ) : (
                                                    <span className="db-schedule-patient">{t('common.patient', 'Patient')}</span>
                                                )}
                                                <div className="db-schedule-reason">{a.reason_for_appointment}</div>
                                            </div>
                                            <StatusBadge status={a.status} label={a.status_display} />
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Needs Attention */}
                    <div className="db-panel">
                        <div className="db-panel-head">
                            <span className="db-panel-title">{t('dashboard.panel.needs_attention', 'Needs Attention')}</span>
                        </div>

                        <div className="db-tabs">
                            {(['requests', 'labs'] as TaskTab[]).map(tab => (
                                <button
                                    key={tab}
                                    type="button"
                                    className={`db-tab-btn${activeTaskTab === tab ? ' active' : ''}`}
                                    onClick={() => setActiveTaskTab(tab)}
                                >
                                    {tab === 'labs'
                                        ? t('dashboard.tab.lab_reviews', 'Lab Reviews')
                                        : t('dashboard.tab.appt_requests', 'Appt Requests')}
                                    {taskTabCounts[tab] > 0 && (
                                        <span className="db-tab-count">{taskTabCounts[tab]}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Lab Reviews */}
                        {activeTaskTab === 'labs' && (
                            pendingLabReviews.length === 0 ? (
                                <div className="db-task-empty">
                                    <div className="db-task-empty-icon">✅</div>
                                    No pending lab reviews
                                </div>
                            ) : (
                                <ul className="db-task-list">
                                    {pendingLabReviews.map(lab => (
                                        <li key={lab.id} className="db-task-item">
                                            <div className="db-task-info">
                                                <div className="db-task-title">{lab.test_name}</div>
                                                <div className="db-task-meta">
                                                    {lab.patient} · {new Date(lab.test_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                </div>
                                            </div>
                                            <div className="db-task-actions">
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
                                                    onClick={() => setRejectLabModal({ id: lab.id, testName: lab.test_name })}
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

                        {/* Appointment Requests */}
                        {activeTaskTab === 'requests' && (
                            appointmentRequests.length === 0 ? (
                                <div className="db-task-empty">
                                    <div className="db-task-empty-icon">✅</div>
                                    No pending appointment requests
                                </div>
                            ) : (
                                <ul className="db-task-list">
                                    {appointmentRequests.map(req => (
                                        <li key={req.id} className="db-task-item">
                                            <div className="db-task-info">
                                                <div className="db-task-title">{req.patient_name}</div>
                                                <div className="db-task-meta">
                                                    {new Date(req.appointment_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {req.reason}
                                                </div>
                                            </div>
                                            <div className="db-task-actions">
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
                                                    onClick={() => setRejectApptModal({ id: req.id, patientName: req.patient_name })}
                                                >
                                                    Decline
                                                </button>
                                                <Link to={`/patients/${req.patient_id}?tab=portal`} className="btn-task-view">View →</Link>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )
                        )}
                    </div>

                </div>
            )}

            {/* ── Recent Patients ── */}
            {!isNewDoctor && recentPatients.length > 0 && (
                <div className="db-panel" style={{ marginBottom: '1.5rem' }}>
                    <div className="db-panel-head">
                        <span className="db-panel-title">Recent Patients</span>
                        <Link to="/patients" className="db-panel-link">View all →</Link>
                    </div>
                    <div className="db-recent-grid">
                        {recentPatients.map(p => (
                            <Link key={p.unique_id} to={`/patients/${p.unique_id}`} className="db-recent-item">
                                <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" />
                                <span className="db-recent-name">{p.first_name} {p.last_name}</span>
                                <StatusBadge status={p.status} label={p.status_display} />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Reject Lab modal ── */}
            <Dialog
                open={!!rejectLabModal}
                onClose={() => setRejectLabModal(null)}
                onConfirm={async (reason) => {
                    if (!rejectLabModal) return;
                    const { id, testName } = rejectLabModal;
                    setRejectLabModal(null);
                    removeLab(id);
                    setActionLoading(true);
                    try {
                        await api.post(`/lab-results/${id}/review/`, { action: 'reject', rejection_reason: reason ?? '' });
                        toast.success(`Lab "${testName}" rejected.`);
                        qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
                    } catch {
                        toast.error('Failed to reject lab.');
                        qc.invalidateQueries({ queryKey: ['labs', 'pending-review'] });
                    } finally {
                        setActionLoading(false);
                    }
                }}
                title={`Reject Lab: ${rejectLabModal?.testName ?? ''}`}
                tone="danger"
                confirmLabel="Reject"
                reasonLabel="Rejection reason"
                requireReason
            />

            {/* ── Reject Appointment Request modal ── */}
            <Dialog
                open={!!rejectApptModal}
                onClose={() => setRejectApptModal(null)}
                onConfirm={async (reason) => {
                    if (!rejectApptModal) return;
                    const { id, patientName } = rejectApptModal;
                    setRejectApptModal(null);
                    removeRequest(id);
                    setActionLoading(true);
                    try {
                        await api.post(`/appointments/${id}/reject/`, { reason: reason ?? '' });
                        toast.success(`Request from ${patientName} declined.`);
                        qc.invalidateQueries({ queryKey: queryKeys.dashboard() });
                        qc.invalidateQueries({ queryKey: ['appointments'] });
                    } catch {
                        toast.error('Failed to decline.');
                        qc.invalidateQueries({ queryKey: ['appointments', 'pending-requests'] });
                    } finally {
                        setActionLoading(false);
                    }
                }}
                title={`Decline — ${rejectApptModal?.patientName ?? ''}`}
                tone="danger"
                confirmLabel="Decline"
                reasonLabel="Reason for declining"
                requireReason
            />
        </div>
    );
}

export default Dashboard;
