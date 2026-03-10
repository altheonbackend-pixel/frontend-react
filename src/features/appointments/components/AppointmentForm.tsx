// Fichier : src/components/AppointmentForm.tsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
//import { useNavigate } from 'react-router-dom';
import { type Patient, type Workplace, type Appointment } from '../../../shared/types';
import '../styles/AppointmentForm.css';
import api from '../../../shared/services/api';

interface AppointmentFormProps {
    initialDate: Date;
    appointment?: Appointment | null;
    onSuccess: () => void;
    onCancel: () => void;
}

const AppointmentForm = ({ initialDate, appointment, onSuccess, onCancel }: AppointmentFormProps) => {
    const { t } = useTranslation();
    const { token, profile } = useAuth();
    //const navigate = useNavigate();
    const [formData, setFormData] = useState({
        appointment_date: '',
        patient: '',
        workplace: '',
        reason_for_appointment: ''
    });
    const [patients, setPatients] = useState<Patient[]>([]);
    const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!token) {
                setError(t('appointments.error.auth'));
                setLoading(false);
                return;
            }

            try {
                const patientsResponse = await axios.get<Patient[]>(`${API_BASE_URL}/patients/`);
                setPatients(patientsResponse.data);

                const workplacesResponse = await axios.get<Workplace[]>(`${API_BASE_URL}/workplaces/`);
                setWorkplaces(workplacesResponse.data);

                setLoading(false);
            } catch (err) {
                console.error("Erreur lors de la récupération des données initiales :", err);
                setError(t('appointments.form.error_load'));
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [token]);

    useEffect(() => {
        if (!loading && appointment) {
            setFormData({
                appointment_date: appointment.appointment_date.slice(0, 16),
                // CORRECTION ICI : Utilisez `appointment.patient` directement car c'est déjà l'ID du patient.
                patient: appointment.patient,
                workplace: String(appointment.workplace),
                reason_for_appointment: appointment.reason_for_appointment
            });
        } else if (!loading) {
            const defaultDate = initialDate.toISOString().slice(0, 16);
            setFormData(prev => ({ ...prev, appointment_date: defaultDate }));
        }
    }, [loading, appointment, initialDate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const payload = {
            ...formData,
            doctor: profile?.id,
        };

        try {
            if (appointment) {
                await api.put('/appointments/${appointment.id}/', payload);
            } else {
                await api.post('/appointments/', payload);
            }
            onSuccess();
        } catch (err) {
            console.error("Erreur lors de la soumission du rendez-vous :", err);
            setError(t('appointments.form.error_save'));
        }
    };

    if (loading) {
        return <div className="loading-message">{t('appointments.form.loading')}</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="form-modal-overlay">
            <div className="appointment-form-container">
                <h3>{appointment ? t('appointments.form.title_edit') : t('appointments.form.title_add')}</h3>
                <form onSubmit={handleSubmit} className="appointment-form">
                    <div className="form-group">
                        <label htmlFor="patient">{t('appointments.patient_label')}</label>
                        <select
                            id="patient"
                            name="patient"
                            value={formData.patient}
                            onChange={handleChange}
                            required
                        >
                            <option value="">{t('appointments.form.select_patient')}</option>
                            {patients.map(patient => (
                                <option key={patient.unique_id} value={patient.unique_id}>
                                    {patient.first_name} {patient.last_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="workplace">{t('appointments.workplace_label')}</label>
                        <select
                            id="workplace"
                            name="workplace"
                            value={formData.workplace}
                            onChange={handleChange}
                            required
                        >
                            <option value="">{t('appointments.form.select_workplace')}</option>
                            {workplaces.map(workplace => (
                                <option key={workplace.id} value={workplace.id}>
                                    {workplace.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="appointment_date">{t('appointments.form.date_label')}</label>
                        <input
                            type="datetime-local"
                            id="appointment_date"
                            name="appointment_date"
                            value={formData.appointment_date}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="reason_for_appointment">{t('appointments.form.reason_label')}</label>
                        <textarea
                            id="reason_for_appointment"
                            name="reason_for_appointment"
                            value={formData.reason_for_appointment}
                            onChange={handleChange}
                            rows={4}
                            required
                        ></textarea>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="submit-button">
                            {appointment ? t('appointments.form.submit_edit') : t('appointments.form.submit_create')}
                        </button>
                        <button type="button" onClick={onCancel} className="cancel-button">
                            {t('appointments.form.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AppointmentForm;