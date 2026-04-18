import { Link } from 'react-router-dom';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { StatCard } from '../../../shared/components/StatCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { usePatientPortal } from '../context/PatientPortalContext';

function formatDateTime(value: string) {
    return new Date(value).toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export default function PatientDashboard() {
    const { appointments, medications, labs, notifications, visits, profile } = usePatientPortal();
    usePageTitle('Patient Dashboard');

    const upcoming = appointments
        .filter(item => ['pending', 'confirmed'].includes(item.status))
        .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
    const nextAppointment = upcoming[0];
    const activeMedications = medications.filter(item => item.is_active);
    const unreadNotifications = notifications.filter(item => !item.is_read);
    const latestVisit = visits[0];
    const latestLab = labs[0];

    return (
        <>
            <PageHeader
                title={`Welcome, ${profile.full_name.split(' ')[0]}`}
                subtitle="A calm view of your upcoming care, medications, and recent updates."
                actions={<Link to="/patient/appointments" className="btn btn-primary btn-sm">Request appointment</Link>}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <StatCard icon="📅" label="Upcoming visits" value={upcoming.length} href="/patient/appointments" />
                <StatCard icon="💊" label="Active medications" value={activeMedications.length} variant="success" href="/patient/medications" />
                <StatCard icon="🧪" label="Lab results" value={labs.length} href="/patient/labs" />
                <StatCard icon="🔔" label="Unread notifications" value={unreadNotifications.length} variant={unreadNotifications.length ? 'warning' : 'default'} href="/patient/notifications" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <SectionCard title="Next appointment" empty={{ title: 'No upcoming appointment', subtitle: 'Request a new visit when you need one.' }}>
                    {nextAppointment ? (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{nextAppointment.doctor_name}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{nextAppointment.specialty} · {nextAppointment.clinic}</div>
                                </div>
                                <StatusBadge status={nextAppointment.status} />
                            </div>
                            <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTime(nextAppointment.appointment_date)}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{nextAppointment.reason}</div>
                            <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {nextAppointment.status === 'pending'
                                    ? 'This appointment request is waiting for doctor approval.'
                                    : nextAppointment.notes}
                            </div>
                        </div>
                    ) : null}
                </SectionCard>

                <SectionCard title="Outstanding actions">
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Profile review</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Check your phone number and emergency contact details before your next visit.</div>
                        </div>
                        <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-lighter)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Lab follow-up</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Your latest HbA1c result is available to review.</div>
                        </div>
                        <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--color-info-light)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Appointment requests</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>New requests appear with a pending status until the doctor approves them.</div>
                        </div>
                    </div>
                </SectionCard>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                <SectionCard title="Recent visit summary">
                    {latestVisit ? (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{latestVisit.reason_for_consultation}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{latestVisit.doctor_name} · {formatDate(latestVisit.consultation_date)}</div>
                                </div>
                                <Link to="/patient/visits" style={{ fontSize: '0.85rem' }}>View all</Link>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{latestVisit.patient_summary}</div>
                            {latestVisit.follow_up_date && (
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Follow-up suggested on {formatDate(latestVisit.follow_up_date)}</div>
                            )}
                        </div>
                    ) : null}
                </SectionCard>

                <SectionCard title="Latest updates">
                    <div style={{ display: 'grid', gap: '0.875rem' }}>
                        {latestLab && (
                            <div style={{ paddingBottom: '0.875rem', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.35rem' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{latestLab.test_name}</div>
                                    <StatusBadge status={latestLab.status} />
                                </div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{latestLab.result_value}{latestLab.unit ? ` ${latestLab.unit}` : ''} · {formatDate(latestLab.test_date)}</div>
                            </div>
                        )}
                        {notifications.slice(0, 2).map(item => (
                            <div key={item.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                <div style={{ width: 10, height: 10, borderRadius: 999, marginTop: 6, background: item.is_read ? 'var(--border-default)' : 'var(--accent)' }} />
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{item.title}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.body}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>
        </>
    );
}
