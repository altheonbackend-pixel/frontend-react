import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { Modal, toast } from '../../../shared/components/ui';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import { formatPortalDate, formatPortalDateTime, formatPortalTime } from '../utils/i18n';

const UPCOMING_STATUSES = ['pending', 'scheduled', 'confirmed', 'in_progress'];
const PAST_STATUSES = ['completed', 'cancelled', 'rejected', 'no_show', 'rescheduled'];

export default function PatientAppointments() {
    const { t, i18n } = useTranslation();
    usePageTitle(t('patient_portal.appointments.document_title'));
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

    const doctorIdParam = Number(searchParams.get('doctor_id') ?? 0);
    const reasonParam = searchParams.get('reason') ?? '';

    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
    const [showHowItWorks, setShowHowItWorks] = useState(() => localStorage.getItem('appt_how_it_works_collapsed') !== '1');
    const [requestOpen, setRequestOpen] = useState(false);
    const [formData, setFormData] = useState({ doctorId: doctorIdParam, appointmentDate: '', reason: reasonParam, appointmentType: 'in_person', notes: '' });

    const [requestDate, setRequestDate] = useState('');
    const [nextDatesOpen, setNextDatesOpen] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<{ id: number; doctorName: string } | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [rescheduleTarget, setRescheduleTarget] = useState<{ id: number; doctorName: string; doctorId: number } | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rsPickDate, setRsPickDate] = useState('');

    const { data: appointments = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.appointments(),
        queryFn: patientPortalService.getAppointments,
        staleTime: 60_000,
    });

    const { data: doctors = [] } = useQuery({
        queryKey: queryKeys.patientPortal.doctors(),
        queryFn: patientPortalService.getDoctors,
        staleTime: 5 * 60_000,
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

    const { data: slotsData, isFetching: slotsLoading, isError: slotsError, error: slotsRawError } = useQuery({
        queryKey: ['patient', 'available-slots', formData.doctorId, requestDate],
        queryFn: () => patientPortalService.getAvailableSlots(formData.doctorId, requestDate),
        enabled: formData.doctorId > 0 && requestDate.length === 10,
        staleTime: 60_000,
        retry: 1,
    });
    const availableSlots = slotsData?.slots ?? [];
    const doctorAvailable = slotsData?.doctor_available ?? false;

    const { data: rsSlotsData, isFetching: rsSlotsLoading, isError: rsSlotsError } = useQuery({
        queryKey: ['patient', 'rs-slots', rescheduleTarget?.doctorId, rsPickDate],
        queryFn: () => patientPortalService.getAvailableSlots(rescheduleTarget!.doctorId, rsPickDate),
        enabled: !!rescheduleTarget && rsPickDate.length === 10,
        staleTime: 60_000,
        retry: 1,
    });
    const rsAvailableSlots = rsSlotsData?.slots ?? [];
    const rsDoctorAvailable = rsSlotsData?.doctor_available ?? false;

    const { data: nextDatesData, isFetching: nextDatesLoading } = useQuery({
        queryKey: ['patient', 'next-available-dates', formData.doctorId],
        queryFn: () => patientPortalService.getNextAvailableDates(formData.doctorId, 14),
        enabled: nextDatesOpen && formData.doctorId > 0,
        staleTime: 60_000,
    });
    const nextAvailableDates = nextDatesData?.available_dates ?? [];

    const { mutate: submitRequest, isPending: isSubmitting } = useMutation({
        mutationFn: () => patientPortalService.requestAppointment({
            doctor_id: formData.doctorId,
            // Fall back to midday when no slots exist on the chosen date (doctor confirms time on approval).
            appointment_date: formData.appointmentDate || `${requestDate}T12:00:00`,
            reason: formData.reason,
            appointment_type: formData.appointmentType,
            notes: formData.notes || undefined,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.appointments() });
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.dashboard() });
            setRequestOpen(false);
            setFormData({ doctorId: 0, appointmentDate: '', reason: '', appointmentType: 'in_person', notes: '' });
            setRequestDate('');
            toast.success(t('patient_portal.appointments.toast.request_submitted'));
        },
        onError: (err) => toast.error(parseApiError(err, t('patient_portal.common.error.submit_request'))),
    });

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

    const handleSubmitRequest = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.doctorId || !requestDate || !formData.reason.trim()) {
            toast.error(t('patient_portal.appointments.error.required_request_fields'));
            return;
        }
        if (!formData.appointmentDate && availableSlots.length > 0) {
            toast.error(t('patient_portal.appointments.error.select_time_slot'));
            return;
        }
        submitRequest();
    };

    return (
        <>
            <PageHeader
                title={t('patient_portal.appointments.title')}
                subtitle={t('patient_portal.appointments.subtitle')}
                actions={
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                            setFormData(f => ({ ...f, doctorId: 0 }));
                            setRequestOpen(true);
                        }}
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
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                            {item.appointment_type === 'telemedicine' ? t('patient_portal.appointments.type.telemedicine') : t('patient_portal.appointments.type.in_person')}
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
                                                onClick={() => { setRescheduleTarget({ id: item.id, doctorName: item.doctor_name, doctorId: item.doctor_id }); setRescheduleDate(''); setRsPickDate(''); }}
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
                onClose={() => { setRescheduleTarget(null); setRescheduleDate(''); setRsPickDate(''); }}
                title={t('patient_portal.appointments.reschedule_with', { name: rescheduleTarget?.doctorName ?? '' })}
                size="md"
                footer={
                    <>
                        <button type="button" className="cancel-button" onClick={() => setRescheduleTarget(null)}>{t('patient_portal.appointments.keep_it')}</button>
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
                                min={new Date().toISOString().slice(0, 10)}
                                value={rsPickDate}
                                onChange={e => { setRsPickDate(e.target.value); setRescheduleDate(''); }}
                            />
                        </div>
                        {rsPickDate && rsSlotsLoading && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('patient_portal.appointments.loading_slots')}</p>}
                        {rsPickDate && !rsSlotsLoading && rsSlotsError && (
                            <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{t('patient_portal.appointments.error.load_slots')}</p>
                        )}
                        {rsPickDate && !rsSlotsLoading && !rsSlotsError && rsSlotsData && !rsDoctorAvailable && (
                            <p style={{ color: 'var(--color-warning, #b45309)', fontSize: '0.875rem' }}>{t('patient_portal.appointments.doctor_not_available')}</p>
                        )}
                        {rsPickDate && !rsSlotsLoading && !rsSlotsError && rsSlotsData && rsDoctorAvailable && rsAvailableSlots.length === 0 && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('patient_portal.appointments.no_slots')}</p>
                        )}
                        {rsPickDate && !rsSlotsLoading && rsAvailableSlots.length > 0 && (
                            <div className="form-group">
                                <label>{t('patient_portal.appointments.available_slots')}</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                                    {rsAvailableSlots.map((slotIso: string) => {
                                        const label = formatPortalTime(slotIso, i18n.resolvedLanguage, patientTimezone);
                                        const isSelected = rescheduleDate === slotIso;
                                        return (
                                            <button
                                                key={slotIso}
                                                type="button"
                                                onClick={() => setRescheduleDate(slotIso)}
                                                style={{
                                                    padding: '0.5rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: isSelected ? '2px solid var(--accent)' : '1.5px solid #86efac',
                                                    background: isSelected ? 'var(--accent)' : '#dcfce7',
                                                    color: isSelected ? '#fff' : '#166534',
                                                    fontWeight: 600,
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
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

            {/* ── Request appointment modal ── */}
            <Modal
                open={requestOpen}
                onClose={() => setRequestOpen(false)}
                title={t('patient_portal.appointments.request_modal_title')}
                size="lg"
                footer={
                    <>
                        <button type="button" className="cancel-button" onClick={() => setRequestOpen(false)}>{t('common.cancel')}</button>
                        <button type="submit" form="patient-appt-form" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? t('patient_portal.common.sending') : t('patient_portal.appointments.send_request')}
                        </button>
                    </>
                }
            >
                <form id="patient-appt-form" onSubmit={handleSubmitRequest} className="form">
                    <div className="form-group">
                        <label htmlFor="doctorId">{t('patient_portal.appointments.choose_doctor')}</label>
                        <select
                            id="doctorId"
                            value={formData.doctorId}
                            onChange={e => setFormData(p => ({ ...p, doctorId: Number(e.target.value) }))}
                        >
                            <option value={0} disabled>{t('patient_portal.appointments.select_doctor')}</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>{d.full_name} · {d.specialty}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="appointmentType">{t('patient_portal.appointments.visit_type')}</label>
                        <select
                            id="appointmentType"
                            value={formData.appointmentType}
                            onChange={e => setFormData(p => ({ ...p, appointmentType: e.target.value }))}
                        >
                            <option value="in_person">{t('patient_portal.appointments.type.in_person_plain')}</option>
                            <option value="telemedicine">{t('patient_portal.appointments.type.telemedicine_plain')}</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="requestDate">{t('patient_portal.appointments.preferred_date')}</label>
                        <input
                            id="requestDate"
                            type="date"
                            value={requestDate}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={e => {
                                setRequestDate(e.target.value);
                                setFormData(p => ({ ...p, appointmentDate: '' }));
                            }}
                        />
                        {formData.doctorId > 0 && (
                            <div style={{ marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setNextDatesOpen(o => !o)}
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    {nextDatesOpen ? t('patient_portal.common.hide') : t('patient_portal.appointments.find_next_dates')}
                                </button>
                                {nextDatesOpen && (
                                    <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                                        {nextDatesLoading && (
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('patient_portal.appointments.checking_availability')}</div>
                                        )}
                                        {!nextDatesLoading && nextAvailableDates.length === 0 && (
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('patient_portal.appointments.no_dates')}</div>
                                        )}
                                        {!nextDatesLoading && nextAvailableDates.length > 0 && (
                                            <>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                                                    {t('patient_portal.appointments.next_available_hint')}
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                    {nextAvailableDates.map(d => (
                                                        <button
                                                            key={d}
                                                            type="button"
                                                            onClick={() => {
                                                                setRequestDate(d);
                                                                setFormData(p => ({ ...p, appointmentDate: '' }));
                                                                setNextDatesOpen(false);
                                                            }}
                                                            style={{
                                                                padding: '0.3rem 0.75rem',
                                                                borderRadius: '999px',
                                                                border: `2px solid ${requestDate === d ? 'var(--accent)' : 'var(--border-default)'}`,
                                                                background: requestDate === d ? 'var(--accent)' : 'var(--bg-card)',
                                                                color: requestDate === d ? '#fff' : 'var(--text-primary)',
                                                                fontWeight: requestDate === d ? 700 : 400,
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
                        )}
                    </div>
                    {requestDate && formData.doctorId > 0 && (
                        <div className="form-group">
                            <label>{t('patient_portal.appointments.available_time_slots')}</label>
                            {slotsLoading ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {t('patient_portal.appointments.checking_availability')}
                                </div>
                            ) : slotsError ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-danger)', padding: '0.5rem 0.75rem', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)' }}>
                                    {parseApiError(slotsRawError, t('patient_portal.appointments.error.load_slots_with_fallback'))}
                                </div>
                            ) : !slotsData ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {t('patient_portal.appointments.select_doctor_date')}
                                </div>
                            ) : !doctorAvailable ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-warning)', padding: '0.5rem 0.75rem', background: 'var(--color-warning-light)', borderRadius: 'var(--radius-md)' }}>
                                    {t('patient_portal.appointments.doctor_not_working')}
                                </div>
                            ) : availableSlots.length === 0 ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                                    {t('patient_portal.appointments.no_open_slots')}
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        {availableSlots.map(slot => {
                                            const isSelected = formData.appointmentDate === slot;
                                            return (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    onClick={() => setFormData(p => ({ ...p, appointmentDate: slot }))}
                                                    style={{
                                                        padding: '0.35rem 0.85rem',
                                                        borderRadius: '999px',
                                                        border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-default)'}`,
                                                        background: isSelected ? 'var(--accent)' : 'var(--bg-subtle)',
                                                        color: isSelected ? '#fff' : 'var(--text-primary)',
                                                        fontWeight: isSelected ? 700 : 400,
                                                        fontSize: '0.875rem',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    {formatPortalTime(slot, i18n.resolvedLanguage, patientTimezone)}
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
                    <div className="form-group">
                        <label htmlFor="reason">{t('patient_portal.appointments.reason_for_appointment')}</label>
                        <textarea
                            id="reason"
                            rows={4}
                            value={formData.reason}
                            onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))}
                            placeholder={t('patient_portal.appointments.reason_placeholder')}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label htmlFor="notes">
                            {t('patient_portal.appointments.additional_notes')}{' '}
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('patient_portal.common.optional_parenthetical')}</span>
                        </label>
                        <textarea
                            id="notes"
                            rows={2}
                            value={formData.notes}
                            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                            placeholder={t('patient_portal.appointments.notes_placeholder')}
                        />
                    </div>
                </form>
            </Modal>
        </>
    );
}
