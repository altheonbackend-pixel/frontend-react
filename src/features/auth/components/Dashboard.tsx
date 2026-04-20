// src/features/auth/components/Dashboard.tsx
// Phase 8: Complete redesign — stat cards, quick actions, two-panel layout, empty state

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { queryKeys } from '../../../shared/queryKeys';
import { StatCard } from '../../../shared/components/StatCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { Avatar } from '../../../shared/components/Avatar';
import { SectionCard } from '../../../shared/components/SectionCard';
import type { FollowUpConsultation } from '../../../shared/types';
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

interface DashboardData {
    stats: DashboardStats;
    upcoming_appointments: UpcomingAppt[];
    recent_patients: RecentPatient[];
    due_followups: FollowUpConsultation[];
}

function getGreeting(): string {
    const hour = new Date().getHours();
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
    usePageTitle(t('pages.dashboard', 'Dashboard'));

    const { data, isLoading } = useQuery({
        queryKey: queryKeys.dashboard(),
        queryFn: async (): Promise<DashboardData> => {
            const res = await api.get('/dashboard/');
            return res.data;
        },
        staleTime: 60 * 1000,
    });

    const stats = data?.stats;
    const upcomingAppointments = data?.upcoming_appointments ?? [];
    const recentPatients = data?.recent_patients ?? [];
    const followUps = data?.due_followups ?? [];

    const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const doctorName = user?.full_name ?? profile?.full_name ?? '';

    const isNewDoctor = !isLoading && (stats?.total_patients ?? 0) === 0;

    return (
        <div>
            {/* Greeting */}
            <div className="dashboard-greeting">
                <h1>{getGreeting()}{doctorName ? `, Dr. ${doctorName.split(' ')[0]}` : ''}.</h1>
                <div className="dashboard-date">{todayStr}</div>
            </div>

            {/* Follow-up alert (shown above stats if due) */}
            {followUps.length > 0 && (
                <div className="followup-alert">
                    <div className="followup-alert-title">
                        ⚠️ {followUps.length} follow-up{followUps.length !== 1 ? 's' : ''} due
                    </div>
                    <ul className="followup-list">
                        {followUps.slice(0, 5).map(f => (
                            <li key={f.id} className="followup-item">
                                <span className="followup-date-pill">
                                    {new Date(f.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                                {f.patient_name || f.patient} — {f.reason_for_consultation}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

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
                {(stats?.pending_patient_requests ?? 0) > 0 && (
                    <StatCard
                        icon={<CalendarIcon />}
                        label="Patient Appointment Requests"
                        value={isLoading ? '…' : stats?.pending_patient_requests ?? 0}
                        variant="warning"
                        href="/appointments"
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

            {/* Two-panel layout */}
            {!isNewDoctor && (
                <div className="dashboard-panels">
                    {/* Upcoming appointments */}
                    <SectionCard
                        title="Upcoming Appointments"
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

                    {/* Recent patients */}
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
                </div>
            )}
        </div>
    );
}

export default Dashboard;
