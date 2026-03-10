// Fichier : src/components/DeleteAppointmentModal.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Appointment } from '../../../shared/types';
import '../../../shared/styles/FormStyles.css';
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
    const { token } = useAuth();
    const [reason, setReason] = useState(REASON_OPTIONS[0].value);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!token) {
            setError(t('delete_appointment.error.auth'));
            setLoading(false);
            return;
        }

        try {
            // L'API devra gérer la logique de suppression et d'enregistrement des motifs
            await api.delete('/appointments/${appointment.id}/', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                data: { // Envoyer les motifs dans le corps de la requête DELETE
                    reason: reason,
                    comment: comment
                }
            });

            onSuccess();
        } catch (err) {
            console.error("Erreur lors de la suppression du rendez-vous:", err);
            setError(t('delete_appointment.error.generic'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-overlay">
            <div className="form-container">
                <form onSubmit={handleSubmit} className="form">
                    <h3>{t('delete_appointment.title')}</h3>
                    <p>{t('delete_appointment.confirm_message', { patient_name: appointment.patient })}</p>
                    <p>{t('delete_appointment.warning')}</p>
                    {error && <p className="error-message">{error}</p>}

                    <div className="form-group">
                        <label htmlFor="reason">{t('delete_appointment.reason_label')}</label>
                        <select
                            id="reason"
                            name="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
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
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={t('delete_appointment.comment_placeholder')}
                        ></textarea>
                    </div>
                    
                    <div className="form-actions">
                        <button type="submit" disabled={loading} className="delete-confirm-button">
                            {loading ? t('delete_appointment.loading') : t('delete_appointment.submit')}
                        </button>
                        <button type="button" onClick={onCancel} className="cancel-button">
                            {t('delete_appointment.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeleteAppointmentModal;