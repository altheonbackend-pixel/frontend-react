// Fichier : src/components/ReferralsList.tsx

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Referral } from '../../../shared/types';
import '../styles/ReferralsList.css';
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
                const referralsList = response.data.results ?? response.data;
                const sortedReferrals = referralsList.sort((a: Referral, b: Referral) => {
                  return new Date(b.date_of_referral).getTime() - new Date(a.date_of_referral).getTime();
                });
                setReferrals(sortedReferrals);
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
        <div className="referrals-container">
            <div className="referrals-header">
                <h1 className="referrals-title">{t('referrals.list_title')}</h1>
                <p className="referrals-subtitle">Manage and track all patient referrals</p>
            </div>

            {referrals.length === 0 ? (
                <div className="no-referrals-message">
                    <p>{t('referrals.no_referrals')}</p>
                </div>
            ) : (
                <ul className="referrals-grid">
                    {referrals.map(referral => (
                        <li key={referral.id} className="referral-card normal">
                            <div className="referral-content">
                                {/* Header Section */}
                                <div className="referral-header">
                                    <h3 className="referral-patient-name">
                                        <span className="patient-badge">Patient</span>
                                        <Link
                                            to={`/patients/${referral.patient_details?.unique_id}`}
                                            className="patient-link"
                                        >
                                            {referral.patient_details?.first_name} {referral.patient_details?.last_name || ''}
                                        </Link>
                                    </h3>
                                    <p className="referral-date">
                                        {new Date(referral.date_of_referral).toLocaleDateString()}
                                    </p>
                                </div>

                                {/* Body Section */}
                                <div className="referral-body">
                                    {/* Specialty */}
                                    <div className="referral-field">
                                        <span className="referral-label">{t('referrals.specialty')}</span>
                                        <span className="specialty-tag">{referral.specialty_requested}</span>
                                    </div>

                                    {/* Reason */}
                                    <div className="referral-field">
                                        <span className="referral-label">{t('referrals.reason')}</span>
                                        <p className="reason-text">{referral.reason_for_referral}</p>
                                    </div>

                                    {/* Referred To */}
                                    <div className="referral-field">
                                        <span className="referral-label">Referred To</span>
                                        <span className="referral-value">
                                            Dr. {referral.referred_to_details?.full_name}
                                        </span>
                                    </div>

                                    {/* Referred By */}
                                    <div className="referral-field">
                                        <span className="referral-label">Referred By</span>
                                        <span className="referral-value">
                                            Dr. {referral.referred_by_details?.full_name}
                                        </span>
                                    </div>
                                </div>

                                {/* Footer Section */}
                                <div className="referral-footer">
                                    <div className="doctor-info">
                                        <div className="doctor-avatar">
                                            {referral.referred_to_details?.full_name?.charAt(0) || 'D'}
                                        </div>
                                        <div>
                                            <p className="doctor-name">
                                                Dr. {referral.referred_to_details?.full_name?.split(' ')[0]}
                                            </p>
                                            <p className="doctor-specialty-hint">
                                                {referral.specialty_requested}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ReferralsList;
