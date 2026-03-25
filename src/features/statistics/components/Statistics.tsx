// Fichier : src/components/Statistics.tsx

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../../auth/hooks/useAuth';
import '../../../shared/styles/DetailStyles.css';
import '../../../shared/styles/ListStyles.css';
import '../../../shared/styles/TextStyles.css';
import '../../../shared/styles/Dashboard.css';
import api from '../../../shared/services/api';

interface Stats {
    total_patients: number;
    total_consultations: number;
    total_medical_procedures: number;
    patients: PatientStat[];
}

interface PatientStat {
    unique_id: string;
    full_name: string;
    consultations_count: number;
    medical_procedures_count: number;
    referrals_count: number;
}

const Statistics = () => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStatistics = async () => {
            if (!token) {
                setError(t('statistics.error.auth'));
                setLoading(false);
                return;
            }

            try {
                const statsResponse = await api.get('/doctors/stats/');
                const patientsResponse = await api.get('/doctors/patients/stats/');

                // Handle paginated response - extract results from paginated response
                const patientsData = patientsResponse.data.results || patientsResponse.data;

                setStats({
                    total_patients: statsResponse.data.total_patients,
                    total_consultations: statsResponse.data.total_consultations,
                    total_medical_procedures: statsResponse.data.total_medical_procedures,
                    patients: patientsData
                });
            } catch (err) {
                console.error("Erreur lors du chargement des statistiques:", err);
                if (axios.isAxiosError(err)) {
                    console.error("Status:", err.response?.status);
                    console.error("Response:", err.response?.data);
                    console.error("URL:", err.config?.url);
                }
                setError(t('statistics.error.load'));
            } finally {
                setLoading(false);
            }
        };

        fetchStatistics();
    }, [token]);

    if (loading) {
        return <div className="text-page-container loading-message">{t('statistics.loading')}</div>;
    }

    if (error) {
        return <div className="text-page-container error-message">{error}</div>;
    }

    return (
        <div className="text-page-container">
            <div className="page-header">
                <h1>{t('statistics.title')}</h1>
            </div>

            {/* Section des statistiques générales affichée horizontalement */}
            <div className="stats-summary">
                <div className="stat-card">
                    <p className="stat-value">{stats?.total_patients ?? 0}</p>
                    <p className="stat-label">{t('statistics.total_patients')}</p>
                </div>
                <div className="stat-card">
                    <p className="stat-value">{stats?.total_consultations ?? 0}</p>
                    <p className="stat-label">{t('statistics.total_consultations')}</p>
                </div>
                <div className="stat-card">
                    <p className="stat-value">{stats?.total_medical_procedures ?? 0}</p>
                    <p className="stat-label">{t('statistics.total_procedures')}</p>
                </div>
            </div>
            
            <div className="separator"></div>

            {/* Tableau des patients */}
            <div className="content-section">
                <h2>{t('statistics.detail_title')}</h2>
                {stats?.patients && stats.patients.length > 0 ? (
                    <table className="patients-stats-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40%' }}>{t('statistics.columns.patient')}</th>
                                <th style={{ width: '20%' }}>{t('statistics.columns.consultations')}</th>
                                <th style={{ width: '20%' }}>{t('statistics.columns.procedures')}</th>
                                <th style={{ width: '20%' }}>{t('statistics.columns.referrals')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.patients.map(patient => (
                                <tr key={patient.unique_id}>
                                    <td>{patient.full_name}</td>
                                    <td>{patient.consultations_count}</td>
                                    <td>{patient.medical_procedures_count}</td>
                                    <td>{patient.referrals_count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="no-data-message">{t('statistics.no_data')}</p>
                )}
            </div>
        </div>
    );
};

export default Statistics;