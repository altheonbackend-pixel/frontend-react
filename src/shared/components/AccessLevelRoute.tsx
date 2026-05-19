import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/hooks/useAuth';
import PageLoader from './PageLoader';
import './AccessLevelRoute.css';

interface AccessLevelRouteProps {
    requiredLevel: number;
    children: React.ReactNode;
}

const AccessLevelRoute: React.FC<AccessLevelRouteProps> = ({ requiredLevel, children }) => {
    const { t } = useTranslation();
    const { profile } = useAuth();

    if (!profile) {
        return <PageLoader message={t('common.loading')} />;
    }

    if (profile.access_level < requiredLevel) {
        return (
            <div className="access-restricted-container">
                <div className="access-restricted-card">
                    <h1 className="access-title">{t('access_restricted.title')}</h1>
                    <p className="access-message">
                        {t('access_restricted.message')}
                    </p>
                    <p className="access-detail">
                        {t('access_restricted.detail', { current: profile.access_level, required: requiredLevel })}
                    </p>
                    <p className="access-contact">
                        {t('access_restricted.contact')}
                    </p>
                    <button
                        className="access-back-btn"
                        onClick={() => window.history.back()}
                    >
                        {t('access_restricted.go_back')}
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default AccessLevelRoute;
