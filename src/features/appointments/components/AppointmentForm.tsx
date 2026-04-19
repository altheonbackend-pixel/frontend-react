import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Patient, type Appointment } from '../../../shared/types';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';
import { appointmentSchema, type AppointmentFormData } from '../appointmentSchema';
import '../styles/AppointmentForm.css';

interface AppointmentFormProps {
    initialDate: Date;
    appointment?: Appointment | null;
    onSuccess: () => void;
    onCancel: () => void;
}

const AppointmentForm = ({ initialDate, appointment, onSuccess, onCancel }: AppointmentFormProps) => {
    const { t } = useTranslation();
    const { isAuthenticated, profile } = useAuth();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const defaultDate = initialDate.toISOString().slice(0, 16);
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<AppointmentFormData>({
        resolver: zodResolver(appointmentSchema),
        defaultValues: {
            appointment_date: defaultDate,
            patient: '',
            reason_for_appointment: '',
            appointment_type: 'in_person' as const,
            status: 'scheduled',
            notes: '',
        },
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!isAuthenticated) {
                setLoadError(t('appointments.error.auth'));
                setLoading(false);
                return;
            }
            try {
                const res = await api.get('/patients/');
                setPatients(res.data.results ?? res.data);
            } catch {
                setLoadError(t('appointments.form.error_load'));
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [isAuthenticated, t]);

    useEffect(() => {
        if (!loading && appointment) {
            reset({
                appointment_date: appointment.appointment_date.slice(0, 16),
                patient: appointment.patient,
                reason_for_appointment: appointment.reason_for_appointment,
                status: 'scheduled',
                notes: '',
            });
        }
    }, [loading, appointment, reset]);

    const onSubmit = async (data: AppointmentFormData) => {
        const payload = { ...data, doctor: profile?.id };
        try {
            if (appointment) {
                await api.put(`/appointments/${appointment.id}/`, payload);
                toast.success(t('appointments.form.submit_edit'));
            } else {
                await api.post('/appointments/', payload);
                toast.success(t('appointments.form.submit_create'));
            }
            onSuccess();
        } catch (err) {
            toast.error(parseApiError(err, t('appointments.form.error_save')));
        }
    };

    return (
        <Modal
            open
            onClose={onCancel}
            title={appointment ? t('appointments.form.title_edit') : t('appointments.form.title_add')}
            size="md"
            dirty={isDirty}
            footer={
                !loading && !loadError ? (
                    <>
                        <button type="button" onClick={onCancel} className="cancel-button" disabled={isSubmitting}>
                            {t('appointments.form.cancel')}
                        </button>
                        <button type="submit" form="appointment-form" className="btn btn-primary" disabled={isSubmitting}>
                            {appointment ? t('appointments.form.submit_edit') : t('appointments.form.submit_create')}
                        </button>
                    </>
                ) : null
            }
        >
            {loading && <div className="loading-message">{t('appointments.form.loading')}</div>}
            {!loading && loadError && <div className="error-message">{loadError}</div>}
            {!loading && !loadError && (
                <form id="appointment-form" onSubmit={handleSubmit(onSubmit)} className="appointment-form">
                    <div className="form-group">
                        <label htmlFor="patient">{t('appointments.patient_label')}</label>
                        <select id="patient" className="select-input" {...register('patient')}>
                            <option value="">{t('appointments.form.select_patient')}</option>
                            {patients.map(patient => (
                                <option key={patient.unique_id} value={patient.unique_id}>
                                    {patient.first_name} {patient.last_name}
                                </option>
                            ))}
                        </select>
                        {errors.patient && <span className="field-error">{errors.patient.message}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="appointment_date">{t('appointments.form.date_label')}</label>
                        <input
                            type="datetime-local"
                            id="appointment_date"
                            className="input"
                            min={new Date().toISOString().slice(0, 16)}
                            {...register('appointment_date')}
                        />
                        {errors.appointment_date && <span className="field-error">{errors.appointment_date.message}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="appointment_type">{t('appointments.form.type_label', { defaultValue: 'Appointment type' })}</label>
                        <select id="appointment_type" className="select-input" {...register('appointment_type')}>
                            <option value="in_person">In person</option>
                            <option value="telemedicine">Telemedicine</option>
                            <option value="phone">Phone</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="reason_for_appointment">{t('appointments.form.reason_label')}</label>
                        <textarea
                            id="reason_for_appointment"
                            className="textarea"
                            rows={4}
                            {...register('reason_for_appointment')}
                        />
                        {errors.reason_for_appointment && <span className="field-error">{errors.reason_for_appointment.message}</span>}
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default AppointmentForm;
