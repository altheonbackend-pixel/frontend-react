import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';

// Set VITE_BYPASS_EMAIL_VERIFICATION=true in .env.local to skip email verification gate
const BYPASS_EMAIL_VERIFICATION = import.meta.env.VITE_BYPASS_EMAIL_VERIFICATION === 'true';

const PrivateRoutes = () => {
    const { isAuthenticated, authIsLoading, userType, emailVerified, profileComplete } = useAuth();
    const location = useLocation();

    if (authIsLoading) {
        return <div>Vérification de l'authentification...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Doctors only: enforce email verification gate (skipped if bypass enabled)
    if (userType === 'doctor' && !emailVerified && !BYPASS_EMAIL_VERIFICATION) {
        if (location.pathname !== '/verify-email') {
            return <Navigate to="/verify-email" replace />;
        }
    }

    // Doctors only: enforce profile completeness gate (after email verified)
    if (userType === 'doctor' && (emailVerified || BYPASS_EMAIL_VERIFICATION) && !profileComplete) {
        if (location.pathname !== '/complete-profile') {
            return <Navigate to="/complete-profile" replace />;
        }
    }

    return <Outlet />;
};

export default PrivateRoutes;
