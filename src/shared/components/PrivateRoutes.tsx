//import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';

const PrivateRoutes = () => {
    const { isAuthenticated, authIsLoading } = useAuth();
    
    if (authIsLoading) {
        return <div>Vérification de l'authentification...</div>;
    }

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoutes;