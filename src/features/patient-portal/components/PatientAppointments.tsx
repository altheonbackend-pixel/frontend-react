import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { Modal, toast } from '../../../shared/components/ui';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { TelehealthJoinButton } from '../../appointments/components/TelehealthJoinButton';
import { parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import { formatPortalDate, formatPortalDateTime, formatPortalTime } from '../utils/i18n';
import RequestAppointmentModal from './RequestAppointmentModal';

const UPCOMING_STATUSES = ['pending', 'scheduled', 'confirmed', 'in_progress'];
const PAST_STATUSES = ['completed', 'cancelled', 'rejected', 'no_show', 'rescheduled'];

export default function PatientAppointments() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    usePageTitle(t('patient_portal.appointments.document_title'));
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

    const doctorIdParam = Number(searchParams.get('doctor_id') ?? 0);
    const reasonParam = searchParams.get('reason') ?? '';

    const todayLocal = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, []);

    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
    const [showHowItWorks, setShowHowItWorks] = useState(() => localStorage.getItem('appt_how_it_works_collapsed') !== '1');
    const [requestOpen, setRequestOpen] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<{ id: number; doctorName: string } | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [rescheduleTarget, setRescheduleTarget] = useState<{ id: number; doctorName: string; doctorId: number } | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rsPickDate, setRsPickDate] = useState('');
    const [rsNextDatesOpen, setRsNextDatesOpen] = useState(false);

    const { data: appointments = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.appointments(),
        queryFn: patientPortalService.getAppointments,
        staleTime: 60_000,
    });

    useEffect(() => {
        if (doctorIdParam || reasonParam) {
            setRequestOpen(true);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const { data: settings } = useQuery({
        queryKey: queryKeys.patientPortal.settings(),
        queryFn: patientPortalService.getSettings,
        staleTime: 5 * 60_000,
    });
    const patientTimezone = settings?.timezone || undefined;

    const { data: rsSlotsData, isFetching: rsSlotsLoading, isError: rsSlotsError } = useQuery({
        queryKey: ['patient', 'rs-slots', rescheduleTarget?.doctorId, rsPickDate],
        queryFn: () => patientPortalService.getAvailableSlots(rescheduleTarget!.doctorId, rsPickDate),
        enabled: !!rescheduleTarget && rsPickDate.length === 10,
        staleTime: 60_000,
        retry: 1,
    });
    const rsAvailableSlots = rsSlotsData?.slots ?? [];
    const rsDoctorAvailable = rsSlotsData?.doctor_available ?? false;

    // Same auto-open for reschedule slot picker.
    useEffect(() => {
        if (rsSlotsData && !rsSlotsLoading && (rsAvailableSlots.length === 0 || !rsDoctorAvailable)) {
            setRsNextDatesOpen(true);
        }
    }, [rsSlotsData, rsSlotsLoading, rsAvailableSlots.length, rsDoctorAvailable]);

    const { data: rsNextDatesData, isFetching: rsNextDatesLoading } = useQuery({
        queryKey: ['patient', 'rs-next-dates', rescheduleTarget?.doctorId],
        queryFn: () => patientPortalService.getNextAvailableDates(rescheduleTarget!.doctorId, 14),
        enabled: rsNextDatesOpen && !!rescheduleTarget,
        staleTime: 60_000,
    });
    const rsNextAvailableDates = rsNextDatesData?.available_dates ?? [];

    const { mutate: rescheduleAppointment, isPending: isRescheduling } = useMutation({
        mutationFn: ({ id, date }: { id: number; date: string }) =>
            patientPortalService.rescheduleAppointment(id, date),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.appointments() });
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.dashboard() });
            setRescheduleTarget(null);
            setRescheduleDate('');
            setRsPickDate('');
            toast.success(t('patient_portal.appointments.toast.reschedule_submitted'));
        },
        onError: (err) => {
            setRescheduleTarget(null);
            toast.error(parseApiError(err, t('patient_portal.appointments.error.reschedule')));
        },
    });

    const { mutate: confirmAppointment, isPending: isConfirming } = useMutation({
        mutationFn: (id: number) => patientPortalService.confirmAppointment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.appointments() });
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.dashboard() });
            toast.success(t('patient_portal.appointments.toast.confirmed'));
        },
        onError: (err) => toast.error(parseApiError(err, t('patient_portal.appointments.error.confirm'))),
    });

    const { mutate: cancelAppointment, isPending: isCancelling } = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            patientPortalService.cancelAppointment(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.appointments() });
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.dashboard() });
            setCancelTarget(null);
            setCancelReason('');
            toast.success(t('patient_portal.appointments.toast.cancelled'));
        },
        onError: (err) => {
            setCancelTarget(null);
            toast.error(parseApiError(err, t('patient_portal.appointments.error.cancel')));
        },
    });

    const upcoming = useMemo(() => appointments.filter(a => UPCOMING_STATUSES.includes(a.status)), [appointments]);
    const past = useMemo(() => appointments.filter(a => PAST_STATUSES.includes(a.status)), [appointments]);
    const activeList = tab === 'upcoming' ? upcoming : past;

    return (
        <>
            <PageHeader
                title={t('patient_portal.appointments.title')}
                subtitle={t('patient_portal.appointments.subtitle')}
                actions={
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setRequestOpen(true)}
                    >
                        {t('patient_portal.appointments.request_action')}
                    </button>
                }
            />

            {/* Request flow explainer — collapsible */}
            <SectionCard
                title={t('patient_portal.appointments.how_it_works.title')}
                action={
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => {
                            const next = !showHowItWorks;
                            setShowHowItWorks(next);
                            localStorage.setItem('appt_how_it_works_collapsed', next ? '0' : '1');
                        }}
                    >
                        {showHowItWorks ? t('patient_portal.common.hide') : t('patient_portal.common.show')}
                    </button>
                }
            >
                {showHowItWorks && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                        {([
                            ['step1', 'var(--bg-subtle)'],
                            ['step2', 'var(--accent-lighter)'],
                            ['step3', 'var(--color-info-light)'],
                        ] as [string, string][]).map(([step, bg]) => (
                            <div key={step} style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: bg }}>
                                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{t(`patient_portal.appointments.how_it_works.${step}.title`)}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t(`patient_portal.appointments.how_it_works.${step}.body`)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {/* Tab toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
                <button className={`btn btn-sm ${tab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('upcoming')}>
                    {t('patient_portal.appointments.tabs.upcoming')} {upcoming.length > 0 && <span style={{ marginLeft: '0.3rem', opacity: 0.8 }}>({upcoming.length})</span>}
                </button>
                <button className={`btn btn-sm ${tab === 'past' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('past')}>
                    {t('patient_portal.appointments.tabs.past')}
                </button>
            </div>

            {isLoading && <SectionCard title=""><TabSkeleton rows={3} /></SectionCard>}
            {isError && <div className="error-message" style={{ margin: '0 0 1rem' }}>{t('patient_portal.appointments.error.load')}</div>}

            {!isLoading && !isError && (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {activeList.map(item => (
                        <SectionCard key={item.id}>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {/* Header row: doctor + status */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.doctor_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {item.specialty}{item.clinic ? ` · ${item.clinic}` : ''}
                                        </div>
                                        <Link
                                            to={`/patient/doctor/${item.doctor_id}`}
                                            style={{ fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none', marginTop: '0.2rem', display: 'inline-block' }}
                                        >
                                            {t('patient_portal.appointments.view_profile')}
                                        </Link>
                                    </div>
                                    <StatusBadge
                                        status={item.status}
                                        label={
                                            item.status === 'pending' ? t('patient_portal.appointments.status.pending_approval') :
                                            item.status === 'scheduled' ? t('patient_portal.appointments.status.please_confirm') :
                                            item.status === 'rejected' ? t('patient_portal.appointments.status.not_approved') :
                                            item.status === 'in_progress' ? t('patient_portal.appointments.status.in_consultation') :
                                            item.status === 'rescheduled' ? t('common.status.rescheduled') :
                                            undefined
                                        }
                                    />
                                </div>

                                {/* Detail row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                            {patientTimezone ? t('patient_portal.appointments.when_with_timezone', { timezone: patientTimezone.replace('_', ' ') }) : t('patient_portal.appointments.when')}
                                        </div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatPortalDateTime(item.appointment_date, i18n.resolvedLanguage, patientTimezone)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{t('patient_portal.appointments.visit_type')}</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span>
                                                {item.appointment_type === 'telemedicine' ? t('patient_portal.appointments.type.telemedicine') : t('patient_portal.appointments.type.in_person')}
                                            </span>
                                            {item.appointment_type === 'telemedicine'
                                                && ['scheduled', 'confirmed', 'in_progress'].includes(item.status) && (
                                                <TelehealthJoinButton
                                                    appointmentId={item.id}
                                                    onJoin={() => navigate(`/patient/telehealth/${item.id}`)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{t('patient_portal.appointments.reason')}</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.reason_for_appointment}</div>
                                    </div>
                                </div>

                                {/* Instructions / status note */}
                                {(item.status === 'pending' || item.status === 'scheduled' || item.status === 'rejected' || item.portal_instructions || item.notes) && (
                                    <div style={{
                                        padding: '0.875rem',
                                        borderRadius: 'var(--radius-md)',
                                        background: item.status === 'pending'
                                            ? 'var(--color-warning-light)'
                                            : item.status === 'scheduled'
                                            ? 'var(--accent-lighter)'
                                            : item.status === 'rejected'
                                            ? 'var(--color-danger-light)'
                                            : 'var(--bg-subtle)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.875rem',
                                    }}>
                                        {item.status === 'pending'
                                            ? t('patient_portal.appointments.note.pending')
                                            : item.status === 'scheduled'
                                            ? t('patient_portal.appointments.note.scheduled')
                                            : item.status === 'rejected'
                                            ? (item.cancellation_reason
                                                ? t('patient_portal.appointments.note.rejected_with_reason', { reason: item.cancellation_reason })
                                                : t('patient_portal.appointments.note.rejected'))
                                            : item.portal_instructions || item.notes}
                                    </div>
                                )}

                                {UPCOMING_STATUSES.includes(item.status) && (item.status === 'scheduled' || item.patient_can_cancel || item.patient_can_reschedule) && (
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        {item.status === 'scheduled' && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-success"
                                                onClick={() => confirmAppointment(item.id)}
                                                disabled={isConfirming}
                                            >
                                                {isConfirming ? t('patient_portal.appointments.confirming') : t('patient_portal.appointments.confirm_action')}
                                            </button>
                                        )}
                                        {item.patient_can_reschedule && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => { setRescheduleTarget({ id: item.id, doctorName: item.doctor_name, doctorId: item.doctor_id }); setRescheduleDate(''); setRsPickDate(''); setRsNextDatesOpen(false); }}
                                                disabled={isRescheduling}
                                            >
                                                {t('patient_portal.appointments.reschedule_action')}
                                            </button>
                                        )}
                                        {item.patient_can_cancel && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-danger-outline"
                                                onClick={() => setCancelTarget({ id: item.id, doctorName: item.doctor_name })}
                                                disabled={isCancelling}
                                            >
                                                {t('common.cancel')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </SectionCard>
                    ))}

                    {activeList.length === 0 && (
                        <SectionCard empty={{ title: t('patient_portal.appointments.empty_title'), subtitle: t('patient_portal.appointments.empty_subtitle') }}>
                            {null}
                        </SectionCard>
                    )}
                </div>
            )}

            {/* ── Reschedule modal — slot picker ── */}
            <Modal
                open={!!rescheduleTarget}
                onClose={() => { setRescheduleTarget(null); setRescheduleDate(''); setRsPickDate(''); setRsNextDatesOpen(false); }}
                title={t('patient_portal.appointments.reschedule_with', { name: rescheduleTarget?.doctorName ?? '' })}
                size="md"
                footer={
                    <>
                        <button type="button" className="cancel-button" onClick={() => { setRescheduleTarget(null); setRescheduleDate(''); setRsPickDate(''); setRsNextDatesOpen(false); }}>{t('patient_portal.appointments.keep_it')}</button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!rescheduleDate || isRescheduling}
                            onClick={() => rescheduleTarget && rescheduleDate && rescheduleAppointment({ id: rescheduleTarget.id, date: rescheduleDate })}
                        >
                            {isRescheduling ? t('patient_portal.common.submitting') : t('patient_portal.appointments.request_reschedule')}
                        </button>
                    </>
                }
            >
                {rescheduleTarget && (
                    <div className="form">
                        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {t('patient_portal.appointments.reschedule_intro')}
                        </p>
                        <div className="form-group">
                            <label htmlFor="rs-pick-date">{t('patient_portal.appointments.new_date')}</label>
                            <input
                                id="rs-pick-date"
                                type="date"
                                className="input"
                                min={todayLocal}
                                value={rsPickDate}
                                onChange={e => { setRsPickDate(e.target.value); setRescheduleDate(''); setRsNextDatesOpen(false); }}
                            />
                            <div style={{ marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setRsNextDatesOpen(o => !o)}
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    {rsNextDatesOpen ? t('patient_portal.common.hide') : t('patient_portal.appointments.find_next_dates')}
                                </button>
                                {rsNextDatesOpen && (
                                    <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                                        {rsNextDatesLoading && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('patient_portal.appointments.checking_availability')}</div>}
                                        {!rsNextDatesLoading && rsNextAvailableDates.length === 0 && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('patient_portal.appointments.no_dates')}</div>}
                                        {!rsNextDatesLoading && rsNextAvailableDates.length > 0 && (
                                            <>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{t('patient_portal.appointments.next_available_hint')}</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                    {rsNextAvailableDates.map(d => (
                                                        <button
                                                            key={d}
                                                            type="button"
                                                            onClick={() => { setRsPickDate(d); setRescheduleDate(''); setRsNextDatesOpen(false); }}
                                                            style={{
                                                                padding: '0.3rem 0.75rem',
                                                                borderRadius: '999px',
                                                                border: `2px solid ${rsPickDate === d ? 'var(--accent)' : 'var(--border-default)'}`,
                                                                background: rsPickDate === d ? 'var(--accent)' : 'var(--bg-card)',
                                                                color: rsPickDate === d ? 'var(--text-inverse)' : 'var(--text-primary)',
                                                                fontWeight: rsPickDate === d ? 700 : 400,
                                                                fontSize: '0.8rem',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            {formatPortalDate(d + 'T00:00:00', i18n.resolvedLanguage, { weekday: 'short', day: 'numeric', month: 'short' })}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {rsPickDate && (
                            <div className="form-group">
                                <label>{t('patient_portal.appointments.available_time_slots')}</label>
                                {rsSlotsLoading ? (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('patient_portal.appointments.checking_availability')}</div>
                                ) : rsSlotsError ? (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-danger)', padding: '0.5rem 0.75rem', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)' }}>
                                        {t('patient_portal.appointments.error.load_slots')}
                                    </div>
                                ) : !rsDoctorAvailable ? (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-warning)', padding: '0.5rem 0.75rem', background: 'var(--color-warning-light)', borderRadius: 'var(--radius-md)' }}>
                                        {t('patient_portal.appointments.doctor_not_working')}
                                    </div>
                                ) : rsAvailableSlots.length === 0 ? (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                                        {t('patient_portal.appointments.no_open_slots')}
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            {rsAvailableSlots.map((slotIso: string) => {
                                                const isSelected = rescheduleDate === slotIso;
                                                return (
                                                    <button
                                                        key={slotIso}
                                                        type="button"
                                                        onClick={() => setRescheduleDate(slotIso)}
                                                        style={{
                                                            padding: '0.35rem 0.85rem',
                                                            borderRadius: '999px',
                                                            border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-default)'}`,
                                                            background: isSelected ? 'var(--accent)' : 'var(--bg-subtle)',
                                                            color: isSelected ? 'var(--text-inverse)' : 'var(--text-primary)',
                                                            fontWeight: isSelected ? 700 : 400,
                                                            fontSize: '0.875rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        {formatPortalTime(slotIso, i18n.resolvedLanguage, patientTimezone)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                            {t('patient_portal.appointments.times_shown_in', { timezone: patientTimezone ? patientTimezone.replace('_', ' ') : t('patient_portal.appointments.local_time') })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* ── Cancel confirmation dialog ── */}
            <Modal
                open={!!cancelTarget}
                onClose={() => { setCancelTarget(null); setCancelReason(''); }}
                title={t('patient_portal.appointments.cancel_title')}
                size="sm"
                footer={
                    <>
                        <button type="button" className="cancel-button" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>{t('patient_portal.appointments.keep_it')}</button>
                        <button
                            type="button"
                            className="btn btn-danger"
                            disabled={isCancelling}
                            onClick={() => { if (cancelTarget) cancelAppointment({ id: cancelTarget.id, reason: cancelReason || undefined }); }}
                        >
                            {isCancelling ? t('patient_portal.appointments.cancelling') : t('patient_portal.appointments.yes_cancel')}
                        </button>
                    </>
                }
            >
                {cancelTarget && (
                    <div className="form">
                        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                            {t('patient_portal.appointments.cancel_confirm', { name: cancelTarget.doctorName })}
                        </p>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="cancel-reason-patient">
                                {t('patient_portal.appointments.reason')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('patient_portal.common.optional_parenthetical')}</span>
                            </label>
                            <textarea
                                id="cancel-reason-patient"
                                rows={2}
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                placeholder={t('patient_portal.appointments.cancel_reason_placeholder')}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Request appointment modal (shared component) ── */}
            <RequestAppointmentModal
                open={requestOpen}
                onClose={() => setRequestOpen(false)}
                defaultDoctorId={doctorIdParam}
                defaultReason={reasonParam}
            />
        </>
    );
}
