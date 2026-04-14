import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Patient, type Workplace, type Appointment } from '../../../shared/types';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';
import '../styles/AppointmentForm.css';

interface AppointmentFormProps {
    initialDate: Date;
    appointment?: Appointment | null;
    onSuccess: () => void;
    onCancel: () => void;
}

const AppointmentForm = ({ initialDate, appointment, onSuccess, onCancel }: AppointmentFormProps) => {
    const { t } = useTranslation();
    const { token, profile } = useAuth();
    const [formData, setFormData] = useState({
        appointment_date: '',
        patient: '',
        workplace: '',
        reason_for_appointment: ''
    });
    const [patients, setPatients] = useState<Patient[]>([]);
    const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!token) {
                setLoadError(t('appointments.error.auth'));
                setLoading(false);
                return;
            }

            try {
                const patientsResponse = await api.get('/patients/');
                setPatients(patientsResponse.data.results ?? patientsResponse.data);

                const workplacesResponse = await api.get('/workplaces/');
                setWorkplaces(workplacesResponse.data.results ?? workplacesResponse.data);

                setLoading(false);
            } catch {
                setLoadError(t('appointments.form.error_load'));
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
        setDirty(true);
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const payload = {
            ...formData,
            doctor: profile?.id,
        };

        try {
            if (appointment) {
                await api.put(`/appointments/${appointment.id}/`, payload);
                toast.success(t('appointments.form.submit_edit'));
            } else {
                await api.post('/appointments/', payload);
                toast.success(t('appointments.form.submit_create'));
            }
            setDirty(false);
            onSuccess();
        } catch (err) {
            toast.error(parseApiError(err, t('appointments.form.error_save')));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open
            onClose={onCancel}
            title={appointment ? t('appointments.form.title_edit') : t('appointments.form.title_add')}
            size="md"
            dirty={dirty}
            footer={
                !loading && !loadError ? (
                    <>
                        <button type="button" onClick={onCancel} className="cancel-button" disabled={submitting}>
                            {t('appointments.form.cancel')}
                        </button>
                        <button type="submit" form="appointment-form" className="btn btn-primary" disabled={submitting}>
                            {appointment ? t('appointments.form.submit_edit') : t('appointments.form.submit_create')}
                        </button>
                    </>
                ) : null
            }
        >
                {loading && <div className="loading-message">{t('appointments.form.loading')}</div>}
                {!loading && loadError && <div className="error-message">{loadError}</div>}
                {!loading && !loadError && (
                <form id="appointment-form" onSubmit={handleSubmit} className="appointment-form">
                    <div className="form-group">
                        <label htmlFor="patient">{t('appointments.patient_label')}</label>
                        <select
                            id="patient"
                            name="patient"
                            className="select-input"
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
                            className="select-input"
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
                            className="input"
                            value={formData.appointment_date}
                            onChange={handleChange}
                            min={new Date().toISOString().slice(0, 16)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="reason_for_appointment">{t('appointments.form.reason_label')}</label>
                        <textarea
                            id="reason_for_appointment"
                            name="reason_for_appointment"
                            className="textarea"
                            value={formData.reason_for_appointment}
                            onChange={handleChange}
                            rows={4}
                            required
                        ></textarea>
                    </div>

                </form>
                )}
        </Modal>
    );
};

export default AppointmentForm;