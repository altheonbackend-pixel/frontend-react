import React, { createContext, useState, useEffect, useRef } from 'react';
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
    const isAxiosInterceptorSet = useRef(false);

    // Fonction de déconnexion centralisée
    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setProfile(null);
        setIsAuthenticated(false);
        // Important: Utiliser replace pour ne pas ajouter la page de login à l'historique
        navigate('/login', { replace: true }); 
    };

    const getDoctorProfile = async (accessToken: string) => {
        try {
            const response = await api.get('/profile/', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
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
            setAuthIsLoading(false); // Doit être false si aucun token n'existe
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
                await getDoctorProfile(localToken);
            }
        } catch (error) {
            console.error('Erreur de décodage du token ou de récupération du profil:', error);
            logout();
        } finally {
            // 💡 CORRECTION DU FLASH : setAuthIsLoading à false IMMÉDIATEMENT (suppression du setTimeout)
            setAuthIsLoading(false); 
        }
    };

    useEffect(() => {
        checkTokenValidity();
        
        if (!isAxiosInterceptorSet.current) {
            
            // Intercepteur de Requête: Ajoute le Token
            axios.interceptors.request.use(
                config => {
                    const localToken = localStorage.getItem('token');
                    if (localToken) {
                        config.headers.Authorization = `Bearer ${localToken}`;
                    }
                    return config;
                },
                error => Promise.reject(error)
            );
        
            // Intercepteur de Réponse: Déconnexion automatique en cas d'erreur 401/403
            const responseInterceptor = axios.interceptors.response.use(
                (response) => response,
                (error) => {
                    if (error.response?.status === 401 || error.response?.status === 403) {
                        console.log('Requête non autorisée/expirée détectée. Déconnexion...');
                        logout(); 
                    }
                    return Promise.reject(error);
                }
            );
            
            isAxiosInterceptorSet.current = true;
            
            return () => {
                axios.interceptors.response.eject(responseInterceptor);
            };
        }
    }, []); 

    const login = async (credentials: any) => {
        // setAuthIsLoading(true); // Pas nécessaire ici car l'état 'loading' du bouton Login.tsx suffit.
        try {
            const response = await api.post('/login/', credentials);
            const accessToken = response.data.access;
            localStorage.setItem('token', accessToken);
            setToken(accessToken);
            setIsAuthenticated(true);
            await getDoctorProfile(accessToken);
            navigate('/dashboard');
        } catch (error) {
            console.error('Erreur de connexion:', error);
            // 💡 Ajouter un setAuthIsLoading(false) ici n'est pas nécessaire car c'est géré par le composant Login.tsx.
            // Cependant, si une erreur survient, l'état de l'application reste cohérent.
            throw error;
        } 
        // NOTE: Pas de finally ici, car si succès, la navigation démonte le composant.
    };

    const value = { user, profile, token, login, logout, isAuthenticated, authIsLoading, updateProfileData };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};