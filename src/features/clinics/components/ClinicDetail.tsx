import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { type Workplace } from '../../../shared/types'; // Assurez-vous que l'import est correct
import { useAuth } from '../../auth/hooks/useAuth';
import '../../../shared/styles/DetailStyles.css';
import api from '../../../shared/services/api';

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

    useEffect(() => {
        const fetchClinicAndStats = async () => {
            if (!token || !id) return;

            try {
                setIsLoading(true);
                const [clinicResponse, statsResponse] = await Promise.all([
                    axios.get<Workplace>(`${API_BASE_URL}/workplaces/${id}/`),
                    axios.get<ClinicStats>(`${API_BASE_URL}/workplaces/${id}/statistics/`)
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
        if (window.confirm(t('clinics.error.delete_confirm'))) {
            try {
                await api.delete('/workplaces/${id}/');
                alert(t('clinics.success.delete'));
                navigate('/clinics'); // Rediriger vers la liste des cliniques après suppression
            } catch (err) {
                console.error("Erreur lors de la suppression de la clinique:", err);
                alert(t('clinics.error.delete_detail'));
            }
        }
    };

    if (isLoading) {
        return <div className="text-center mt-8">{t('clinics.loading_detail')}</div>;
    }

    if (error) {
        return <div className="text-center mt-8 text-red-500">{error}</div>;
    }

    if (!clinic) {
        return <div className="text-center mt-8">{t('clinics.not_found')}</div>;
    }

    // Le backend doit s'assurer que clinic.creator contient l'ID du docteur.
    // Vérifier si l'utilisateur connecté est le créateur de cette clinique
    const isCreator = clinic.creator === currentDoctorId;
    
    // Rendu...
    return (
        <div className="container mx-auto p-4 detail-container">
            <div className="detail-header">
                <h1 className="text-3xl font-bold mb-4">{clinic.name}</h1>
                {/* Conditionnel basé sur isCreator */}
                {isCreator && (
                    <div className="flex space-x-4">
                        <button
                            onClick={handleEditClinic}
                            className="edit-button action-button"
                        >
                            {t('appointments.edit')} ✏️
                        </button>
                        <button
                            onClick={handleDeleteClinic}
                            className="delete-button action-button"
                        >
                            {t('appointments.delete')} 🗑️
                        </button>
                    </div>
                )}
            </div>
            
            {/* Le reste du rendu des détails et statistiques (inchangé) */}
            <div className="clinic-info-details detail-info-group">
                <p className="text-lg text-gray-700 mb-2"><strong>{t('clinics.label.address')}:</strong> {clinic.address}</p>
                <p className="text-lg text-gray-700 mb-4"><strong>{t('clinics.status_label')}</strong> {clinic.is_public ? t('clinics.status.public') : t('clinics.status.private')}</p>
            </div>
            {/* ... Rendu des statistiques ... */}
            {stats && (
                <>
                    <h2 className="text-2xl font-bold mt-8 mb-4">{t('clinics.stats.general')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        {/* ... Stats Totales ... */}
                        <div className="bg-blue-100 p-4 rounded-lg shadow-sm">
                            <h3 className="text-xl font-semibold">{t('clinics.stats.doctors')}</h3>
                            <p className="text-3xl">{stats.total_stats.doctors}</p>
                        </div>
                        <div className="bg-green-100 p-4 rounded-lg shadow-sm">
                            <h3 className="text-xl font-semibold">{t('clinics.stats.patients')}</h3>
                            <p className="text-3xl">{stats.total_stats.patients}</p>
                        </div>
                        <div className="bg-purple-100 p-4 rounded-lg shadow-sm">
                            <h3 className="text-xl font-semibold">{t('clinics.stats.appointments')}</h3>
                            <p className="text-3xl">{stats.total_stats.appointments}</p>
                        </div>
                        <div className="bg-orange-100 p-4 rounded-lg shadow-sm">
                            <h3 className="text-xl font-semibold">{t('clinics.stats.consultations')}</h3>
                            <p className="text-3xl">{stats.total_stats.consultations}</p>
                        </div>
                        <div className="bg-red-100 p-4 rounded-lg shadow-sm">
                            <h3 className="text-xl font-semibold">{t('clinics.stats.procedures')}</h3>
                            <p className="text-3xl">{stats.total_stats.medical_procedures}</p>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold mt-8 mb-4">{t('clinics.stats.breakdown')}</h2>
                    <ul className="space-y-4">
                        {stats.doctors_breakdown.map((doctor) => (
                            <li key={doctor.id} className="bg-gray-100 p-4 rounded-lg shadow-sm">
                                <h3 className="text-xl font-semibold">{doctor.name}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-sm">
                                    <p>{t('clinics.stats.consultations')}: <span className="font-bold">{doctor.consultations}</span></p>
                                    <p>{t('clinics.stats.appointments')}: <span className="font-bold">{doctor.appointments}</span></p>
                                    <p>{t('clinics.stats.procedures')}: <span className="font-bold">{doctor.medical_procedures}</span></p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};

export default ClinicDetail;