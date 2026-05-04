import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { Modal, toast } from '../../../shared/components/ui';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

function formatDateTime(value: string, timeZone?: string) {
    return new Date(value).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        ...(timeZone ? { timeZone } : {}),
    });
}

function formatSlotTime(isoUtc: string, timeZone?: string) {
    return new Date(isoUtc).toLocaleString('en-GB', {
        hour: '2-digit', minute: '2-digit',
        ...(timeZone ? { timeZone } : {}),
    });
}

const UPCOMING_STATUSES = ['pending', 'scheduled', 'confirmed', 'in_progress'];
const PAST_STATUSES = ['completed', 'cancelled', 'rejected', 'no_show', 'rescheduled'];

export default function PatientAppointments() {
    usePageTitle('Patient Appointments');
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
    const [rescheduleTarget, setRescheduleTarget] = useState<{ id: number; doctorName: string } | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');

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

    const { data: slotsData, isFetching: slotsLoading } = useQuery({
        queryKey: ['patient', 'available-slots', formData.doctorId, requestDate],
        queryFn: () => patientPortalService.getAvailableSlots(formData.doctorId, requestDate),
        enabled: formData.doctorId > 0 && requestDate.length === 10,
        staleTime: 60_000,
    });
    const availableSlots = slotsData?.slots ?? [];
    const doctorAvailable = slotsData?.doctor_available ?? true;

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
            toast.success('Appointment request submitted. Awaiting doctor approval.');
        },
        onError: (err) => toast.error(parseApiError(err, 'Failed to submit request.')),
    });

    const { mutate: rescheduleAppointment, isPending: isRescheduling } = useMutation({
        mutationFn: ({ id, date }: { id: number; date: string }) =>
            patientPortalService.rescheduleAppointment(id, date),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.appointments() });
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.dashboard() });
            setRescheduleTarget(null);
            setRescheduleDate('');
            toast.success('Reschedule request submitted. Awaiting doctor approval.');
        },
        onError: (err) => {
            setRescheduleTarget(null);
            toast.error(parseApiError(err, 'Failed to reschedule appointment.'));
        },
    });

    const { mutate: cancelAppointment, isPending: isCancelling } = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
            patientPortalService.cancelAppointment(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.appointments() });
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.dashboard() });
            setCancelTarget(null);
            setCancelReason('');
            toast.success('Appointment cancelled.');
        },
        onError: (err) => {
            setCancelTarget(null);
            toast.error(parseApiError(err, 'Failed to cancel appointment.'));
        },
    });

    const upcoming = useMemo(() => appointments.filter(a => UPCOMING_STATUSES.includes(a.status)), [appointments]);
    const past = useMemo(() => appointments.filter(a => PAST_STATUSES.includes(a.status)), [appointments]);
    const activeList = tab === 'upcoming' ? upcoming : past;

    const handleSubmitRequest = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.doctorId || !requestDate || !formData.reason.trim()) {
            toast.error('Please choose a doctor, a date, and a reason for the visit.');
            return;
        }
        if (!formData.appointmentDate && availableSlots.length > 0) {
            toast.error('Please select an available time slot.');
            return;
        }
        submitRequest();
    };

    return (
        <>
            <PageHeader
                title="Appointments"
                subtitle="Request a visit, track approval status, and review upcoming care."
                actions={
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                            setFormData(f => ({ ...f, doctorId: 0 }));
                            setRequestOpen(true);
                        }}
                    >
                        Request appointment
                    </button>
                }
            />

            {/* Request flow explainer — collapsible */}
            <SectionCard
                title="How it works"
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
                        {showHowItWorks ? 'Hide' : 'Show'}
                    </button>
                }
            >
                {showHowItWorks && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                        {([
                            ['1. Select a doctor', 'Choose the doctor, preferred date, and visit reason.', 'var(--bg-subtle)'],
                            ['2. Request stays pending', 'New requests show as pending until the doctor reviews and approves.', 'var(--accent-lighter)'],
                            ['3. You get notified', 'Once approved, the appointment status updates and you get a notification.', 'var(--color-info-light)'],
                        ] as [string, string, string][]).map(([title, body, bg]) => (
                            <div key={title} style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: bg }}>
                                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{title}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{body}</div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {/* Tab toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
                <button className={`btn btn-sm ${tab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('upcoming')}>
                    Upcoming {upcoming.length > 0 && <span style={{ marginLeft: '0.3rem', opacity: 0.8 }}>({upcoming.length})</span>}
                </button>
                <button className={`btn btn-sm ${tab === 'past' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('past')}>
                    Past & closed
                </button>
            </div>

            {isLoading && <SectionCard title=""><TabSkeleton rows={3} /></SectionCard>}
            {isError && <div className="error-message" style={{ margin: '0 0 1rem' }}>Failed to load appointments. Please refresh.</div>}

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
                                            View profile →
                                        </Link>
                                    </div>
                                    <StatusBadge
                                        status={item.status}
                                        label={
                                            item.status === 'pending' ? 'Pending approval' :
                                            item.status === 'rejected' ? 'Not approved' :
                                            item.status === 'in_progress' ? 'In consultation' :
                                            item.status === 'rescheduled' ? 'Rescheduled' :
                                            undefined
                                        }
                                    />
                                </div>

                                {/* Detail row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                            When{patientTimezone ? ` · ${patientTimezone.replace('_', ' ')}` : ''}
                                        </div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTime(item.appointment_date, patientTimezone)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Visit type</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                            {item.appointment_type === 'telemedicine' ? '📹 Telemedicine (video)' : '🏥 In person'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Reason</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.reason_for_appointment}</div>
                                    </div>
                                </div>

                                {/* Instructions / status note */}
                                {(item.status === 'pending' || item.status === 'rejected' || item.portal_instructions || item.notes) && (
                                    <div style={{
                                        padding: '0.875rem',
                                        borderRadius: 'var(--radius-md)',
                                        background: item.status === 'pending'
                                            ? 'var(--color-warning-light)'
                                            : item.status === 'rejected'
                                            ? 'var(--color-danger-light)'
                                            : 'var(--bg-subtle)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.875rem',
                                    }}>
                                        {item.status === 'pending'
                                            ? 'Your request has been submitted and is waiting for the doctor to review it.'
                                            : item.status === 'rejected'
                                            ? (item.cancellation_reason
                                                ? `This request was not approved. Reason: ${item.cancellation_reason}`
                                                : 'This request was not approved. You may submit a new request for a different time.')
                                            : item.portal_instructions || item.notes}
                                    </div>
                                )}

                                {UPCOMING_STATUSES.includes(item.status) && (item.patient_can_cancel || item.patient_can_reschedule) && (
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        {item.patient_can_reschedule && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => { setRescheduleTarget({ id: item.id, doctorName: item.doctor_name }); setRescheduleDate(''); }}
                                                disabled={isRescheduling}
                                            >
                                                Reschedule
                                            </button>
                                        )}
                                        {item.patient_can_cancel && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-danger-outline"
                                                onClick={() => setCancelTarget({ id: item.id, doctorName: item.doctor_name })}
                                                disabled={isCancelling}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </SectionCard>
                    ))}

                    {activeList.length === 0 && (
                        <SectionCard empty={{ title: 'No appointments here yet', subtitle: 'Once appointments are requested or completed they will appear in this list.' }}>
                            {null}
                        </SectionCard>
                    )}
                </div>
            )}

            {/* ── Reschedule modal ── */}
            <Modal
                open={!!rescheduleTarget}
                onClose={() => { setRescheduleTarget(null); setRescheduleDate(''); }}
                title="Reschedule appointment"
                size="sm"
                footer={
                    <>
                        <button type="button" className="cancel-button" onClick={() => setRescheduleTarget(null)}>Keep it</button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!rescheduleDate || isRescheduling}
                            onClick={() => rescheduleTarget && rescheduleDate && rescheduleAppointment({ id: rescheduleTarget.id, date: rescheduleDate })}
                        >
                            {isRescheduling ? 'Submitting…' : 'Request reschedule'}
                        </button>
                    </>
                }
            >
                {rescheduleTarget && (
                    <div className="form">
                        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                            Choose a new date for your appointment with {rescheduleTarget.doctorName}. The doctor will need to approve the reschedule.
                        </p>
                        <div className="form-group">
                            <label htmlFor="reschedule-date">New date &amp; time</label>
                            <input
                                id="reschedule-date"
                                type="datetime-local"
                                min={new Date().toISOString().slice(0, 16)}
                                value={rescheduleDate}
                                onChange={e => setRescheduleDate(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Cancel confirmation dialog ── */}
            <Modal
                open={!!cancelTarget}
                onClose={() => { setCancelTarget(null); setCancelReason(''); }}
                title="Cancel appointment"
                size="sm"
                footer={
                    <>
                        <button type="button" className="cancel-button" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>Keep it</button>
                        <button
                            type="button"
                            className="btn btn-danger"
                            disabled={isCancelling}
                            onClick={() => { if (cancelTarget) cancelAppointment({ id: cancelTarget.id, reason: cancelReason || undefined }); }}
                        >
                            {isCancelling ? 'Cancelling…' : 'Yes, cancel'}
                        </button>
                    </>
                }
            >
                {cancelTarget && (
                    <div className="form">
                        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                            Are you sure you want to cancel your appointment with {cancelTarget.doctorName}? The doctor will be notified.
                        </p>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="cancel-reason-patient">
                                Reason <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                            </label>
                            <textarea
                                id="cancel-reason-patient"
                                rows={2}
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                placeholder="e.g. I'm feeling better, no longer needed."
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Request appointment modal ── */}
            <Modal
                open={requestOpen}
                onClose={() => setRequestOpen(false)}
                title="Request a new appointment"
                size="lg"
                footer={
                    <>
                        <button type="button" className="cancel-button" onClick={() => setRequestOpen(false)}>Cancel</button>
                        <button type="submit" form="patient-appt-form" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Sending…' : 'Send request'}
                        </button>
                    </>
                }
            >
                <form id="patient-appt-form" onSubmit={handleSubmitRequest} className="form">
                    <div className="form-group">
                        <label htmlFor="doctorId">Choose doctor</label>
                        <select
                            id="doctorId"
                            value={formData.doctorId}
                            onChange={e => setFormData(p => ({ ...p, doctorId: Number(e.target.value) }))}
                        >
                            <option value={0} disabled>— Select a doctor —</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>{d.full_name} · {d.specialty}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="appointmentType">Visit type</label>
                        <select
                            id="appointmentType"
                            value={formData.appointmentType}
                            onChange={e => setFormData(p => ({ ...p, appointmentType: e.target.value }))}
                        >
                            <option value="in_person">In person</option>
                            <option value="telemedicine">Telemedicine (video)</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="requestDate">Preferred date</label>
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
                                    {nextDatesOpen ? 'Hide' : 'Find next available dates →'}
                                </button>
                                {nextDatesOpen && (
                                    <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                                        {nextDatesLoading && (
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Checking availability…</div>
                                        )}
                                        {!nextDatesLoading && nextAvailableDates.length === 0 && (
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No available dates found in the next 14 days.</div>
                                        )}
                                        {!nextDatesLoading && nextAvailableDates.length > 0 && (
                                            <>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                                                    Next available — tap to select
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
                                                            {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
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
                            <label>Available time slots</label>
                            {slotsLoading ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Checking availability…</div>
                            ) : !doctorAvailable ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-warning)', padding: '0.5rem 0.75rem', background: 'var(--color-warning-light)', borderRadius: 'var(--radius-md)' }}>
                                    The doctor does not work on this day. Please choose a weekday (Monday – Friday).
                                </div>
                            ) : availableSlots.length === 0 ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                                    No open slots on this day — you can still send a request and the doctor will confirm a time.
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
                                                    {formatSlotTime(slot, patientTimezone)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                        Times shown in {patientTimezone ? patientTimezone.replace('_', ' ') : 'your local time'}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    <div className="form-group">
                        <label htmlFor="reason">Reason for appointment</label>
                        <textarea
                            id="reason"
                            rows={4}
                            value={formData.reason}
                            onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))}
                            placeholder="Briefly describe what you need help with."
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label htmlFor="notes">
                            Additional notes{' '}
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                        </label>
                        <textarea
                            id="notes"
                            rows={2}
                            value={formData.notes}
                            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Any other information for the clinic."
                        />
                    </div>
                </form>
            </Modal>
        </>
    );
}
