import React from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import './AccessLevelRoute.css';

interface AccessLevelRouteProps {
    requiredLevel: number;
    children: React.ReactNode;
}

const AccessLevelRoute: React.FC<AccessLevelRouteProps> = ({ requiredLevel, children }) => {
    const { profile } = useAuth();

    if (!profile) {
        return null; // Should not happen, PrivateRoutes guards this
    }

    if (profile.access_level < requiredLevel) {
        return (
            <div className="access-restricted-container">
                <div className="access-restricted-card">
                    <h1 className="access-title">🔒 Access Restricted</h1>
                    <p className="access-message">
                        Your access level does not permit this action.
                    </p>
                    <p className="access-detail">
                        Level {profile.access_level} account detected. This feature requires Level {requiredLevel} access.
                    </p>
                    <p className="access-contact">
                        Please contact your administrator to upgrade your account.
                    </p>
                    <button
                        className="access-back-btn"
                        onClick={() => window.history.back()}
                    >
                        ← Go Back
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default AccessLevelRoute;
