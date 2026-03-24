import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AdminProfile, AdminStats, AdminDoctor } from '../../../shared/types';
import api from '../../../shared/services/api';

interface AdminContextType {
    profile: AdminProfile | null;
    stats: AdminStats | null;
    isLoading: boolean;
    error: string | null;
    doctors: AdminDoctor[];
    totalDoctors: number;
    currentPage: number;
    logout: () => void;
    fetchStats: () => Promise<void>;
    fetchDoctors: (page: number) => Promise<void>;
    updateDoctorAccessLevel: (doctorId: number, accessLevel: 1 | 2) => Promise<void>;
    activateDoctor: (doctorId: number) => Promise<void>;
    deactivateDoctor: (doctorId: number) => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [profile, setProfile] = useState<AdminProfile | null>(null);
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
    const [totalDoctors, setTotalDoctors] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    // Set profile from localStorage on mount
    useEffect(() => {
        const storedProfile = localStorage.getItem('admin_profile');
        if (storedProfile) {
            setProfile(JSON.parse(storedProfile));
        }
    }, []);

    const logout = () => {
        localStorage.removeItem('admin_profile');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setProfile(null);
        setStats(null);
        setDoctors([]);
        setError(null);
    };

    const fetchStats = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get('/admin/stats/');
            setStats(response.data);
        } catch (err: any) {
            if (err.response?.status === 401) {
                logout();
                setError('Session expired. Please log in again.');
            } else if (err.response?.status === 403) {
                setError('You do not have permission to view admin statistics.');
            } else {
                setError('Failed to load statistics.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDoctors = async (page: number = 1) => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get('/admin/doctors/', {
                params: { page },
            });
            setDoctors(response.data.results);
            setTotalDoctors(response.data.count);
            setCurrentPage(page);
        } catch (err: any) {
            if (err.response?.status === 401) {
                logout();
                setError('Session expired. Please log in again.');
            } else if (err.response?.status === 403) {
                setError('You do not have permission to access doctors list.');
            } else {
                setError('Failed to load doctors.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const updateDoctorAccessLevel = async (doctorId: number, accessLevel: 1 | 2) => {
        try {
            setError(null);
            await api.patch(`/admin/doctors/${doctorId}/`, {
                access_level: accessLevel,
            });
            // Update local state
            setDoctors(doctors.map(d => d.id === doctorId ? { ...d, access_level: accessLevel } : d));
            // Refresh stats cache
            await fetchStats();
        } catch (_err) {
            setError('Failed to update doctor access level.');
        }
    };

    const activateDoctor = async (doctorId: number) => {
        try {
            setError(null);
            await api.post(`/admin/doctors/${doctorId}/activate/`);
            // Update local state
            setDoctors(doctors.map(d => d.id === doctorId ? { ...d, is_active: true } : d));
            // Refresh stats
            await fetchStats();
        } catch (_err) {
            setError('Failed to activate doctor.');
        }
    };

    const deactivateDoctor = async (doctorId: number) => {
        try {
            setError(null);
            await api.post(`/admin/doctors/${doctorId}/deactivate/`);
            // Update local state
            setDoctors(doctors.map(d => d.id === doctorId ? { ...d, is_active: false } : d));
            // Refresh stats
            await fetchStats();
        } catch (_err) {
            setError('Failed to deactivate doctor.');
        }
    };

    return (
        <AdminContext.Provider
            value={{
                profile,
                stats,
                isLoading,
                error,
                doctors,
                totalDoctors,
                currentPage,
                logout,
                fetchStats,
                fetchDoctors,
                updateDoctorAccessLevel,
                activateDoctor,
                deactivateDoctor,
            }}
        >
            {children}
        </AdminContext.Provider>
    );
};

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) {
        throw new Error('useAdmin must be used within AdminContextProvider');
    }
    return context;
};
