import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { type DoctorProfile, type User, type AdminProfile, type PatientProfile } from '../../../shared/types';
import api from '../../../shared/services/api';
import { clearAllDraftsForDoctor } from '../../../shared/hooks/useFormDraft';
import { DEMO_PATIENT_CREDENTIALS, DEMO_PATIENT_PROFILE } from '../../patient-portal/mockData';

interface AuthContextType {
    user: User | null;
    profile: DoctorProfile | null;
    adminProfile: AdminProfile | null;
    patientProfile: PatientProfile | null;
    userType: 'doctor' | 'admin' | 'patient' | null;
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
    const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
    const [userType, setUserType] = useState<'doctor' | 'admin' | 'patient' | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [authIsLoading, setAuthIsLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    const logout = useCallback(() => {
        // Tell the server to blacklist the refresh token cookie and clear both cookies
        api.post('/logout/').catch(() => {
            // Ignore errors — local logout proceeds regardless
        });

        // Clear consultation drafts for the current doctor before signing out
        if (profile?.id) {
            clearAllDraftsForDoctor(profile.id);
        }

        // Clear any non-sensitive metadata we kept in localStorage
        localStorage.removeItem('user_type');
        localStorage.removeItem('admin_profile');
        localStorage.removeItem('demo_patient_session');

        setUser(null);
        setProfile(null);
        setAdminProfile(null);
        setPatientProfile(null);
        setUserType(null);
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
    }, [navigate, profile]);

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

    /**
     * Validate the current session by calling /api/me/.
     *
     * The httpOnly access_token cookie is sent automatically by the browser.
     * If it returns 200 → session is valid, hydrate React state.
     * If it returns 401 → session expired/invalid, clear state.
     * The response interceptor in api.ts will attempt a token refresh on 401
     * before this catch block runs, so a single expiry is handled silently.
     */
    const initSession = useCallback(async () => {
        const demoPatientSession = localStorage.getItem('demo_patient_session') === 'true';
        if (demoPatientSession) {
            setUserType('patient');
            setPatientProfile(DEMO_PATIENT_PROFILE);
            setUser({
                id: DEMO_PATIENT_PROFILE.id,
                email: DEMO_PATIENT_PROFILE.email,
                full_name: DEMO_PATIENT_PROFILE.full_name,
            });
            setIsAuthenticated(true);
            setAuthIsLoading(false);
            return;
        }

        try {
            const res = await api.get('/me/');
            const { user_type, user: userData, profile: profileData } = res.data;

            setUserType(user_type);
            setIsAuthenticated(true);

            if (user_type === 'admin') {
                const adminData: AdminProfile = {
                    user_type: 'admin',
                    email: userData.email,
                    full_name: userData.full_name,
                };
                setAdminProfile(adminData);
                // Store non-sensitive admin metadata for fast re-hydration hint
                localStorage.setItem('user_type', 'admin');
                localStorage.setItem('admin_profile', JSON.stringify(adminData));
            } else {
                setUser({
                    id: userData.id,
                    email: userData.email,
                    full_name: userData.full_name,
                    access_level: userData.access_level || 1,
                    specialty: userData.specialty,
                    phone_number: profileData?.phone_number,
                    address: profileData?.address,
                });
                setProfile(profileData);
                localStorage.setItem('user_type', 'doctor');
            }
        } catch {
            // 401 after refresh attempt failed, or network error — treat as logged out
            setIsAuthenticated(false);
        } finally {
            setAuthIsLoading(false);
        }
    }, []);

    // Register the 401 response interceptor so any mid-session expiry triggers logout.
    // 403 (access level denied) is NOT a logout condition.
    // Auth-related endpoints are excluded: /logout/ calling logout() would loop back
    // into itself, and /token/refresh/ + /me/ are handled by api.ts and initSession().
    useEffect(() => {
        const responseInterceptor = api.interceptors.response.use(
            (response) => response,
            (error) => {
                const url = (error.config?.url ?? '') as string;
                const isAuthEndpoint = /\/(logout|token\/refresh|me)\//i.test(url);
                if (error.response?.status === 401 && !isAuthEndpoint) {
                    logout();
                }
                return Promise.reject(error);
            }
        );
        return () => {
            api.interceptors.response.eject(responseInterceptor);
        };
    }, [logout]);

    // Validate session on mount — single /api/me/ call, cookie sent automatically
    useEffect(() => {
        initSession();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const login = async (credentials: { email: string; password: string }) => {
        if (
            credentials.email.trim().toLowerCase() === DEMO_PATIENT_CREDENTIALS.email &&
            credentials.password === DEMO_PATIENT_CREDENTIALS.password
        ) {
            setUserType('patient');
            setPatientProfile(DEMO_PATIENT_PROFILE);
            setUser({
                id: DEMO_PATIENT_PROFILE.id,
                email: DEMO_PATIENT_PROFILE.email,
                full_name: DEMO_PATIENT_PROFILE.full_name,
            });
            setProfile(null);
            setAdminProfile(null);
            setIsAuthenticated(true);
            localStorage.setItem('user_type', 'patient');
            localStorage.setItem('demo_patient_session', 'true');
            navigate('/patient/dashboard');
            return;
        }

        const response = await api.post('/login/', credentials);
        const { user: loginUserData } = response.data;
        const userTypeFromResponse: 'doctor' | 'admin' = loginUserData.user_type || 'doctor';

        // Tokens are in httpOnly cookies — never stored in JS memory or localStorage
        setUserType(userTypeFromResponse);
        localStorage.setItem('user_type', userTypeFromResponse);

        if (userTypeFromResponse === 'admin') {
            const adminData: AdminProfile = {
                user_type: 'admin',
                email: loginUserData.email,
                full_name: loginUserData.full_name,
            };
            setAdminProfile(adminData);
            setPatientProfile(null);
            localStorage.setItem('admin_profile', JSON.stringify(adminData));
            setIsAuthenticated(true);
            navigate('/admin/dashboard');
        } else {
            setUser({
                id: loginUserData.id,
                email: loginUserData.email,
                full_name: loginUserData.full_name,
                access_level: loginUserData.access_level || 1,
                specialty: loginUserData.specialty,
            });
            setIsAuthenticated(true);
            setPatientProfile(null);
            // Fetch full doctor profile now that cookies are set
            const profileRes = await api.get('/profile/');
            setProfile(profileRes.data);
            navigate('/dashboard');
        }
    };

    // Derived state
    const emailVerified = userType === 'admin' || userType === 'patient' || (profile?.email_verified ?? true);
    const profileComplete = userType === 'admin' || userType === 'patient' || !!(
        profile?.phone_number && profile.phone_number.trim() &&
        profile?.address && profile.address.trim()
    );

    const value = {
        user, profile, adminProfile, patientProfile, userType, login, logout,
        isAuthenticated, authIsLoading, updateProfileData,
        hasAccessLevel, emailVerified, profileComplete,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
