// Fichier : src/components/DeletedAppointments.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import '../styles/Appointments.css';
import api from '../../../shared/services/api';

const DeletedAppointments = () => {
    const { t, i18n } = useTranslation();
    const { token } = useAuth();
    const [deletedAppointments, setDeletedAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDeletedAppointments = async () => {
        setIsLoading(true);
        setError(null);
        if (!token) {
            setError(t('deleted_appointments.error.auth'));
            setIsLoading(false);
            return;
        }

        try {
            const response = await api.get('/appointments/deleted/');
            setDeletedAppointments(response.data.results ?? response.data);
        } catch {
            setError(t('deleted_appointments.error.fetch'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDeletedAppointments();
    }, [token]);

    return (
        <div className="deleted-appointments-page">
            <h2>{t('deleted_appointments.title')}</h2>
            {isLoading && <p>{t('deleted_appointments.loading')}</p>}
            {error && <p className="error-message">{error}</p>}
            {!isLoading && deletedAppointments.length === 0 ? (
                <p>{t('deleted_appointments.no_data')}</p>
            ) : (
                <div className="appointments-list">
                    {deletedAppointments.map((appt: any) => (
                        <div key={appt.id} className="appointment-item deleted">
                            <p><strong>{t('deleted_appointments.labels.patient')}:</strong> {appt.patient_details.first_name} {appt.patient_details.last_name}</p>
                            <p><strong>{t('deleted_appointments.labels.doctor')}:</strong> {appt.doctor_details.full_name}</p>
                            <p><strong>{t('deleted_appointments.labels.clinic')}:</strong> {appt.workplace_details.name}</p>
                            <p><strong>{t('deleted_appointments.labels.initial_date')}:</strong> {new Date(appt.appointment_date).toLocaleString(i18n.language)}</p>
                            <p><strong>{t('deleted_appointments.labels.deleted_at')}:</strong> {new Date(appt.deletion_date).toLocaleString(i18n.language)}</p>
                            <p><strong>{t('deleted_appointments.labels.reason')}:</strong> {t(`delete_appointment.reason.${appt.deletion_reason}`) || appt.deletion_reason}</p>
                            {appt.deletion_comment && <p><strong>{t('deleted_appointments.labels.comment')}:</strong> {appt.deletion_comment}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DeletedAppointments;