import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { StatCard } from '../../../shared/components/StatCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useAuth } from '../../auth/hooks/useAuth';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

function formatDateTime(value: string) {
    return new Date(value).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

export default function PatientDashboard() {
    const { patientProfile } = useAuth();
    usePageTitle('Patient Dashboard');

    const { data, isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.dashboard(),
        queryFn: patientPortalService.getDashboard,
        staleTime: 60_000,
    });

    const firstName = patientProfile?.full_name?.split(' ')[0] ?? 'there';

    if (isLoading) {
        return (
            <>
                <PageHeader title={`Welcome, ${firstName}`} subtitle="Loading your care summary…" />
                <div style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>Loading…</div>
            </>
        );
    }

    if (isError || !data) {
        return (
            <>
                <PageHeader title={`Welcome, ${firstName}`} subtitle="" />
                <div className="error-message" style={{ margin: '1rem' }}>Failed to load dashboard. Please refresh.</div>
            </>
        );
    }

    const { pending_appointment_requests, next_appointment, active_medications_count, unread_notifications, latest_visible_consultation, latest_lab_result } = data;

    return (
        <>
            <PageHeader
                title={`Welcome, ${firstName}`}
                subtitle="A calm view of your upcoming care, medications, and recent updates."
                actions={<Link to="/patient/appointments" className="btn btn-primary btn-sm">Request appointment</Link>}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <StatCard icon="📅" label="Next appointment" value={next_appointment ? 1 : 0} href="/patient/appointments" />
                <StatCard icon="💊" label="Active medications" value={active_medications_count} variant="success" href="/patient/medications" />
                <StatCard icon="🔔" label="Unread notifications" value={unread_notifications} variant={unread_notifications ? 'warning' : 'default'} href="/patient/notifications" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <SectionCard title="Next appointment" empty={{ title: 'No upcoming appointment', subtitle: 'Request a new visit when you need one.' }}>
                    {next_appointment ? (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{next_appointment.doctor_name}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{next_appointment.specialty}</div>
                                </div>
                                <StatusBadge status={next_appointment.status} />
                            </div>
                            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTime(next_appointment.appointment_date)}</div>
                            <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {next_appointment.status === 'pending'
                                    ? 'This appointment request is waiting for doctor approval.'
                                    : next_appointment.portal_instructions || 'Appointment confirmed.'}
                            </div>
                        </div>
                    ) : null}
                </SectionCard>

                <SectionCard title="Outstanding actions">
                    {pending_appointment_requests === 0 && !unread_notifications ? (
                        <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            No outstanding actions — you're all caught up.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {pending_appointment_requests > 0 && (
                                <Link
                                    to="/patient/appointments"
                                    style={{ textDecoration: 'none' }}
                                >
                                    <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--color-warning-light)', cursor: 'pointer' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            {pending_appointment_requests} appointment request{pending_appointment_requests > 1 ? 's' : ''} pending
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            Awaiting doctor approval — tap to view.
                                        </div>
                                    </div>
                                </Link>
                            )}
                            {unread_notifications > 0 && (
                                <Link
                                    to="/patient/notifications"
                                    style={{ textDecoration: 'none' }}
                                >
                                    <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--color-info-light)', cursor: 'pointer' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            {unread_notifications} unread notification{unread_notifications > 1 ? 's' : ''}
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tap to view your notifications.</div>
                                    </div>
                                </Link>
                            )}
                        </div>
                    )}
                </SectionCard>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                <SectionCard title="Recent visit summary" empty={{ title: 'No visit summaries yet', subtitle: 'Your doctor will share summaries after consultations.' }}>
                    {latest_visible_consultation ? (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatDate(latest_visible_consultation.consultation_date)}</div>
                                <Link to="/patient/visits" style={{ fontSize: '0.85rem' }}>View all</Link>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{latest_visible_consultation.patient_summary || 'Visit summary available.'}</div>
                        </div>
                    ) : null}
                </SectionCard>

                <SectionCard title="Latest lab result" empty={{ title: 'No lab results yet', subtitle: 'Lab results shared by your doctor will appear here.' }}>
                    {latest_lab_result ? (
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{latest_lab_result.test_name}</div>
                                <StatusBadge status={latest_lab_result.status} />
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{formatDate(latest_lab_result.test_date)}</div>
                            <Link to="/patient/labs" style={{ fontSize: '0.85rem' }}>View all lab results</Link>
                        </div>
                    ) : null}
                </SectionCard>
            </div>
        </>
    );
}
