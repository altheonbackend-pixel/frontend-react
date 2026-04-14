import { useState } from 'react';
import Calendar from 'react-calendar';
import { useTranslation } from 'react-i18next';
import 'react-calendar/dist/Calendar.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Appointment, type Patient, type Workplace } from '../../../shared/types';
import AppointmentForm from './AppointmentForm';
import DeleteAppointmentModal from './DeleteAppointmentModal';
import { useNavigate, Link } from 'react-router-dom';
import '../../../shared/styles/DetailStyles.css';
import '../styles/Appointments.css';

import api from '../../../shared/services/api';
import { Dialog, toast, parseApiError } from '../../../shared/components/ui';
import { queryKeys } from '../../../shared/queryKeys';

const CONSULTATION_STARTABLE = ['scheduled', 'confirmed', 'in_progress'];

const STATUS_BADGE_COLORS: Record<string, string> = {
    scheduled: '#3182ce',
    confirmed: '#38a169',
    completed: '#718096',
    cancelled: '#e53e3e',
    no_show: '#d69e2e',
    rescheduled: '#805ad5',
    pending: '#dd6b20',
};

interface AppointmentWithDetails extends Appointment {
    patient_details: Patient;
    workplace_details: Workplace;
}

function toYYYYMM(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function toYYYYMMDD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
    const [rescheduleTarget, setRescheduleTarget] = useState<{ id: number; currentDate: string } | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');

    const selectedDate = toYYYYMMDD(date);

    // Query 1: dots for calendar tile highlighting (staleTime: 5 min)
    const { data: dotDates = [] } = useQuery({
        queryKey: queryKeys.appointments.dots(currentMonth),
        queryFn: async () => {
            const res = await api.get('/appointments/dots/', { params: { month: currentMonth } });
            return res.data as string[];
        },
        staleTime: 5 * 60 * 1000,
    });

    // Query 2: appointment list for selected date (staleTime: 60s)
    const { data: appointments = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.appointments.list(selectedDate),
        queryFn: async () => {
            const res = await api.get('/appointments/', { params: { date: selectedDate } });
            const list: AppointmentWithDetails[] = res.data.results ?? res.data;
            return list.sort((a, b) =>
                new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
            );
        },
        staleTime: 60 * 1000,
    });

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
    };

    const handleDateChange = (newDate: unknown) => {
        if (newDate instanceof Date) {
            setDate(newDate);
        }
    };

    const handleActiveStartDateChange = ({ activeStartDate }: { activeStartDate: Date | null }) => {
        if (activeStartDate) setCurrentMonth(toYYYYMM(activeStartDate));
    };

    const handleCreateAppointmentClick = () => {
        setSelectedAppointment(null);
        setIsFormVisible(true);
    };

    const handleEditAppointment = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setIsFormVisible(true);
    };

    const handleDeleteClick = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setIsDeleteModalVisible(true);
    };

    const handleFormSuccess = () => {
        setIsFormVisible(false);
        setSelectedAppointment(null);
        invalidateAll();
    };

    const handleFormCancel = () => {
        setIsFormVisible(false);
        setSelectedAppointment(null);
    };

    const handleDeleteSuccess = () => {
        setIsDeleteModalVisible(false);
        setSelectedAppointment(null);
        invalidateAll();
    };

    const handleDeleteCancel = () => {
        setIsDeleteModalVisible(false);
        setSelectedAppointment(null);
    };

    const requestLifecycleAction = (apptId: number, action: 'confirm' | 'complete' | 'cancel' | 'no_show') => {
        setLifecycleConfirm({ id: apptId, action });
    };

    const handleRescheduleClick = (appt: AppointmentWithDetails) => {
        const dt = new Date(appt.appointment_date);
        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setRescheduleDate(local);
        setRescheduleTarget({ id: appt.id, currentDate: appt.appointment_date });
    };

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

    const tileClassName = ({ date: tileDate, view }: { date: Date; view: string }) => {
        if (view === 'month') {
            const iso = toYYYYMMDD(tileDate);
            if (dotDates.includes(iso)) return 'has-appointment';
        }
        return null;
    };

    return (
        <div className="appointments-page">
            <h2>{t('appointments.title')}</h2>
            <div className="calendar-container">
                <Calendar
                    onChange={handleDateChange}
                    value={date}
                    tileClassName={tileClassName}
                    onActiveStartDateChange={handleActiveStartDateChange}
                />
                <button onClick={handleCreateAppointmentClick} className="create-appt-button">
                    {t('appointments.create_button')} {date.toLocaleDateString()}
                </button>
                <button onClick={() => navigate('/deleted-appointments')} className="view-deleted-button">
                    {t('appointments.view_deleted')}
                </button>
            </div>

            <div className="appointments-list">
                <h3>{t('appointments.list_title')} {date.toLocaleDateString()}</h3>
                {isLoading && <p>{t('appointments.loading')}</p>}
                {isError && <p className="error-message">{t('appointments.error.load')}</p>}
                {!isLoading && appointments.length === 0 ? (
                    <p>{t('appointments.no_appointments')}</p>
                ) : (
                    appointments.map(appt => (
                        <div key={appt.id} className="appointment-item">
                            <div className="appt-item-header">
                                <span className="appt-patient-name">
                                    {appt.patient_details
                                        ? <Link to={`/patients/${appt.patient_details.unique_id}`} className="appt-patient-link">
                                            {appt.patient_details.first_name} {appt.patient_details.last_name}
                                          </Link>
                                        : t('appointments.patient_unavailable')}
                                </span>
                                <span className="appt-status-badge" style={{ background: STATUS_BADGE_COLORS[appt.status] || '#718096' }}>
                                    {appt.status_display || appt.status}
                                </span>
                            </div>

                            <div className="appt-meta">
                                <span className="appt-meta-item">
                                    <span className="appt-meta-label">Time</span>
                                    {new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {appt.workplace_details && (
                                    <span className="appt-meta-item">
                                        <span className="appt-meta-label">Clinic</span>
                                        {appt.workplace_details.name}
                                    </span>
                                )}
                                <span className="appt-meta-item">
                                    <span className="appt-meta-label">Reason</span>
                                    {appt.reason_for_appointment}
                                </span>
                            </div>
                            {appt.notes && <p className="appt-notes">{appt.notes}</p>}

                            <div className="appointment-actions">
                                {CONSULTATION_STARTABLE.includes(appt.status) && appt.patient_details && (
                                    <button onClick={() => handleStartConsultation(appt)} className="appt-start-consult-btn">
                                        + Document Consultation
                                    </button>
                                )}
                                {(appt.status === 'scheduled' || appt.status === 'pending') && (
                                    <button onClick={() => requestLifecycleAction(appt.id, 'confirm')} className="action-button confirm-button">Confirm</button>
                                )}
                                {(appt.status === 'confirmed' || appt.status === 'in_progress') && (
                                    <button onClick={() => requestLifecycleAction(appt.id, 'complete')} className="action-button complete-button">Complete</button>
                                )}
                                {!['cancelled', 'completed', 'no_show'].includes(appt.status) && (
                                    <button onClick={() => requestLifecycleAction(appt.id, 'cancel')} className="action-button cancel-appt-button">Cancel</button>
                                )}
                                {(appt.status === 'confirmed' || appt.status === 'scheduled') && (
                                    <button onClick={() => requestLifecycleAction(appt.id, 'no_show')} className="action-button noshow-button">No Show</button>
                                )}
                                {!['cancelled', 'completed', 'no_show', 'rescheduled'].includes(appt.status) && (
                                    <button onClick={() => handleRescheduleClick(appt)} className="action-button reschedule-button">Reschedule</button>
                                )}
                                <button onClick={() => handleEditAppointment(appt)} className="action-button edit-button">{t('appointments.edit')}</button>
                                <button onClick={() => handleDeleteClick(appt)} className="action-button delete-button">{t('appointments.delete')}</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isFormVisible && (
                <AppointmentForm
                    initialDate={date}
                    appointment={selectedAppointment}
                    onSuccess={handleFormSuccess}
                    onCancel={handleFormCancel}
                />
            )}

            {isDeleteModalVisible && selectedAppointment && (
                <DeleteAppointmentModal
                    appointment={selectedAppointment}
                    onSuccess={handleDeleteSuccess}
                    onCancel={handleDeleteCancel}
                />
            )}

            <Dialog
                open={lifecycleConfirm !== null}
                onClose={() => setLifecycleConfirm(null)}
                onConfirm={executeLifecycleAction}
                title={lifecycleConfirm ? t(`appointments.lifecycle.${lifecycleConfirm.action}_title`, { defaultValue: `${lifecycleConfirm.action.charAt(0).toUpperCase() + lifecycleConfirm.action.slice(1).replace('_', ' ')} appointment?` }) : ''}
                message={lifecycleConfirm ? t(`appointments.lifecycle.${lifecycleConfirm.action}_message`, { defaultValue: 'This action will update the appointment status. Are you sure?' }) : ''}
                tone={lifecycleConfirm?.action === 'cancel' || lifecycleConfirm?.action === 'no_show' ? 'danger' : 'warning'}
                confirmLabel={lifecycleConfirm ? lifecycleConfirm.action.charAt(0).toUpperCase() + lifecycleConfirm.action.slice(1).replace('_', ' ') : ''}
            />

            {rescheduleTarget && (
                <div className="modal-overlay" onClick={() => setRescheduleTarget(null)}>
                    <div className="modal-box reschedule-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Reschedule Appointment</h3>
                        <p className="modal-desc">Select a new date and time. The current appointment will be marked as rescheduled and a new one will be created.</p>
                        <div className="form-group">
                            <label htmlFor="reschedule-date">New Date &amp; Time <span className="required">*</span></label>
                            <input
                                id="reschedule-date"
                                type="datetime-local"
                                value={rescheduleDate}
                                onChange={e => setRescheduleDate(e.target.value)}
                                className="reschedule-input"
                            />
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={() => setRescheduleTarget(null)} className="cancel-button">Cancel</button>
                            <button type="button" onClick={executeReschedule} className="action-button confirm-button" disabled={!rescheduleDate}>Reschedule</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Appointments;
