import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useAuth } from '../../auth/hooks/useAuth';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import api from '../../../shared/services/api';
import { formatPortalDate, formatPortalDateTime } from '../utils/i18n';
import { openDirections } from '../../../shared/utils/directions';

export default function PatientDashboard() {
    const { t, i18n } = useTranslation();
    const { patientProfile } = useAuth();
    usePageTitle(t('patient_portal.dashboard.document_title'));
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

    const firstName = patientProfile?.full_name?.split(' ')[0] ?? t('patient_portal.dashboard.fallback_name');

    if (isLoading) {
        return (
            <>
                <PageHeader title={t('patient_portal.dashboard.welcome', { name: firstName })} subtitle={t('patient_portal.dashboard.loading_summary')} />
                <div style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>{t('patient_portal.common.loading')}</div>
            </>
        );
    }

    if (isError || !data) {
        return (
            <>
                <PageHeader title={t('patient_portal.dashboard.welcome', { name: firstName })} subtitle="" />
                <div className="error-message" style={{ margin: '1rem' }}>{t('patient_portal.dashboard.error.load')}</div>
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
                title={t('patient_portal.dashboard.welcome', { name: firstName })}
                subtitle={t('patient_portal.dashboard.subtitle')}
                actions={
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleDownloadPDF}
                            disabled={downloading}
                        >
                            {downloading ? t('patient_portal.dashboard.generating') : t('patient_portal.dashboard.download_health_summary')}
                        </button>
                        <Link to="/patient/appointments" className="btn btn-primary btn-sm">{t('patient_portal.appointments.request_action')}</Link>
                    </div>
                }
            />

            {/* Compact summary strip */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {[
                    { label: t('patient_portal.dashboard.medication_count', { count: active_medications_count }), href: '/patient/health?tab=medications', color: 'var(--color-info-light)', text: 'var(--color-info, #0369a1)' },
                    { label: t('patient_portal.dashboard.condition_count', { count: conditions_count }), href: '/patient/health?tab=conditions', color: 'var(--bg-subtle)', text: 'var(--text-secondary)' },
                    ...(next_appointment ? [{ label: t('patient_portal.dashboard.appointment_upcoming'), href: '/patient/appointments', color: 'var(--accent-lighter)', text: 'var(--accent)' }] : []),
                    ...(hasActions ? [{ label: t('patient_portal.dashboard.action_count', { count: pending_appointment_requests + (unread_notifications || 0) }), href: '/patient/notifications', color: 'var(--color-warning-light)', text: 'var(--color-warning, #92400e)' }] : []),
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
                <SectionCard title={t('patient_portal.dashboard.next_appointment')} empty={{ title: t('patient_portal.dashboard.no_upcoming_appointment'), subtitle: t('patient_portal.dashboard.no_upcoming_appointment_subtitle') }}>
                    {next_appointment ? (() => {
                        // Surface "Get directions" only on the day of the appointment for
                        // in-person visits with a known clinic location — keeps the
                        // dashboard tidy and avoids stale routing.
                        const apptLocal = new Date(next_appointment.appointment_date);
                        const today = new Date();
                        const isSameDay = apptLocal.getFullYear() === today.getFullYear()
                            && apptLocal.getMonth() === today.getMonth()
                            && apptLocal.getDate() === today.getDate();
                        const isInPerson = next_appointment.appointment_type !== 'telemedicine';
                        const hasLocation = !!next_appointment.clinic_address
                            || (next_appointment.clinic_latitude != null && next_appointment.clinic_longitude != null);
                        const showDirections = isSameDay && isInPerson && hasLocation
                            && ['confirmed', 'scheduled', 'in_progress'].includes(next_appointment.status);
                        return (
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{next_appointment.doctor_name}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{next_appointment.specialty}</div>
                                    </div>
                                    <StatusBadge status={next_appointment.status} />
                                </div>
                                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>{formatPortalDateTime(next_appointment.appointment_date, i18n.resolvedLanguage)}</div>
                                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    {next_appointment.status === 'pending'
                                        ? t('patient_portal.dashboard.waiting_for_approval')
                                        : next_appointment.portal_instructions || t('patient_portal.dashboard.appointment_confirmed')}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {showDirections && (
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => openDirections({
                                                lat: next_appointment.clinic_latitude,
                                                lng: next_appointment.clinic_longitude,
                                                address: next_appointment.clinic_address,
                                                label: next_appointment.doctor_name,
                                            })}
                                        >
                                            🧭 {t('patient_portal.dashboard.start_travel')}
                                        </button>
                                    )}
                                    <Link to="/patient/appointments" style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>{t('patient_portal.dashboard.view_all_appointments')}</Link>
                                </div>
                            </div>
                        );
                    })() : null}
                </SectionCard>

                <SectionCard title={t('patient_portal.dashboard.outstanding_actions')}>
                    {!hasActions ? (
                        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {t('patient_portal.dashboard.all_caught_up')}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.625rem' }}>
                            {pending_appointment_requests > 0 && (
                                <Link to="/patient/appointments" style={{ textDecoration: 'none' }}>
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--color-warning-light)' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                            {t('patient_portal.dashboard.pending_appointment_requests', { count: pending_appointment_requests })}
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                            {t('patient_portal.dashboard.awaiting_doctor_approval')}
                                        </div>
                                    </div>
                                </Link>
                            )}
                            {unread_notifications > 0 && (
                                <Link to="/patient/notifications" style={{ textDecoration: 'none' }}>
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--color-info-light)' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                            {t('patient_portal.dashboard.unread_notifications', { count: unread_notifications })}
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                            {t('patient_portal.dashboard.tap_to_view_notifications')}
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
                title={t('patient_portal.dashboard.active_medications')}
                action={
                    <Link to="/patient/health?tab=medications" style={{ fontSize: '0.82rem', color: 'var(--accent)', textDecoration: 'none' }}>
                        {t('patient_portal.dashboard.see_all_count', { count: active_medications_count })}
                    </Link>
                }
            >
                {active_medications_count === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('patient_portal.dashboard.no_active_medications')}</div>
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
                                {t('patient_portal.dashboard.more_count', { count: active_medications_count - 5 })}
                            </Link>
                        )}
                    </div>
                )}
            </SectionCard>

            {/* Recent visit + Latest lab */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <SectionCard title={t('patient_portal.dashboard.recent_visit_summary')} empty={{ title: t('patient_portal.visits.empty_title'), subtitle: t('patient_portal.visits.empty_subtitle') }}>
                    {latest_visible_consultation ? (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatPortalDate(latest_visible_consultation.consultation_date, i18n.resolvedLanguage)}</div>
                                <Link to="/patient/health?tab=visits" style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>{t('patient_portal.common.view_all')}</Link>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{latest_visible_consultation.patient_summary || t('patient_portal.dashboard.visit_summary_available')}</div>
                        </div>
                    ) : null}
                </SectionCard>

                <SectionCard title={t('patient_portal.dashboard.latest_lab_result')} empty={{ title: t('patient_portal.labs.empty_title'), subtitle: t('patient_portal.labs.empty_subtitle_short') }}>
                    {latest_lab_result ? (
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{latest_lab_result.test_name}</div>
                                <StatusBadge status={latest_lab_result.status} />
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{formatPortalDate(latest_lab_result.test_date, i18n.resolvedLanguage)}</div>
                            <Link to="/patient/health?tab=labs" style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>{t('patient_portal.dashboard.view_all_lab_results')}</Link>
                        </div>
                    ) : null}
                </SectionCard>
            </div>
        </>
    );
}
