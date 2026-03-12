import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import { type DoctorProfile, type User } from '../../../shared/types';
import api from '../../../shared/services/api';

interface AuthContextType {
    user: User | null;
    profile: DoctorProfile | null;
    token: string | null;
    login: (credentials: any) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    authIsLoading: boolean;
    updateProfileData: (newProfile: DoctorProfile) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<DoctorProfile | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [authIsLoading, setAuthIsLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    // Wrapped in useCallback so the stable reference can be used in the api response interceptor
    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        setToken(null);
        setUser(null);
        setProfile(null);
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
    }, [navigate]);

    const getDoctorProfile = async () => {
        try {
            // No manual Authorization header needed — api.ts request interceptor injects it
            const response = await api.get('/profile/');
            const profileData = response.data;
            setProfile(profileData);
            setUser({
                id: profileData.id,
                email: profileData.email,
                full_name: profileData.full_name,
                specialty: profileData.specialty,
                phone_number: profileData.phone_number,
                address: profileData.address,
            });
        } catch (err) {
            console.error('Erreur lors de la récupération du profil:', err);
            // Let the api response interceptor handle 401/403 for mid-session calls.
            // For the initial startup call (before interceptor is bound), handle it here.
            if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
                logout();
            }
            throw err;
        }
    };
    
    const updateProfileData = (newProfile: DoctorProfile) => {
        setProfile(newProfile);
        setUser({
            id: newProfile.id,
            email: newProfile.email,
            full_name: newProfile.full_name,
            specialty: newProfile.specialty,
            phone_number: newProfile.phone_number,
            address: newProfile.address,
        });
    };

    const checkTokenValidity = async () => {
        const localToken = localStorage.getItem('token');
        if (!localToken) {
            setIsAuthenticated(false);
            setAuthIsLoading(false);
            return;
        }

        try {
            const decodedToken: any = jwtDecode(localToken);
            const currentTime = Date.now() / 1000;
            if (decodedToken.exp < currentTime) {
                console.log('Token expiré');
                logout();
            } else {
                setToken(localToken);
                setIsAuthenticated(true);
                await getDoctorProfile();
            }
        } catch (error) {
            console.error('Erreur de décodage du token ou de récupération du profil:', error);
            logout();
        } finally {
            setAuthIsLoading(false);
        }
    };

    // Register the 401/403 response interceptor on the central api instance so that
    // any mid-session expired token triggers logout and navigation automatically.
    // This replaces the previous global axios interceptors which did not fire on the api instance.
    useEffect(() => {
        const responseInterceptor = api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    console.log('Requête non autorisée/expirée détectée. Déconnexion...');
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.response.eject(responseInterceptor);
        };
    }, [logout]);

    // Run token validity check once on mount
    useEffect(() => {
        checkTokenValidity();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const login = async (credentials: any) => {
        try {
            const response = await api.post('/login/', credentials);
            const accessToken = response.data.access;
            const refreshToken = response.data.refresh;
            localStorage.setItem('token', accessToken);
            if (refreshToken) {
                localStorage.setItem('refresh_token', refreshToken);
            }
            setToken(accessToken);
            setIsAuthenticated(true);
            await getDoctorProfile();
            navigate('/dashboard');
        } catch (error) {
            console.error('Erreur de connexion:', error);
            throw error;
        }
    };

    const value = { user, profile, token, login, logout, isAuthenticated, authIsLoading, updateProfileData };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};