import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { Modal, Dialog, toast } from '../../../shared/components/ui';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

function formatDateTime(value: string) {
    return new Date(value).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

const UPCOMING_STATUSES = ['pending', 'scheduled', 'confirmed', 'in_progress'];
const PAST_STATUSES = ['completed', 'cancelled', 'no_show', 'rescheduled'];

export default function PatientAppointments() {
    usePageTitle('Patient Appointments');
    const queryClient = useQueryClient();

    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
    const [requestOpen, setRequestOpen] = useState(false);
    const [formData, setFormData] = useState({ doctorId: 0, appointmentDate: '', reason: '', appointmentType: 'in_person', notes: '' });

    const [requestDate, setRequestDate] = useState('');
    const [cancelTarget, setCancelTarget] = useState<{ id: number; doctorName: string } | null>(null);
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

    const { data: slotsData, isFetching: slotsLoading } = useQuery({
        queryKey: ['patient', 'available-slots', formData.doctorId, requestDate],
        queryFn: () => patientPortalService.getAvailableSlots(formData.doctorId, requestDate),
        enabled: formData.doctorId > 0 && requestDate.length === 10,
        staleTime: 60_000,
    });
    const availableSlots = slotsData?.slots ?? [];

    const { mutate: submitRequest, isPending: isSubmitting } = useMutation({
        mutationFn: () => patientPortalService.requestAppointment({
            doctor_id: formData.doctorId,
            appointment_date: formData.appointmentDate,
            reason: formData.reason,
            appointment_type: formData.appointmentType,
            notes: formData.notes || undefined,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.appointments() });
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
        mutationFn: (id: number) => patientPortalService.cancelAppointment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.appointments() });
            setCancelTarget(null);
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
        if (!formData.doctorId || !requestDate || !formData.appointmentDate || !formData.reason.trim()) {
            toast.error('Please choose a doctor, a date, a time slot, and a reason for the visit.');
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
                            setFormData(f => ({ ...f, doctorId: doctors[0]?.id ?? 0 }));
                            setRequestOpen(true);
                        }}
                    >
                        Request appointment
                    </button>
                }
            />

            {/* Request flow explainer */}
            <SectionCard title="How it works">
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
                                        label={item.status === 'pending' ? 'Pending approval' : undefined}
                                    />
                                </div>

                                {/* Detail row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>When</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTime(item.appointment_date)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Reason</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.reason_for_appointment}</div>
                                    </div>
                                </div>

                                {/* Instructions / status note */}
                                {(item.status === 'pending' || item.portal_instructions || item.notes) && (
                                    <div style={{
                                        padding: '0.875rem',
                                        borderRadius: 'var(--radius-md)',
                                        background: item.status === 'pending' ? 'var(--color-warning-light)' : 'var(--bg-subtle)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.875rem',
                                    }}>
                                        {item.status === 'pending'
                                            ? 'This request has been submitted and is waiting for the doctor to approve it.'
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
            <Dialog
                open={!!cancelTarget}
                tone="danger"
                title="Cancel appointment"
                message={cancelTarget
                    ? `Are you sure you want to cancel your appointment with ${cancelTarget.doctorName}? The doctor will be notified.`
                    : undefined}
                confirmLabel="Yes, cancel"
                cancelLabel="Keep it"
                onConfirm={() => { if (cancelTarget) cancelAppointment(cancelTarget.id); }}
                onClose={() => setCancelTarget(null)}
            />

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
                            <option value="phone">Phone call</option>
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
                    </div>
                    {requestDate && formData.doctorId > 0 && (
                        <div className="form-group">
                            <label>Available time slots</label>
                            {slotsLoading ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Checking availability…</div>
                            ) : availableSlots.length === 0 ? (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    No available slots on this day. Try another date.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    {availableSlots.map(slot => {
                                        const value = `${requestDate}T${slot}:00`;
                                        const isSelected = formData.appointmentDate === value;
                                        return (
                                            <button
                                                key={slot}
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, appointmentDate: value }))}
                                                style={{
                                                    padding: '0.35rem 0.85rem',
                                                    borderRadius: '999px',
                                                    border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                                    background: isSelected ? 'var(--accent)' : 'var(--bg-card)',
                                                    color: isSelected ? '#fff' : 'var(--text-primary)',
                                                    fontWeight: isSelected ? 700 : 400,
                                                    fontSize: '0.875rem',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {slot}
                                            </button>
                                        );
                                    })}
                                </div>
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
