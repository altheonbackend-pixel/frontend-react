// Fichier : votre_app/components/ReferralForm.tsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { type DoctorProfile } from '../../../shared/types';
import '../../../shared/styles/FormStyles.css';
import api from '../../../shared/services/api';

interface ReferralFormProps {
    patientId: string;
    onSuccess: () => void;
    onClose: () => void;
    referralToEdit?: any | null;
}

const ReferralForm: React.FC<ReferralFormProps> = ({ patientId, onSuccess, onClose, referralToEdit }) => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [formData, setFormData] = useState({
        referred_to: '',
        specialty_requested: '',
        reason_for_referral: '',
        comments: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDoctors = async () => {
            if (!token) return;
            try {
                const response = await api.get('/doctors/');
                setDoctors(response.data.results ?? response.data);
            } catch (err) {
                console.error('Erreur lors de la récupération des docteurs:', err);
                setError(t('referrals.form.error.load_doctors'));
            }
        };
        fetchDoctors();
    }, [token]);

    useEffect(() => {
        if (referralToEdit) {
            setFormData({
                referred_to: referralToEdit.referred_to?.id ? referralToEdit.referred_to.id.toString() : (referralToEdit.referred_to?.toString() || ''),
                specialty_requested: referralToEdit.specialty_requested || '',
                reason_for_referral: referralToEdit.reason_for_referral || '',
                comments: referralToEdit.comments || '',
            });
        } else {
            setFormData({
                referred_to: '',
                specialty_requested: '',
                reason_for_referral: '',
                comments: '',
            });
        }
    }, [referralToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!token) {
            setError(t('referrals.form.error.auth'));
            setLoading(false);
            return;
        }

        if (!formData.referred_to) {
            setError(t('referrals.form.error.select_doctor'));
            setLoading(false);
            return;
        }

        const referredToId = parseInt(formData.referred_to, 10);
        if (isNaN(referredToId)) {
            setError(t('referrals.form.error.invalid_id'));
            setLoading(false);
            return;
        }
        
        const payload = {
            ...formData,
            patient: patientId, // INCLUSION de l'ID du patient dans le payload
            referred_to: referredToId,
        };

        try {
            if (referralToEdit && referralToEdit.id) {
                // Modification (PUT)
                await api.put(`/referrals/${referralToEdit.id}/`, payload);
            } else {
                // Création (POST)
                // CORRECTION DE L'URL
                await api.post(`/referrals/`, payload);
            }
            onSuccess();
        } catch (err: any) {
            console.error('Erreur lors de la soumission du référencement:', err.response?.data || err.message);
            if (axios.isAxiosError(err) && err.response && err.response.data) {
                const errorMessages = Object.values(err.response.data).flat().join(' ');
                setError(`${t('referrals.form.error.prefix')}${errorMessages}`);
            } else {
                setError(t('referrals.form.error.save'));
            }
        } finally {
            setLoading(false);
        }
    };

    const isEditing = !!referralToEdit;

    return (
        <div className="form-overlay">
            <div className="form-container">
                <h3>{isEditing ? t('referrals.form.title_edit') : t('referrals.form.title_add')}</h3>
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="referred_to">{t('referrals.form.doctor_label')}</label>
                        <select
                            id="referred_to"
                            name="referred_to"
                            value={formData.referred_to}
                            onChange={handleChange}
                            required
                        >
                            <option value="">{t('referrals.form.select_doctor')}</option>
                            {doctors.map(doctor => (
                                <option key={doctor.id} value={doctor.id}>
                                    Dr. {doctor.full_name} - {doctor.specialty}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="specialty_requested">{t('referrals.form.specialty_label')}</label>
                        <input
                            type="text"
                            id="specialty_requested"
                            name="specialty_requested"
                            value={formData.specialty_requested}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reason_for_referral">{t('referrals.form.reason_label')}</label>
                        <textarea
                            id="reason_for_referral"
                            name="reason_for_referral"
                            value={formData.reason_for_referral}
                            onChange={handleChange}
                            rows={4}
                            required
                        ></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="comments">{t('referrals.form.comments_label')}</label>
                        <textarea
                            id="comments"
                            name="comments"
                            value={formData.comments}
                            onChange={handleChange}
                            rows={4}
                        ></textarea>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="submit-button" disabled={loading}>
                            {loading ? t('referrals.form.loading') : (isEditing ? t('referrals.form.submit_edit') : t('referrals.form.submit_add'))}
                        </button>
                        <button type="button" onClick={onClose} className="cancel-button">{t('referrals.form.cancel')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReferralForm;