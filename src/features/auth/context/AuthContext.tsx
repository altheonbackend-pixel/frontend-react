import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import { type DoctorProfile, type User, type AdminProfile } from '../../../shared/types';
import api from '../../../shared/services/api';

interface AuthContextType {
    user: User | null;
    profile: DoctorProfile | null;
    adminProfile: AdminProfile | null;
    token: string | null;
    userType: 'doctor' | 'admin' | null;
    login: (credentials: { email: string; password: string }) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    authIsLoading: boolean;
    updateProfileData: (newProfile: DoctorProfile) => void;
    hasAccessLevel: (requiredLevel: number) => boolean;
    emailVerified: boolean;
    profileComplete: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<DoctorProfile | null>(null);
    const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('access_token') || localStorage.getItem('token'));
    const [userType, setUserType] = useState<'doctor' | 'admin' | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [authIsLoading, setAuthIsLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    // Wrapped in useCallback so the stable reference can be used in the api response interceptor
    const logout = useCallback(() => {
        // Blacklist the refresh token server-side (fire-and-forget — don't block local logout)
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
            import('../../../shared/services/api').then(({ default: api }) => {
                api.post('/auth/logout/', { refresh: refreshToken }).catch(() => {
                    // Ignore errors — local logout proceeds regardless
                });
            });
        }
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('admin_profile');
        setToken(null);
        setUser(null);
        setProfile(null);
        setAdminProfile(null);
        setUserType(null);
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
                access_level: profileData.access_level || 1,
                specialty: profileData.specialty,
                phone_number: profileData.phone_number,
                address: profileData.address,
            });
        } catch (err) {
            // Only logout on 401 (token expired). 403 is handled by access level gating, not auth.
            if (axios.isAxiosError(err) && err.response?.status === 401) {
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
            access_level: newProfile.access_level,
            specialty: newProfile.specialty,
            phone_number: newProfile.phone_number,
            address: newProfile.address,
        });
    };

    const hasAccessLevel = (requiredLevel: number): boolean => {
        if (!profile) return false;
        return profile.access_level >= requiredLevel;
    };

    const checkTokenValidity = async () => {
        const localToken = localStorage.getItem('access_token') || localStorage.getItem('token');
        const storedAdminProfile = localStorage.getItem('admin_profile');

        if (!localToken) {
            setIsAuthenticated(false);
            setAuthIsLoading(false);
            return;
        }

        try {
            const decodedToken = jwtDecode<{ user_id: number; exp: number }>(localToken);
            const currentTime = Date.now() / 1000;
            if (decodedToken.exp < currentTime) {
                logout();
            } else {
                setToken(localToken);
                setIsAuthenticated(true);

                // If admin profile stored, use it
                if (storedAdminProfile) {
                    setAdminProfile(JSON.parse(storedAdminProfile));
                    setUserType('admin');
                } else {
                    // Otherwise treat as doctor and fetch profile
                    setUserType('doctor');
                    await getDoctorProfile();
                }
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status;
                if (status === 401) {
                    logout();
                } else if (status === 403) {
                    setIsAuthenticated(true);
                } else {
                    setIsAuthenticated(true);
                }
            } else {
                logout();
            }
        } finally {
            setAuthIsLoading(false);
        }
    };

    // Register the 401 response interceptor on the central api instance so that
    // any mid-session expired token triggers logout and navigation automatically.
    // Note: 403 (access denied) is NOT a logout condition — it's handled by access level gating.
    useEffect(() => {
        const responseInterceptor = api.interceptors.response.use(
            (response) => response,
            (error) => {
                // Only logout on 401 (token expired/invalid)
                if (error.response?.status === 401) {
                    logout();
                }
                // 403 and all other errors: let the component handle it
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

    const login = async (credentials: { email: string; password: string }) => {
        try {
            const response = await api.post('/login/', credentials);
            const accessToken = response.data.access;
            const refreshToken = response.data.refresh;
            const loginUserData = response.data.user;
            const userTypeFromResponse = loginUserData.user_type || 'doctor';

            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('token', accessToken);
            localStorage.setItem('user_type', userTypeFromResponse);
            if (refreshToken) {
                localStorage.setItem('refresh_token', refreshToken);
            }
            setToken(accessToken);
            setUserType(userTypeFromResponse);

            // Handle admin login
            if (userTypeFromResponse === 'admin') {
                const adminData: AdminProfile = {
                    user_type: 'admin',
                    email: loginUserData.email,
                    full_name: loginUserData.full_name,
                };
                setAdminProfile(adminData);
                localStorage.setItem('admin_profile', JSON.stringify(adminData));
                setIsAuthenticated(true);
                navigate('/admin/dashboard');
            }
            // Handle doctor login
            else if (userTypeFromResponse === 'doctor') {
                setUser({
                    id: loginUserData.id,
                    email: loginUserData.email,
                    full_name: loginUserData.full_name,
                    access_level: loginUserData.access_level || 1,
                    specialty: loginUserData.specialty,
                });
                setIsAuthenticated(true);
                await getDoctorProfile();
                navigate('/dashboard');
            }
        } catch (error) {
            throw error;
        }
    };

    // Derived state — computed from profile each render
    const emailVerified = userType === 'admin' || (profile?.email_verified ?? true);
    const profileComplete = userType === 'admin' || !!(
        profile?.phone_number && profile.phone_number.trim() &&
        profile?.address && profile.address.trim()
    );

    const value = { user, profile, adminProfile, token, userType, login, logout, isAuthenticated, authIsLoading, updateProfileData, hasAccessLevel, emailVerified, profileComplete };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};