import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { useTranslation } from 'react-i18next';
import 'react-calendar/dist/Calendar.css';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Appointment, type Patient, type Workplace } from '../../../shared/types';
import AppointmentForm from './AppointmentForm';
import DeleteAppointmentModal from './DeleteAppointmentModal';
import { useNavigate, Link } from 'react-router-dom';
import '../../../shared/styles/DetailStyles.css';
import '../styles/Appointments.css';

import api from '../../../shared/services/api';

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

const Appointments = () => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const navigate = useNavigate();
    const [date, setDate] = useState<Date>(new Date());
    const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [appointmentDates, setAppointmentDates] = useState<string[]>([]);

    const fetchAppointments = async () => {
        setIsLoading(true);
        setError(null);
        if (!token) {
            setError(t('appointments.error.auth'));
            setIsLoading(false);
            return;
        }

        try {
            const response = await api.get('/appointments/');
            const list: AppointmentWithDetails[] = response.data.results ?? response.data;
            // Sort by newest first (reverse chronological order)
            const sortedList = list.sort((a, b) => {
                return new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime();
            });
            setAppointments(sortedList);
            
            const dates = list.map((appt: AppointmentWithDetails) => new Date(appt.appointment_date).toDateString());
            setAppointmentDates([...new Set(dates)]);
        } catch {
            setError(t('appointments.error.load'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, [token]);

    const handleDateChange = (newDate: any) => {
        if (newDate instanceof Date) {
            setDate(newDate);
        }
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
        fetchAppointments();
    };

    const handleFormCancel = () => {
        setIsFormVisible(false);
        setSelectedAppointment(null);
    };
    
    const handleDeleteSuccess = () => {
        setIsDeleteModalVisible(false);
        setSelectedAppointment(null);
        fetchAppointments();
    };

    const handleDeleteCancel = () => {
        setIsDeleteModalVisible(false);
        setSelectedAppointment(null);
    };

    const handleViewDeletedAppointments = () => {
        navigate('/deleted-appointments');
    };

    const handleLifecycleAction = async (apptId: number, action: 'confirm' | 'complete' | 'cancel' | 'no_show') => {
        try {
            await api.post(`/appointments/${apptId}/${action}/`);
            fetchAppointments();
        } catch {
            setError(t('appointments.error.action'));
        }
    };

    const appointmentsForSelectedDate = appointments
        .filter(appt => {
            const apptDate = new Date(appt.appointment_date);
            return apptDate.getFullYear() === date.getFullYear() &&
                   apptDate.getMonth() === date.getMonth() &&
                   apptDate.getDate() === date.getDate();
        })
        // Sort by newest first within selected date
        .sort((a, b) => {
            return new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime();
        });

    const tileClassName = ({ date, view }: { date: Date, view: string }) => {
        if (view === 'month') {
            const dateString = date.toDateString();
            if (appointmentDates.includes(dateString)) {
                return 'has-appointment';
            }
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
                />
                <button onClick={handleCreateAppointmentClick} className="create-appt-button">
                    {t('appointments.create_button')} {date.toLocaleDateString()}
                </button>
                <button onClick={handleViewDeletedAppointments} className="view-deleted-button">
                    {t('appointments.view_deleted')}
                </button>
            </div>

            <div className="appointments-list">
                <h3>{t('appointments.list_title')} {date.toLocaleDateString()}</h3>
                {isLoading && <p>{t('appointments.loading')}</p>}
                {error && <p className="error-message">{error}</p>}
                {!isLoading && appointmentsForSelectedDate.length === 0 ? (
                    <p>{t('appointments.no_appointments')}</p>
                ) : (
                    appointmentsForSelectedDate.map(appt => (
                        <div key={appt.id} className="appointment-item">
                            {/* Header: patient + status */}
                            <div className="appt-item-header">
                                <span className="appt-patient-name">
                                    {appt.patient_details
                                        ? <Link to={`/patients/${appt.patient_details.unique_id}`} className="appt-patient-link">
                                            {appt.patient_details.first_name} {appt.patient_details.last_name}
                                          </Link>
                                        : t('appointments.patient_unavailable')}
                                </span>
                                <span className="appt-status-badge" style={{ background: STATUS_BADGE_COLORS[appt.status] || '#718096' }}>
                                    {appt.status.replace('_', ' ')}
                                </span>
                            </div>

                            {/* Compact meta row */}
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

                            {/* Action buttons */}
                            <div className="appointment-actions">
                                {(appt.status === 'scheduled' || appt.status === 'pending') && (
                                    <button onClick={() => handleLifecycleAction(appt.id, 'confirm')} className="action-button confirm-button">Confirm</button>
                                )}
                                {(appt.status === 'confirmed' || appt.status === 'in_progress') && (
                                    <button onClick={() => handleLifecycleAction(appt.id, 'complete')} className="action-button complete-button">Complete</button>
                                )}
                                {!['cancelled', 'completed', 'no_show'].includes(appt.status) && (
                                    <button onClick={() => handleLifecycleAction(appt.id, 'cancel')} className="action-button cancel-appt-button">Cancel</button>
                                )}
                                {(appt.status === 'confirmed' || appt.status === 'scheduled') && (
                                    <button onClick={() => handleLifecycleAction(appt.id, 'no_show')} className="action-button noshow-button">No Show</button>
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
        </div>
    );
};

export default Appointments;
