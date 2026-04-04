import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type Workplace } from '../../../shared/types'; // Assurez-vous que l'import est correct
import { useAuth } from '../../auth/hooks/useAuth';
import '../../../shared/styles/DetailStyles.css';
import api from '../../../shared/services/api';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import PageLoader from '../../../shared/components/PageLoader';

// Définition des types pour les statistiques (conservés)
interface DoctorStats {
    id: number;
    name: string;
    consultations: number;
    appointments: number;
    medical_procedures: number;
}

interface TotalStats {
    doctors: number;
    patients: number;
    appointments: number;
    consultations: number;
    medical_procedures: number;
}

interface ClinicStats {
    total_stats: TotalStats;
    doctors_breakdown: DoctorStats[];
}

const ClinicDetail = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token, user } = useAuth(); 
    
    const currentDoctorId = user?.id; // L'ID du docteur connecté (utilisateur)

    const [clinic, setClinic] = useState<Workplace | null>(null);
    const [stats, setStats] = useState<ClinicStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        const fetchClinicAndStats = async () => {
            if (!token || !id) return;

            try {
                setIsLoading(true);
                const [clinicResponse, statsResponse] = await Promise.all([
                    api.get(`/workplaces/${id}/`),
                    api.get(`/workplaces/${id}/statistics/`)
                ]);
                setClinic(clinicResponse.data);
                setStats(statsResponse.data);
            } catch (err) {
                console.error("Erreur lors de la récupération des détails de la clinique", err);
                setError(t('clinics.error.detail_load'));
            } finally {
                setIsLoading(false);
            }
        };

        fetchClinicAndStats();
    }, [id, token]);

    const handleEditClinic = () => {
        // CORRECTION: Utiliser une route cohérente avec l'ajout et la liste
        navigate(`/clinics/edit/${id}`); 
    };

    const handleDeleteClinic = async () => {
        try {
            await api.delete(`/workplaces/${id}/`);
            alert(t('clinics.success.delete'));
            navigate('/clinics');
        } catch (err) {
            console.error("Erreur lors de la suppression de la clinique:", err);
            alert(t('clinics.error.delete_detail'));
        }
    };

    if (isLoading) {
        return <PageLoader message={t('clinics.loading_detail')} />;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!clinic) {
        return <div className="loading-message">{t('clinics.not_found')}</div>;
    }

    const isCreator = clinic.creator === currentDoctorId;

    return (
        <div className="detail-container">
            <div className="detail-header">
                <h1>{clinic.name}</h1>
                {isCreator && (
                    <div className="patient-actions">
                        <button onClick={handleEditClinic} className="edit-button action-button">
                            {t('appointments.edit')}
                        </button>
                        <button onClick={() => setShowDeleteConfirm(true)} className="delete-button action-button">
                            {t('appointments.delete')}
                        </button>
                    </div>
                )}
            </div>

            <div className="detail-info-group">
                <div className="info-item"><strong>{t('clinics.label.address')}</strong><span>{clinic.address}</span></div>
                <div className="info-item"><strong>{t('clinics.status_label')}</strong><span>{clinic.is_public ? t('clinics.status.public') : t('clinics.status.private')}</span></div>
            </div>

            {stats && (
                <>
                    <div className="detail-info-group">
                        <h3>{t('clinics.stats.general')}</h3>
                        <div className="clinic-stats-grid">
                            <div className="clinic-stat-card">
                                <span className="clinic-stat-number">{stats.total_stats.doctors}</span>
                                <span className="clinic-stat-label">{t('clinics.stats.doctors')}</span>
                            </div>
                            <div className="clinic-stat-card">
                                <span className="clinic-stat-number">{stats.total_stats.patients}</span>
                                <span className="clinic-stat-label">{t('clinics.stats.patients')}</span>
                            </div>
                            <div className="clinic-stat-card">
                                <span className="clinic-stat-number">{stats.total_stats.appointments}</span>
                                <span className="clinic-stat-label">{t('clinics.stats.appointments')}</span>
                            </div>
                            <div className="clinic-stat-card">
                                <span className="clinic-stat-number">{stats.total_stats.consultations}</span>
                                <span className="clinic-stat-label">{t('clinics.stats.consultations')}</span>
                            </div>
                            <div className="clinic-stat-card">
                                <span className="clinic-stat-number">{stats.total_stats.medical_procedures}</span>
                                <span className="clinic-stat-label">{t('clinics.stats.procedures')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="detail-info-group">
                        <h3>{t('clinics.stats.breakdown')}</h3>
                        <ul className="detail-list">
                            {stats.doctors_breakdown.map((doctor) => (
                                <li key={doctor.id} className="detail-list-item">
                                    <strong>{doctor.name}</strong>
                                    <div className="clinic-doctor-stats">
                                        <p>{t('clinics.stats.consultations')}: <strong>{doctor.consultations}</strong></p>
                                        <p>{t('clinics.stats.appointments')}: <strong>{doctor.appointments}</strong></p>
                                        <p>{t('clinics.stats.procedures')}: <strong>{doctor.medical_procedures}</strong></p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}
            {showDeleteConfirm && (
                <ConfirmModal
                    message={t('clinics.error.delete_confirm')}
                    onConfirm={handleDeleteClinic}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    );
};

export default ClinicDetail;