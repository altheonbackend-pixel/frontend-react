import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { type DoctorProfile, type User, type AdminProfile, type PatientProfile } from '../../../shared/types';
import api, { setLogoutCallback } from '../../../shared/services/api';
import { clearAllDraftsForDoctor } from '../../../shared/hooks/useFormDraft';

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
        // userType may be null when called from api.ts interceptor at mount time,
        // so fall back to localStorage to determine the correct login destination.
        const effectiveType = userType ?? localStorage.getItem('user_type');
        const logoutEndpoint = effectiveType === 'patient' ? '/patient/logout/' : '/logout/';
        api.post(logoutEndpoint).catch(() => {});
        setLogoutCallback(() => {});

        // Clear consultation drafts for the current doctor before signing out
        if (profile?.id) {
            clearAllDraftsForDoctor(profile.id);
        }

        // Clear any non-sensitive metadata we kept in localStorage
        localStorage.removeItem('user_type');
        localStorage.removeItem('admin_profile');

        setUser(null);
        setProfile(null);
        setAdminProfile(null);
        setPatientProfile(null);
        setUserType(null);
        setIsAuthenticated(false);
        navigate(effectiveType === 'patient' ? '/patient/login' : '/login', { replace: true });
    }, [navigate, profile, userType]);

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
        try {
            const res = await api.get('/me/');
            const { user_type, user: userData, profile: profileData, patient_profile: patientProfileData } = res.data;

            setUserType(user_type);
            setIsAuthenticated(true);

            if (user_type === 'admin') {
                const adminData: AdminProfile = {
                    user_type: 'admin',
                    email: userData.email,
                    full_name: userData.full_name,
                };
                setAdminProfile(adminData);
                localStorage.setItem('user_type', 'admin');
                localStorage.setItem('admin_profile', JSON.stringify(adminData));
            } else if (user_type === 'patient') {
                setUser({ id: userData.id || 0, email: userData.email, full_name: userData.full_name });
                setPatientProfile({
                    id: userData.id || 0,
                    patient_id: patientProfileData?.patient_id || '',
                    full_name: userData.full_name,
                    email: userData.email,
                    date_of_birth: '',
                    phone_number: '',
                    address: '',
                    emergency_contact_name: '',
                    emergency_contact_number: '',
                    blood_group: '',
                    primary_doctor_name: '',
                    email_verified: patientProfileData?.email_verified ?? true,
                    claim_status: patientProfileData?.claim_status || 'claimed',
                    preferred_language: patientProfileData?.preferred_language || 'en',
                });
                localStorage.setItem('user_type', 'patient');
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
            // 401 after refresh attempt failed, or network error — treat as logged out.
            // Read localStorage before clearing it so we can redirect to the right login page.
            const storedType = localStorage.getItem('user_type');
            localStorage.removeItem('user_type');
            localStorage.removeItem('admin_profile');
            setIsAuthenticated(false);
            if (storedType === 'patient') {
                navigate('/patient/login', { replace: true });
            } else if (storedType) {
                navigate('/login', { replace: true });
            }
        } finally {
            setAuthIsLoading(false);
        }
    }, [navigate]);

    // Keep the api.ts logout callback up-to-date when logout identity changes
    useEffect(() => {
        setLogoutCallback(logout);
    }, [logout]);

    // Validate session on mount — single /api/me/ call, cookie sent automatically
    useEffect(() => {
        initSession();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const login = async (credentials: { email: string; password: string }) => {
        const response = await api.post('/login/', credentials);
        const { user: loginUserData } = response.data;
        const userTypeFromResponse: 'doctor' | 'admin' | 'patient' = loginUserData.user_type || 'doctor';

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
        } else if (userTypeFromResponse === 'patient') {
            setUser({ id: 0, email: loginUserData.email, full_name: loginUserData.full_name });
            setPatientProfile({
                id: 0,
                patient_id: '',
                full_name: loginUserData.full_name,
                email: loginUserData.email,
                date_of_birth: '',
                phone_number: '',
                address: '',
                emergency_contact_name: '',
                emergency_contact_number: '',
                blood_group: '',
                primary_doctor_name: '',
                email_verified: true,
                claim_status: 'claimed',
                preferred_language: 'en',
            });
            setProfile(null);
            setAdminProfile(null);
            setIsAuthenticated(true);
            navigate('/patient/dashboard');
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
