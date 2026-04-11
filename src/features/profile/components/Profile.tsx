import { useAuth } from '../../auth/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type Workplace } from '../../../shared/types';
import '../../../shared/styles/DetailStyles.css'; // Assurez-vous que le fichier CSS est bien importé

const Profile = () => {
    const { t } = useTranslation();
    const { profile, authIsLoading } = useAuth();
    const navigate = useNavigate();

    const handleEditClick = () => {
        navigate('/edit-profile');
    };

    if (authIsLoading) {
        return <div className="loading-message">{t('profile.loading')}</div>;
    }

    if (!profile) {
        return <div className="no-profile-data">{t('profile.no_data')}</div>;
    }

    return (
        <div className="profile-container detail-container">
            <div className="profile-header detail-header">
                <h2 className="page-title">{t('profile.title')}</h2>
                <button onClick={handleEditClick} className="edit-profile-button action-button">
                    {t('profile.edit')}
                </button>
            </div>
            
            <div className="profile-details detail-info-group">
                <p className="info-item"><strong>{t('profile.full_name')}</strong> {profile.full_name}</p>
                <p className="info-item"><strong>{t('profile.email')}</strong> {profile.email}</p>
                <p className="info-item"><strong>{t('profile.specialty')}</strong> {profile.specialty_display || profile.specialty || t('profile.unspecified')}</p>
                <p className="info-item"><strong>{t('profile.license')}</strong> {profile.license_number || t('profile.unspecified')}</p>
                <p className="info-item"><strong>{t('profile.address')}</strong> {profile.address || t('profile.unspecified')}</p>
                
                <p className="info-item"><strong>{t('profile.workplaces')}</strong></p>
                {profile.workplaces && profile.workplaces.length > 0 ? (
                    <ul>
                        {profile.workplaces.map((workplace: Workplace) => (
                            <li key={workplace.id} className="detail-list-item">{workplace.name}</li>
                        ))}
                    </ul>
                ) : (
                    <p>{t('profile.unspecified')}</p>
                )}
            </div>
        </div>
    );
};

export default Profile;