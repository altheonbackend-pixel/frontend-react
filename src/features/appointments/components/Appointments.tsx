// src/features/appointments/components/Appointments.tsx
// Phase 8: Calendar + appointment list side-by-side on desktop

import { useState } from 'react';
import Calendar from 'react-calendar';
import { useTranslation } from 'react-i18next';
import 'react-calendar/dist/Calendar.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Appointment, type Patient } from '../../../shared/types';
import AppointmentForm from './AppointmentForm';
import DeleteAppointmentModal from './DeleteAppointmentModal';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../../shared/services/api';
import { Dialog, toast, parseApiError } from '../../../shared/components/ui';
import { queryKeys } from '../../../shared/queryKeys';
import { PageHeader } from '../../../shared/components/PageHeader';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { Avatar } from '../../../shared/components/Avatar';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import '../styles/Appointments.css';

const CONSULTATION_STARTABLE = ['scheduled', 'confirmed', 'in_progress'];

interface AppointmentWithDetails extends Appointment {
    patient_details: Patient;
}

function toYYYYMM(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function toYYYYMMDD(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Status → CSS class suffix for left border color
function apptStatusClass(status: string) {
    return `appt-card appt-card--${status.replace('_', '-')}`;
}

const Appointments = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [date, setDate] = useState<Date>(new Date());
    const [currentMonth, setCurrentMonth] = useState<string>(toYYYYMM(new Date()));
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [lifecycleConfirm, setLifecycleConfirm] = useState<{ id: number; action: 'confirm' | 'complete' | 'cancel' | 'no_show' } | null>(null);
    const [rescheduleTarget, setRescheduleTarget] = useState<{ id: number } | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');

    const selectedDate = toYYYYMMDD(date);

    const { data: dotDates = [] } = useQuery({
        queryKey: queryKeys.appointments.dots(currentMonth),
        queryFn: async () => {
            const res = await api.get('/appointments/dots/', { params: { month: currentMonth } });
            return res.data as string[];
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: appointments = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.appointments.list(selectedDate),
        queryFn: async () => {
            const res = await api.get('/appointments/', { params: { date: selectedDate } });
            const list: AppointmentWithDetails[] = res.data.results ?? res.data;
            return list.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
        },
        staleTime: 60 * 1000,
    });

    const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ['appointments'] });

    const executeReschedule = async () => {
        if (!rescheduleTarget || !rescheduleDate) return;
        try {
            await api.post(`/appointments/${rescheduleTarget.id}/reschedule/`, {
                appointment_date: new Date(rescheduleDate).toISOString(),
            });
            toast.success('Appointment rescheduled. A new scheduled appointment has been created.');
            setRescheduleTarget(null);
            setRescheduleDate('');
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to reschedule appointment.'));
        }
    };

    const handleStartConsultation = async (appt: AppointmentWithDetails) => {
        try {
            const res = await api.post(`/appointments/${appt.id}/start-consultation/`);
            const { consultation_id } = res.data;
            const patientId = appt.patient_details?.unique_id ?? appt.patient;
            toast.success('Consultation started.');
            navigate(`/patients/${patientId}?tab=consultations&open_consultation=${consultation_id}`);
        } catch (err) {
            toast.error(parseApiError(err, 'Could not start consultation.'));
        }
    };

    const executeLifecycleAction = async () => {
        if (!lifecycleConfirm) return;
        try {
            await api.post(`/appointments/${lifecycleConfirm.id}/${lifecycleConfirm.action}/`);
            toast.success(t(`appointments.lifecycle.${lifecycleConfirm.action}_success`, { defaultValue: 'Appointment updated.' }));
            setLifecycleConfirm(null);
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, t('appointments.error.action')));
            setLifecycleConfirm(null);
        }
    };

    const tileClassName = ({ date: td, view }: { date: Date; view: string }) => {
        if (view === 'month' && dotDates.includes(toYYYYMMDD(td))) return 'has-appointment';
        return null;
    };

    const dateHeading = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <>
            <PageHeader
                title={t('appointments.title', 'Appointments')}
                actions={
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate('/deleted-appointments')}
                    >
                        Deleted appointments
                    </button>
                }
            />

            {/* Side-by-side layout on desktop */}
            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.25rem', alignItems: 'start' }}>
                {/* Calendar panel */}
                <div className="section-card">
                    <div className="section-card-body" style={{ padding: '1rem' }}>
                        <Calendar
                            onChange={(v) => { if (v instanceof Date) setDate(v); }}
                            value={date}
                            tileClassName={tileClassName}
                            onActiveStartDateChange={({ activeStartDate }) => {
                                if (activeStartDate) setCurrentMonth(toYYYYMM(activeStartDate));
                            }}
                        />
                    </div>
                </div>

                {/* Appointments list panel */}
                <div className="section-card">
                    <div className="section-card-header">
                        <span className="section-card-title">{dateHeading}</span>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => { setSelectedAppointment(null); setIsFormVisible(true); }}
                        >
                            + {t('appointments.create_button', 'New Appointment')}
                        </button>
                    </div>

                    <div className="section-card-body section-card-body--flush">
                        {isLoading && <div style={{ padding: '1.25rem' }}><TabSkeleton rows={4} /></div>}
                        {isError && <div className="error-message" style={{ margin: '1rem' }}>{t('appointments.error.load')}</div>}

                        {!isLoading && !isError && appointments.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">📅</div>
                                <div className="empty-state-title">{t('appointments.no_appointments', 'No appointments on this day')}</div>
                                <div className="empty-state-subtitle">Click "New Appointment" to schedule one.</div>
                            </div>
                        )}

                        {appointments.map(appt => {
                            const apptDate = new Date(appt.appointment_date);
                            const patientName = appt.patient_details
                                ? `${appt.patient_details.first_name} ${appt.patient_details.last_name}`
                                : 'Patient';

                            return (
                                <div key={appt.id} className={apptStatusClass(appt.status)} style={{ margin: '0.75rem' }}>
                                    {/* Card header row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                        <Avatar name={patientName} size="sm" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                                                    {appt.patient_details
                                                        ? <Link to={`/patients/${appt.patient_details.unique_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{patientName}</Link>
                                                        : patientName}
                                                </span>
                                                <StatusBadge status={appt.status} label={appt.status_display} />
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                🕐 {apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>

                                    {appt.reason_for_appointment && (
                                        <div style={{ fontSize: '0.8375rem', color: 'var(--text-secondary)', marginBottom: '0.625rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border-subtle)' }}>
                                            {appt.reason_for_appointment}
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                        {CONSULTATION_STARTABLE.includes(appt.status) && appt.patient_details && (
                                            <button
                                                onClick={() => handleStartConsultation(appt)}
                                                className="btn btn-primary btn-sm"
                                                aria-label="Start consultation"
                                            >
                                                + Consult
                                            </button>
                                        )}
                                        {(appt.status === 'scheduled' || appt.status === 'pending') && (
                                            <button
                                                onClick={() => setLifecycleConfirm({ id: appt.id, action: 'confirm' })}
                                                className="btn btn-success btn-sm"
                                                aria-label="Confirm appointment"
                                            >
                                                Confirm
                                            </button>
                                        )}
                                        {(appt.status === 'confirmed' || appt.status === 'in_progress') && (
                                            <button
                                                onClick={() => setLifecycleConfirm({ id: appt.id, action: 'complete' })}
                                                className="btn btn-secondary btn-sm"
                                                aria-label="Mark as completed"
                                            >
                                                Complete
                                            </button>
                                        )}
                                        {!['cancelled', 'completed', 'no_show'].includes(appt.status) && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        const dt = new Date(appt.appointment_date);
                                                        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                                        setRescheduleDate(local);
                                                        setRescheduleTarget({ id: appt.id });
                                                    }}
                                                    className="btn btn-muted btn-sm"
                                                    aria-label="Reschedule appointment"
                                                >
                                                    Reschedule
                                                </button>
                                                <button
                                                    onClick={() => setLifecycleConfirm({ id: appt.id, action: 'cancel' })}
                                                    className="btn-danger-outline btn-sm"
                                                    aria-label="Cancel appointment"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        )}
                                        {(appt.status === 'confirmed' || appt.status === 'scheduled') && (
                                            <button
                                                onClick={() => setLifecycleConfirm({ id: appt.id, action: 'no_show' })}
                                                className="btn btn-muted btn-sm"
                                                aria-label="Mark as no-show"
                                            >
                                                No Show
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setSelectedAppointment(appt); setIsFormVisible(true); }}
                                            className="btn btn-ghost btn-sm"
                                            aria-label="Edit appointment"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => { setSelectedAppointment(appt); setIsDeleteModalVisible(true); }}
                                            className="btn-danger-outline btn-sm"
                                            aria-label="Delete appointment"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Forms & Modals */}
            {isFormVisible && (
                <AppointmentForm
                    initialDate={date}
                    appointment={selectedAppointment}
                    onSuccess={() => { setIsFormVisible(false); setSelectedAppointment(null); invalidateAll(); }}
                    onCancel={() => { setIsFormVisible(false); setSelectedAppointment(null); }}
                />
            )}

            {isDeleteModalVisible && selectedAppointment && (
                <DeleteAppointmentModal
                    appointment={selectedAppointment}
                    onSuccess={() => { setIsDeleteModalVisible(false); setSelectedAppointment(null); invalidateAll(); }}
                    onCancel={() => { setIsDeleteModalVisible(false); setSelectedAppointment(null); }}
                />
            )}

            <Dialog
                open={lifecycleConfirm !== null}
                onClose={() => setLifecycleConfirm(null)}
                onConfirm={executeLifecycleAction}
                title={lifecycleConfirm
                    ? t(`appointments.lifecycle.${lifecycleConfirm.action}_title`, { defaultValue: `${lifecycleConfirm.action.charAt(0).toUpperCase() + lifecycleConfirm.action.slice(1).replace('_', ' ')} appointment?` })
                    : ''}
                message={lifecycleConfirm
                    ? t(`appointments.lifecycle.${lifecycleConfirm.action}_message`, { defaultValue: 'This action will update the appointment status. Are you sure?' })
                    : ''}
                tone={lifecycleConfirm?.action === 'cancel' || lifecycleConfirm?.action === 'no_show' ? 'danger' : 'warning'}
                confirmLabel={lifecycleConfirm ? lifecycleConfirm.action.charAt(0).toUpperCase() + lifecycleConfirm.action.slice(1).replace('_', ' ') : ''}
            />

            {/* BUG-07 fix: Reschedule now uses shared Modal pattern */}
            {rescheduleTarget && (
                <div className="modal-overlay" onClick={() => setRescheduleTarget(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <h3 className="modal-title">Reschedule Appointment</h3>
                        <p className="modal-desc" style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            Select a new date and time. The current appointment will be marked as rescheduled.
                        </p>
                        <div className="form-field">
                            <label htmlFor="reschedule-date">New Date &amp; Time</label>
                            <input
                                id="reschedule-date"
                                type="datetime-local"
                                className="input"
                                value={rescheduleDate}
                                onChange={e => setRescheduleDate(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRescheduleTarget(null)}>Cancel</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={executeReschedule} disabled={!rescheduleDate}>
                                Reschedule
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile responsive override */}
            <style>{`
                @media (max-width: 900px) {
                    .appt-layout-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </>
    );
};

export default Appointments;
