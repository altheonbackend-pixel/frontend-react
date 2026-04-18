import { useMemo, useState } from 'react';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { Modal, toast } from '../../../shared/components/ui';
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

export default function PatientAppointments() {
    const { appointments, doctors, requestAppointment } = usePatientPortal();
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState({
        doctorId: doctors[0]?.id ?? 0,
        appointmentDate: '',
        type: 'in_person' as 'in_person' | 'telemedicine',
        reason: '',
        notes: '',
    });

    usePageTitle('Patient Appointments');

    const upcoming = useMemo(() => appointments.filter(item => ['pending', 'confirmed'].includes(item.status)), [appointments]);
    const past = useMemo(() => appointments.filter(item => ['completed', 'cancelled'].includes(item.status)), [appointments]);

    const activeList = tab === 'upcoming' ? upcoming : past;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.doctorId || !formData.appointmentDate || !formData.reason.trim()) {
            toast.error('Please choose a doctor, a time, and a reason for the visit.');
            return;
        }
        requestAppointment(formData);
        setOpen(false);
        setFormData({
            doctorId: doctors[0]?.id ?? 0,
            appointmentDate: '',
            type: 'in_person',
            reason: '',
            notes: '',
        });
        toast.success('Appointment request submitted. It now appears with pending approval.');
    };

    return (
        <>
            <PageHeader
                title="Appointments"
                subtitle="Request a visit, track approval status, and review upcoming care."
                actions={<button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>Request appointment</button>}
            />

            <SectionCard title="Request flow">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>1. Select a doctor</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Patients choose the doctor, date, and visit type from the portal.</div>
                    </div>
                    <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-lighter)' }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>2. Request stays pending</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>New requests show as pending until the doctor reviews and approves them.</div>
                    </div>
                    <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--color-info-light)' }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>3. Patient gets notified</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Once approved, the patient sees the update in appointments and notifications.</div>
                    </div>
                </div>
            </SectionCard>

            <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
                <button className={`btn btn-sm ${tab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('upcoming')}>Upcoming</button>
                <button className={`btn btn-sm ${tab === 'past' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('past')}>Past & closed</button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
                {activeList.map(item => (
                    <SectionCard key={item.id}>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.doctor_name}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.specialty} · {item.clinic}</div>
                                </div>
                                <StatusBadge status={item.status} label={item.status === 'pending' ? 'Pending approval' : undefined} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>When</div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTime(item.appointment_date)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Visit type</div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.type === 'telemedicine' ? 'Telemedicine' : 'In person'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Reason</div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.reason}</div>
                                </div>
                            </div>
                            <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: item.status === 'pending' ? 'var(--color-warning-light)' : 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                {item.status === 'pending'
                                    ? 'This request has been submitted from the patient portal and is waiting for the doctor to approve it.'
                                    : item.notes}
                            </div>
                        </div>
                    </SectionCard>
                ))}

                {activeList.length === 0 && (
                    <SectionCard empty={{ title: 'No appointments here yet', subtitle: 'Once appointments are requested or completed they will appear in this list.' }}>
                        {null}
                    </SectionCard>
                )}
            </div>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="Request a new appointment"
                size="lg"
                footer={
                    <>
                        <button type="button" className="cancel-button" onClick={() => setOpen(false)}>Cancel</button>
                        <button type="submit" form="patient-appointment-request-form" className="btn btn-primary">Send request</button>
                    </>
                }
            >
                <form id="patient-appointment-request-form" onSubmit={handleSubmit} className="form">
                    <div className="form-group">
                        <label htmlFor="doctorId">Choose doctor</label>
                        <select id="doctorId" value={formData.doctorId} onChange={e => setFormData(prev => ({ ...prev, doctorId: Number(e.target.value) }))}>
                            {doctors.map(doctor => (
                                <option key={doctor.id} value={doctor.id}>
                                    {doctor.full_name} · {doctor.specialty} · Next {formatDateTime(doctor.next_available)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label htmlFor="appointmentDate">Preferred date & time</label>
                            <input id="appointmentDate" type="datetime-local" value={formData.appointmentDate} onChange={e => setFormData(prev => ({ ...prev, appointmentDate: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="appointmentType">Visit type</label>
                            <select id="appointmentType" value={formData.type} onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'in_person' | 'telemedicine' }))}>
                                <option value="in_person">In person</option>
                                <option value="telemedicine">Telemedicine</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="reason">Reason for appointment</label>
                        <textarea id="reason" rows={4} value={formData.reason} onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))} placeholder="Briefly describe what you need help with." />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label htmlFor="notes">Additional notes</label>
                        <textarea id="notes" rows={3} value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Optional notes for the clinic or doctor." />
                    </div>
                </form>
            </Modal>
        </>
    );
}
