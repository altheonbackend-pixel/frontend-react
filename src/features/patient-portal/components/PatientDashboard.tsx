import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useAuth } from '../../auth/hooks/useAuth';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import api from '../../../shared/services/api';

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
    const [downloading, setDownloading] = useState(false);

    const handleDownloadPDF = async () => {
        setDownloading(true);
        try {
            const res = await api.get('/patient/health-summary.pdf/', { responseType: 'blob' });
            const url = URL.createObjectURL(res.data as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'health-summary.pdf';
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            // fail silently — user can retry
        } finally {
            setDownloading(false);
        }
    };

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

    const {
        pending_appointment_requests,
        next_appointment,
        active_medications_count,
        active_medications,
        unread_notifications,
        latest_visible_consultation,
        latest_lab_result,
        conditions_count,
    } = data;

    const hasActions = pending_appointment_requests > 0 || unread_notifications > 0;

    return (
        <>
            <PageHeader
                title={`Welcome, ${firstName}`}
                subtitle="Your care at a glance."
                actions={
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleDownloadPDF}
                            disabled={downloading}
                        >
                            {downloading ? 'Generating…' : 'Download Health Summary'}
                        </button>
                        <Link to="/patient/appointments" className="btn btn-primary btn-sm">Request appointment</Link>
                    </div>
                }
            />

            {/* Compact summary strip */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {[
                    { label: `${active_medications_count} medication${active_medications_count !== 1 ? 's' : ''}`, href: '/patient/health?tab=medications', color: 'var(--color-info-light)', text: 'var(--color-info, #0369a1)' },
                    { label: `${conditions_count} condition${conditions_count !== 1 ? 's' : ''}`, href: '/patient/health?tab=conditions', color: 'var(--bg-subtle)', text: 'var(--text-secondary)' },
                    ...(next_appointment ? [{ label: 'Appointment upcoming', href: '/patient/appointments', color: 'var(--accent-lighter)', text: 'var(--accent)' }] : []),
                    ...(hasActions ? [{ label: `${pending_appointment_requests + (unread_notifications || 0)} action${pending_appointment_requests + (unread_notifications || 0) !== 1 ? 's' : ''} pending`, href: '/patient/notifications', color: 'var(--color-warning-light)', text: 'var(--color-warning, #92400e)' }] : []),
                ].map(chip => (
                    <Link
                        key={chip.label}
                        to={chip.href}
                        style={{
                            display: 'inline-block',
                            padding: '0.3rem 0.75rem',
                            borderRadius: '999px',
                            background: chip.color,
                            color: chip.text,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {chip.label}
                    </Link>
                ))}
            </div>

            {/* Next appointment + Outstanding actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
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
                            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {next_appointment.status === 'pending'
                                    ? 'Waiting for doctor approval.'
                                    : next_appointment.portal_instructions || 'Appointment confirmed.'}
                            </div>
                            <Link to="/patient/appointments" style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>View all appointments →</Link>
                        </div>
                    ) : null}
                </SectionCard>

                <SectionCard title="Outstanding actions">
                    {!hasActions ? (
                        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            You're all caught up — no actions needed.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.625rem' }}>
                            {pending_appointment_requests > 0 && (
                                <Link to="/patient/appointments" style={{ textDecoration: 'none' }}>
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--color-warning-light)' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                            {pending_appointment_requests} appointment {pending_appointment_requests > 1 ? 'requests' : 'request'} pending
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                            Awaiting doctor approval
                                        </div>
                                    </div>
                                </Link>
                            )}
                            {unread_notifications > 0 && (
                                <Link to="/patient/notifications" style={{ textDecoration: 'none' }}>
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--color-info-light)' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                            {unread_notifications} unread notification{unread_notifications > 1 ? 's' : ''}
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                            Tap to view in notifications
                                        </div>
                                    </div>
                                </Link>
                            )}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* Active medications */}
            <SectionCard
                title="Active medications"
                action={
                    <Link to="/patient/health?tab=medications" style={{ fontSize: '0.82rem', color: 'var(--accent)', textDecoration: 'none' }}>
                        See all ({active_medications_count}) →
                    </Link>
                }
            >
                {active_medications_count === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No active medications on record.</div>
                ) : (
                    <div style={{ display: 'grid', gap: '0.4rem' }}>
                        {(active_medications ?? []).map((med, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-subtle)',
                                    gap: '0.5rem',
                                }}
                            >
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{med.name}</span>
                                {med.note && (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', flexShrink: 0 }}>{med.note}</span>
                                )}
                            </div>
                        ))}
                        {active_medications_count > 5 && (
                            <Link
                                to="/patient/health?tab=medications"
                                style={{ fontSize: '0.82rem', color: 'var(--accent)', padding: '0.25rem 0.75rem' }}
                            >
                                + {active_medications_count - 5} more →
                            </Link>
                        )}
                    </div>
                )}
            </SectionCard>

            {/* Recent visit + Latest lab */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <SectionCard title="Recent visit summary" empty={{ title: 'No visit summaries yet', subtitle: 'Your doctor will share summaries after consultations.' }}>
                    {latest_visible_consultation ? (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatDate(latest_visible_consultation.consultation_date)}</div>
                                <Link to="/patient/health?tab=visits" style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>View all</Link>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{latest_visible_consultation.patient_summary || 'Visit summary available.'}</div>
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
                            <Link to="/patient/health?tab=labs" style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>View all lab results →</Link>
                        </div>
                    ) : null}
                </SectionCard>
            </div>
        </>
    );
}
