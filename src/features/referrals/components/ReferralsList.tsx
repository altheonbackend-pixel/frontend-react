// Fichier : src/components/ReferralsList.tsx

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Referral } from '../../../shared/types';
import '../../../shared/styles/DetailStyles.css';
import { Link } from 'react-router-dom';
import api from '../../../shared/services/api';

interface ReferralsListProps {}

const ReferralsList: React.FC<ReferralsListProps> = () => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchReferrals = async () => {
            if (!token) {
                setError(t('appointments.error.auth'));
                setLoading(false);
                return;
            }
            try {
                const response = await api.get(`/referrals/`);
                setReferrals(response.data.results ?? response.data);
                setError(null);
            } catch (err) {
                console.error('Erreur lors de la récupération des référencements:', err);
                setError(t('referrals.error.load'));
            } finally {
                setLoading(false);
            }
        };

        fetchReferrals();
    }, [token]);

    if (loading) {
        return <div className="loading-message">{t('referrals.loading')}</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="patients-container">
            <h2 className="page-title">{t('referrals.list_title')}</h2>
            {referrals.length === 0 ? (
                <p className="no-patients-message">{t('referrals.no_referrals')}</p>
            ) : (
                <ul className="patients-list">
                    {referrals.map(referral => (
                        <li key={referral.id} className="patient-card">
                            <div className="patient-info">
                                <h4>
                                    {t('referrals.patient_ref')} 
                                    <Link to={`/patients/${referral.patient_details?.unique_id}`} className="patient-link">
                                        {referral.patient_details?.first_name} {referral.patient_details?.last_name || ''}
                                    </Link>
                                </h4>
                                <p><strong>{t('referrals.specialty')}</strong> {referral.specialty_requested}</p>
                                <p><strong>{t('referrals.reason')}</strong> {referral.reason_for_referral}</p>
                                <p className="date-info">
                                    {t('referrals.created_on')} {new Date(referral.date_of_referral).toLocaleDateString()} {t('referrals.by')} {referral.referred_by_details?.full_name}
                                </p>
                                <p><strong>{t('referrals.referred_to')}</strong> Dr. {referral.referred_to_details?.full_name}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ReferralsList;