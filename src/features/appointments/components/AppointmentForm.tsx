import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Patient, type Appointment } from '../../../shared/types';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';
import { appointmentSchema, type AppointmentFormData } from '../appointmentSchema';
import '../styles/AppointmentForm.css';

interface Slot {
    time: string;
    datetime: string;
    status: 'free' | 'booked' | 'past';
    appointment_id?: number;
    patient_id?: string;
    patient_name?: string;
    reason?: string;
    appointment_status?: string;
}

interface SlotsResponse {
    slots: Slot[];
    working_hours: { start: string; end: string } | null;
    day_off: boolean;
}

interface AppointmentFormProps {
    initialDate: Date;
    appointment?: Appointment | null;
    initialPatientId?: string;
    onSuccess: () => void;
    onCancel: () => void;
}

const toDateInputValue = (d: Date) => d.toISOString().slice(0, 10);

const AppointmentForm = ({ initialDate, appointment, initialPatientId, onSuccess, onCancel }: AppointmentFormProps) => {
    const { t } = useTranslation();
    const { isAuthenticated, profile } = useAuth();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [selectedDate, setSelectedDate] = useState<string>(
        appointment
            ? appointment.appointment_date.slice(0, 10)
            : toDateInputValue(initialDate)
    );
    const [slots, setSlots] = useState<Slot[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [dayOff, setDayOff] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(
        appointment ? appointment.appointment_date.slice(11, 16) : null
    );

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<AppointmentFormData>({
        resolver: zodResolver(appointmentSchema),
        defaultValues: {
            appointment_date: appointment?.appointment_date ?? '',
            patient: '',
            reason_for_appointment: '',
            appointment_type: 'in_person' as const,
            status: 'scheduled',
            notes: '',
        },
    });

    // Fetch patients + pre-fill patient when loading
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
                if (initialPatientId) {
                    reset((prev) => ({ ...prev, patient: initialPatientId }));
                }
            } catch {
                setLoadError(t('appointments.form.error_load'));
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [isAuthenticated, t, initialPatientId, reset]);

    // Pre-fill form when editing
    useEffect(() => {
        if (!loading && appointment) {
            reset({
                appointment_date: appointment.appointment_date,
                patient: appointment.patient,
                reason_for_appointment: appointment.reason_for_appointment,
                status: 'scheduled',
                notes: '',
            });
        }
    }, [loading, appointment, reset]);

    // Fetch slots whenever selectedDate changes
    const fetchSlots = useCallback(async (date: string) => {
        if (!date) return;
        setSlotsLoading(true);
        setSlots([]);
        setDayOff(false);
        try {
            const res = await api.get<SlotsResponse>(`/appointments/day-slots/?date=${date}`);
            if (res.data.day_off) {
                setDayOff(true);
            } else {
                setSlots(res.data.slots);
            }
        } catch {
            toast.error('Could not load time slots. Please try again.');
        } finally {
            setSlotsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!loading && selectedDate) {
            fetchSlots(selectedDate);
        }
    }, [loading, selectedDate, fetchSlots]);

    const handleSlotClick = (slot: Slot) => {
        if (slot.status !== 'free') return;
        setSelectedSlot(slot.time);
        setValue('appointment_date', slot.datetime, { shouldDirty: true, shouldValidate: true });
    };

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

    const today = toDateInputValue(new Date());

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
                        <button type="submit" form="appointment-form" className="btn btn-primary" disabled={isSubmitting || !selectedSlot}>
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
                    {/* Patient selector */}
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

                    {/* Date picker */}
                    <div className="form-group">
                        <label htmlFor="slot-date">Date</label>
                        <input
                            type="date"
                            id="slot-date"
                            className="input"
                            min={today}
                            value={selectedDate}
                            onChange={e => {
                                setSelectedDate(e.target.value);
                                setSelectedSlot(null);
                                setValue('appointment_date', '', { shouldValidate: false });
                            }}
                        />
                    </div>

                    {/* Slot grid */}
                    <div className="form-group">
                        <label>Time slot</label>
                        {slotsLoading && <div className="slots-loading">Loading available slots…</div>}
                        {!slotsLoading && dayOff && (
                            <div className="slots-day-off">Doctor is not available on this day.</div>
                        )}
                        {!slotsLoading && !dayOff && slots.length === 0 && selectedDate && (
                            <div className="slots-day-off">No slots configured for this day.</div>
                        )}
                        {!slotsLoading && slots.length > 0 && (
                            <div className="slot-grid">
                                {slots.map(slot => (
                                    <button
                                        key={slot.time}
                                        type="button"
                                        className={[
                                            'slot-btn',
                                            `slot-${slot.status}`,
                                            selectedSlot === slot.time ? 'slot-selected' : '',
                                        ].join(' ').trim()}
                                        disabled={slot.status !== 'free'}
                                        onClick={() => handleSlotClick(slot)}
                                        title={
                                            slot.status === 'booked'
                                                ? `${slot.patient_name} — ${slot.reason}`
                                                : slot.status === 'past'
                                                ? 'Past'
                                                : slot.time
                                        }
                                    >
                                        <span className="slot-time">{slot.time}</span>
                                        {slot.status === 'booked' && (
                                            <span className="slot-patient">{slot.patient_name}</span>
                                        )}
                                        {slot.status === 'past' && (
                                            <span className="slot-label">Past</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                        {errors.appointment_date && !selectedSlot && (
                            <span className="field-error">Please select a time slot</span>
                        )}
                    </div>

                    {/* Appointment type */}
                    <div className="form-group">
                        <label htmlFor="appointment_type">{t('appointments.form.type_label', { defaultValue: 'Appointment type' })}</label>
                        <select id="appointment_type" className="select-input" {...register('appointment_type')}>
                            <option value="in_person">In person</option>
                            <option value="telemedicine">Telemedicine</option>
                            <option value="phone">Phone</option>
                        </select>
                    </div>

                    {/* Reason */}
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
