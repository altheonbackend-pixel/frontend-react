import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Appointment } from '../../../shared/types';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';

interface DeleteAppointmentModalProps {
    appointment: Appointment;
    onSuccess: () => void;
    onCancel: () => void;
}

const REASON_OPTIONS = [
    { value: 'patient' },
    { value: 'doctor' },
    { value: 'clinic' },
    { value: 'external' },
    { value: 'other' },
];

const DeleteAppointmentModal = ({ appointment, onSuccess, onCancel }: DeleteAppointmentModalProps) => {
    const { t } = useTranslation();
    const [reason, setReason] = useState(REASON_OPTIONS[0].value);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await api.delete(`/appointments/${appointment.id}/`, {
                data: { reason, comment },
            });
            toast.success(t('delete_appointment.success', { defaultValue: 'Appointment deleted.' }));
            setDirty(false);
            onSuccess();
        } catch (err) {
            toast.error(parseApiError(err, t('delete_appointment.error.generic')));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open
            onClose={onCancel}
            title={t('delete_appointment.title')}
            size="sm"
            dirty={dirty}
            footer={
                <>
                    <button type="button" onClick={onCancel} className="cancel-button" disabled={loading}>
                        {t('delete_appointment.cancel')}
                    </button>
                    <button type="submit" form="delete-appointment-form" disabled={loading} className="ui-dialog__btn ui-dialog__btn--confirm ui-dialog__btn--danger">
                        {loading ? t('delete_appointment.loading') : t('delete_appointment.submit')}
                    </button>
                </>
            }
        >
            <p>{t('delete_appointment.confirm_message', { patient_name: appointment.patient })}</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{t('delete_appointment.warning')}</p>

            <form id="delete-appointment-form" onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
                    <label htmlFor="reason">{t('delete_appointment.reason_label')}</label>
                    <select
                        id="reason"
                        name="reason"
                        value={reason}
                        onChange={e => { setReason(e.target.value); setDirty(true); }}
                        required
                    >
                        {REASON_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                                {t(`delete_appointment.reason.${option.value}`)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="comment">{t('delete_appointment.comment_label')}</label>
                    <textarea
                        id="comment"
                        name="comment"
                        rows={3}
                        value={comment}
                        onChange={e => { setComment(e.target.value); setDirty(true); }}
                        placeholder={t('delete_appointment.comment_placeholder')}
                    ></textarea>
                </div>
            </form>
        </Modal>
    );
};

export default DeleteAppointmentModal;
