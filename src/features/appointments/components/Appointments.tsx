import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { useTranslation } from 'react-i18next';
import 'react-calendar/dist/Calendar.css';
import axios from 'axios';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Appointment, type Patient, type Workplace } from '../../../shared/types';
import AppointmentForm from './AppointmentForm';
import DeleteAppointmentModal from './DeleteAppointmentModal';
import { useNavigate } from 'react-router-dom';
import '../../../shared/styles/DetailStyles.css';
import '../styles/Appointments.css';

import api from '../../../shared/services/api';

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
            const response = await axios.get<AppointmentWithDetails[]>(`${API_BASE_URL}/appointments/`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setAppointments(response.data);
            
            // Correction ici : Spécifiez le type de l'objet 'appt'
            const dates = response.data.map((appt: AppointmentWithDetails) => new Date(appt.appointment_date).toDateString());
            setAppointmentDates([...new Set(dates)]);
        } catch (err) {
            console.error("Erreur lors de la récupération des rendez-vous :", err);
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

    const appointmentsForSelectedDate = appointments.filter(appt => {
        const apptDate = new Date(appt.appointment_date);
        return apptDate.getFullYear() === date.getFullYear() &&
               apptDate.getMonth() === date.getMonth() &&
               apptDate.getDate() === date.getDate();
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
                            <p><strong>{t('appointments.patient_label')}:</strong> {appt.patient_details ? `${appt.patient_details.first_name} ${appt.patient_details.last_name}` : t('appointments.patient_unavailable')}</p>
                            <p><strong>{t('appointments.workplace_label')}:</strong> {appt.workplace_details ? appt.workplace_details.name : t('appointments.workplace_unavailable')}</p>
                            <p><strong>{t('appointments.time_label')}:</strong> {new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            <p><strong>{t('appointments.reason_label')}:</strong> {appt.reason_for_appointment}</p>
                            <div className="appointment-actions">
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