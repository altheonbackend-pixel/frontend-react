// src/features/profile/components/Profile.tsx

import { useAuth } from '../../auth/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../shared/components/PageHeader';
import { Avatar } from '../../../shared/components/Avatar';

const Profile = () => {
    const { t } = useTranslation();
    const { profile, authIsLoading } = useAuth();

    if (authIsLoading) {
        return <div className="loading-message">{t('profile.loading')}</div>;
    }

    if (!profile) {
        return <div className="no-profile-data">{t('profile.no_data')}</div>;
    }

    const doctorName = profile.full_name ?? '';

    return (
        <>
            <PageHeader
                title={t('profile.title', 'My Profile')}
                actions={
                    <Link to="/edit-profile" className="btn btn-secondary btn-sm">
                        {t('profile.edit', 'Edit Profile')}
                    </Link>
                }
            />

            <div style={{ maxWidth: 520 }}>
                <div className="section-card">
                    <div className="section-card-body" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                            <Avatar name={doctorName} size="xl" ring />
                        </div>
                        <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                            Dr. {doctorName}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                            {profile.specialty_display || profile.specialty || t('profile.unspecified', 'Unspecified specialty')}
                        </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '1rem 1.25rem' }}>
                        <div className="profile-info-item">
                            <span className="profile-info-label">{t('profile.email', 'Email')}</span>
                            <span className="profile-info-value">{profile.email}</span>
                        </div>
                        <div className="profile-info-item">
                            <span className="profile-info-label">{t('profile.license', 'License')}</span>
                            <span className="profile-info-value">{profile.license_number || '—'}</span>
                        </div>
                        <div className="profile-info-item">
                            <span className="profile-info-label">{t('profile.phone', 'Phone')}</span>
                            <span className="profile-info-value">{profile.phone_number || '—'}</span>
                        </div>
                        <div className="profile-info-item">
                            <span className="profile-info-label">{t('profile.address', 'Address')}</span>
                            <span className="profile-info-value">{profile.address || '—'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Profile;
