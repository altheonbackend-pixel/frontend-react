import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type Workplace } from '../../../shared/types';
import { useAuth } from '../../auth/hooks/useAuth';
import '../styles/ClinicsList.css';
import api from '../../../shared/services/api';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import PageLoader from '../../../shared/components/PageLoader';
const ClinicList = () => {
    const { t } = useTranslation();
    const [clinics, setClinics] = useState<Workplace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    //const navigate = useNavigate();
    // Nous avons besoin de 'token' pour les appels API et de 'user.id' pour vérifier la propriété.
    const { token, user } = useAuth();
    // Assurez-vous que l'ID de l'utilisateur est bien l'ID du docteur (comme dans ClinicDetail)
    const currentDoctorId = user?.id; 
    const [confirmDeleteClinicId, setConfirmDeleteClinicId] = useState<number | null>(null);

    useEffect(() => {
        const fetchClinics = async () => {
            try {
                const response = await api.get('/workplaces/');
                const clinicsList = response.data.results ?? response.data;
                const sortedClinics = clinicsList.sort((a: Workplace, b: Workplace) => {
                  return (b.id || 0) - (a.id || 0);
                });
                setClinics(sortedClinics);
            } catch (err) {
                console.error("Erreur lors de la récupération des cliniques", err);
                setError(t('clinics.error.load'));
            } finally {
                setIsLoading(false);
            }
        };
        // N'exécutez le fetch que si le token est disponible
        if (token) {
            fetchClinics();
        }
    }, [token]);

    const handleDelete = async (clinicId: number) => {
        try {
            await api.delete(`/workplaces/${clinicId}/`);
            setClinics(clinics.filter(clinic => clinic.id !== clinicId));
            setConfirmDeleteClinicId(null);
        } catch (err) {
            console.error("Erreur lors de la suppression de la clinique", err);
            alert(t('clinics.error.delete_forbidden'));
        }
    };

    if (isLoading) {
        return <PageLoader message={t('clinics.loading')} />;
    }

    if (error) {
        return <div className="error-text">{error}</div>;
    }

    return (
        <div className="clinic-list-container">
            <div className="clinic-header">
                <h1 className="clinic-title">{t('clinics.list_title')}</h1>
                <Link to="/clinics/add" className="action-button add-clinic-button">
                    {t('clinics.add_button')}
                </Link>
            </div>
            {clinics.length === 0 ? (
                <p className="no-clinic-message">{t('clinics.no_clinics')}</p>
            ) : (
                <ul className="clinic-items-list">
                    {clinics.map((clinic) => {
                        // VÉRIFICATION DE LA PROPRIÉTÉ DANS LA LISTE
                        const isCreator = clinic.creator === currentDoctorId;
                        return (
                            <li key={clinic.id} className="clinic-item">
                                <div className="clinic-info">
                                    <h2 className="clinic-name">{clinic.name}</h2>
                                    <p className="clinic-address">{clinic.address}</p>
                                    <p className="clinic-status">
                                        {t('clinics.status_label')} <span className={clinic.is_public ? 'status-public' : 'status-private'}>
                                            {clinic.is_public ? t('clinics.status.public') : t('clinics.status.private')}
                                        </span>
                                    </p>
                                </div>
                                <div className="clinic-actions">
                                    <Link to={`/clinics/${clinic.id}`} className="action-button details-button">
                                        {t('clinics.details')}
                                    </Link>
                                    
                                    {/* NOUVEAU: Afficher les boutons d'action uniquement si l'utilisateur est le créateur */}
                                    {isCreator && (
                                        <>
                                            <Link to={`/clinics/edit/${clinic.id}`} className="action-button edit-button">
                                                {t('appointments.edit')}
                                            </Link>
                                            <button 
                                                onClick={() => setConfirmDeleteClinicId(clinic.id)} 
                                                className="action-button delete-button"
                                            >
                                                {t('appointments.delete')}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            {confirmDeleteClinicId !== null && (
                <ConfirmModal
                    message={t('clinics.error.delete_confirm')}
                    onConfirm={() => handleDelete(confirmDeleteClinicId)}
                    onCancel={() => setConfirmDeleteClinicId(null)}
                />
            )}
        </div>
    );
};

export default ClinicList;