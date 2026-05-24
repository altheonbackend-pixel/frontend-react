import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Modal, toast } from '../../../shared/components/ui';
import { parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import { formatPortalDate, formatPortalTime } from '../utils/i18n';
import './RequestAppointmentModal.css';

interface RequestAppointmentModalProps {
    open: boolean;
    onClose: () => void;
    /** When set, the doctor is fixed (selector hidden) — used from a doctor profile. */
    lockedDoctorId?: number;
    lockedDoctorName?: string;
    /** Seeds the selector / reason when opened (used by the Appointments deep-link). */
    defaultDoctorId?: number;
    defaultReason?: string;
    /** Pre-selects the visit type — e.g. 'telemedicine' when arriving from the online-consultation search. */
    defaultAppointmentType?: 'in_person' | 'telemedicine';
    onSuccess?: () => void;
}

/**
 * Shared "request an appointment" modal — the single booking flow used by both the
 * patient Appointments tab and the public doctor profile. Includes preferred-date
 * picking, "find next available dates", real available-time-slot selection, visit
 * type, reason and notes.
 */
export default function RequestAppointmentModal({
    open,
    onClose,
    lockedDoctorId,
    lockedDoctorName,
    defaultDoctorId = 0,
    defaultReason = '',
    defaultAppointmentType = 'in_person',
    onSuccess,
}: RequestAppointmentModalProps) {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();

    const todayLocal = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, []);

    const [doctorId, setDoctorId] = useState(lockedDoctorId ?? defaultDoctorId);
    const [appointmentType, setAppointmentType] = useState<string>(defaultAppointmentType);
    const [requestDate, setRequestDate] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [reason, setReason] = useState(defaultReason);
    const [notes, setNotes] = useState('');
    const [nextDatesOpen, setNextDatesOpen] = useState(false);

    // Re-seed each time the modal opens so it never shows stale input.
    useEffect(() => {
        if (open) {
            setDoctorId(lockedDoctorId ?? defaultDoctorId ?? 0);
            setAppointmentType(defaultAppointmentType);
            setRequestDate('');
            setAppointmentDate('');
            setReason(defaultReason ?? '');
            setNotes('');
            setNextDatesOpen(false);
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const { data: doctors = [] } = useQuery({
        queryKey: queryKeys.patientPortal.doctors(),
        queryFn: patientPortalService.getDoctors,
        enabled: open && !lockedDoctorId,
        staleTime: 5 * 60_000,
    });

    const { data: settings } = useQuery({
        queryKey: queryKeys.patientPortal.settings(),
        queryFn: patientPortalService.getSettings,
        enabled: open,
        staleTime: 5 * 60_000,
    });
    const patientTimezone = settings?.timezone || undefined;

    const { data: slotsData, isFetching: slotsLoading, isError: slotsError, error: slotsRawError } = useQuery({
        queryKey: ['patient', 'available-slots', doctorId, requestDate],
        queryFn: () => patientPortalService.getAvailableSlots(doctorId, requestDate),
        enabled: open && doctorId > 0 && requestDate.length === 10,
        staleTime: 60_000,
        retry: 1,
    });
    const availableSlots = slotsData?.slots ?? [];
    const doctorAvailable = slotsData?.doctor_available ?? false;

    useEffect(() => {
        if (slotsData && !slotsLoading && (availableSlots.length === 0 || !doctorAvailable)) {
            setNextDatesOpen(true);
        }
    }, [slotsData, slotsLoading, availableSlots.length, doctorAvailable]);

    const { data: nextDatesData, isFetching: nextDatesLoading } = useQuery({
        queryKey: ['patient', 'next-available-dates', doctorId],
        queryFn: () => patientPortalService.getNextAvailableDates(doctorId, 14),
        enabled: open && nextDatesOpen && doctorId > 0,
        staleTime: 60_000,
    });
    const nextAvailableDates = nextDatesData?.available_dates ?? [];

    const { mutate: submitRequest, isPending: isSubmitting } = useMutation({
        mutationFn: () => patientPortalService.requestAppointment({
            doctor_id: doctorId,
            appointment_date: appointmentDate || `${requestDate}T12:00:00`,
            reason: reason,
            appointment_type: appointmentType,
            notes: notes || undefined,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.appointments() });
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.dashboard() });
            toast.success(t('patient_portal.appointments.toast.request_submitted'));
            onClose();
            onSuccess?.();
        },
        onError: (err) => toast.error(parseApiError(err, t('patient_portal.common.error.submit_request'))),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!doctorId || !requestDate || !reason.trim()) {
            toast.error(t('patient_portal.appointments.error.required_request_fields'));
            return;
        }
        if (!appointmentDate && availableSlots.length > 0) {
            toast.error(t('patient_portal.appointments.error.select_time_slot'));
            return;
        }
        submitRequest();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={t('patient_portal.appointments.request_modal_title')}
            size="lg"
            dirty={!!requestDate || !!reason || !!notes}
            footer={
                <>
                    <button type="button" className="cancel-button" onClick={onClose}>{t('common.cancel')}</button>
                    <button type="submit" form="request-appt-form" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? t('patient_portal.common.sending') : t('patient_portal.appointments.send_request')}
                    </button>
                </>
            }
        >
            <form id="request-appt-form" onSubmit={handleSubmit} className="form">
                {lockedDoctorId ? (
                    lockedDoctorName && (
                        <div className="form-group">
                            <label>{t('patient_portal.appointments.choose_doctor')}</label>
                            <div className="appt-locked-doctor">{lockedDoctorName}</div>
                        </div>
                    )
                ) : (
                    <div className="form-group">
                        <label htmlFor="req-doctorId">{t('patient_portal.appointments.choose_doctor')}</label>
                        <select
                            id="req-doctorId"
                            value={doctorId}
                            onChange={e => setDoctorId(Number(e.target.value))}
                        >
                            <option value={0} disabled>{t('patient_portal.appointments.select_doctor')}</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>{d.full_name} · {d.specialty}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="req-appointmentType">{t('patient_portal.appointments.visit_type')}</label>
                    <select
                        id="req-appointmentType"
                        value={appointmentType}
                        onChange={e => setAppointmentType(e.target.value)}
                    >
                        <option value="in_person">{t('patient_portal.appointments.type.in_person_plain')}</option>
                        <option value="telemedicine">{t('patient_portal.appointments.type.telemedicine_plain')}</option>
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="req-requestDate">{t('patient_portal.appointments.preferred_date')}</label>
                    <input
                        id="req-requestDate"
                        type="date"
                        value={requestDate}
                        min={todayLocal}
                        onChange={e => {
                            setRequestDate(e.target.value);
                            setAppointmentDate('');
                            setNextDatesOpen(false);
                        }}
                    />
                    {doctorId > 0 && (
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
                                                            setAppointmentDate('');
                                                            setNextDatesOpen(false);
                                                        }}
                                                        className={`appt-chip${requestDate === d ? ' appt-chip--active' : ''}`}
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

                {requestDate && doctorId > 0 && (
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
                                    {availableSlots.map(slot => (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => setAppointmentDate(slot)}
                                            className={`appt-chip${appointmentDate === slot ? ' appt-chip--active' : ''}`}
                                        >
                                            {formatPortalTime(slot, i18n.resolvedLanguage, patientTimezone)}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                    {t('patient_portal.appointments.times_shown_in', { timezone: patientTimezone ? patientTimezone.replace('_', ' ') : t('patient_portal.appointments.local_time') })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="req-reason">{t('patient_portal.appointments.reason_for_appointment')}</label>
                    <textarea
                        id="req-reason"
                        rows={4}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder={t('patient_portal.appointments.reason_placeholder')}
                    />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="req-notes">
                        {t('patient_portal.appointments.additional_notes')}{' '}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('patient_portal.common.optional_parenthetical')}</span>
                    </label>
                    <textarea
                        id="req-notes"
                        rows={2}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder={t('patient_portal.appointments.notes_placeholder')}
                    />
                </div>
            </form>
        </Modal>
    );
}
