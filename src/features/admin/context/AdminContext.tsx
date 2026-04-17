import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AdminProfile, AdminStats, AdminDoctor } from '../../../shared/types';
import api from '../../../shared/services/api';

interface AdminContextType {
    profile: AdminProfile | null;
    stats: AdminStats | null;
    isLoading: boolean;
    error: string | null;

    // Doctors
    doctors: AdminDoctor[];
    totalDoctors: number;
    currentPage: number;
    pendingDoctors: AdminDoctor[];
    totalPending: number;
    rejectedDoctors: AdminDoctor[];
    totalRejected: number;

    logout: () => void;

    // Stats
    fetchStats: () => Promise<void>;

    // Doctor management
    fetchDoctors: (page: number) => Promise<void>;
    fetchPendingDoctors: (page: number) => Promise<void>;
    fetchRejectedDoctors: (page: number) => Promise<void>;
    updateDoctorAccessLevel: (doctorId: number, accessLevel: 1 | 2) => Promise<void>;
    activateDoctor: (doctorId: number) => Promise<void>;
    deactivateDoctor: (doctorId: number) => Promise<void>;
    approveDoctor: (doctorId: number) => Promise<void>;
    rejectDoctor: (doctorId: number, reason: string) => Promise<void>;
    transferPatients: (fromDoctorId: number, toDoctorId: number) => Promise<{ transferred_count: number; from_doctor: string; to_doctor: string }>;
    searchDoctors: (query: string) => Promise<AdminDoctor[]>;
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

    const [pendingDoctors, setPendingDoctors] = useState<AdminDoctor[]>([]);
    const [totalPending, setTotalPending] = useState(0);

    const [rejectedDoctors, setRejectedDoctors] = useState<AdminDoctor[]>([]);
    const [totalRejected, setTotalRejected] = useState(0);

    useEffect(() => {
        const storedProfile = localStorage.getItem('admin_profile');
        if (storedProfile) {
            setProfile(JSON.parse(storedProfile));
        }
    }, []);

    const logout = () => {
        localStorage.removeItem('admin_profile');
        setProfile(null);
        setStats(null);
        setDoctors([]);
        setPendingDoctors([]);
        setRejectedDoctors([]);
        setError(null);
    };

    const handleError = (err: unknown, fallback: string) => {
        const e = err as { response?: { status: number } };
        if (e.response?.status === 401) {
            logout();
            setError('Session expired. Please log in again.');
        } else if (e.response?.status === 403) {
            setError('You do not have permission to perform this action.');
        } else {
            setError(fallback);
        }
    };

    // ── Stats ─────────────────────────────────────────────────────────────────
    const fetchStats = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get('/admin/stats/');
            setStats(response.data);
        } catch (err) {
            handleError(err, 'Failed to load statistics.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Active doctors ────────────────────────────────────────────────────────
    const fetchDoctors = async (page = 1) => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get('/admin/doctors/', { params: { page } });
            setDoctors(response.data.results);
            setTotalDoctors(response.data.count);
            setCurrentPage(page);
        } catch (err) {
            handleError(err, 'Failed to load doctors.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Pending doctors ───────────────────────────────────────────────────────
    const fetchPendingDoctors = async (page = 1) => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get('/admin/doctors/pending/', { params: { page } });
            setPendingDoctors(response.data.results);
            setTotalPending(response.data.count);
        } catch (err) {
            handleError(err, 'Failed to load pending doctors.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Rejected doctors ──────────────────────────────────────────────────────
    const fetchRejectedDoctors = async (page = 1) => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get('/admin/doctors/rejected/', { params: { page } });
            setRejectedDoctors(response.data.results);
            setTotalRejected(response.data.count);
        } catch (err) {
            handleError(err, 'Failed to load rejected doctors.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Doctor actions ────────────────────────────────────────────────────────
    const updateDoctorAccessLevel = async (doctorId: number, accessLevel: 1 | 2) => {
        try {
            setError(null);
            await api.patch(`/admin/doctors/${doctorId}/`, { access_level: accessLevel });
            setDoctors(prev => prev.map(d => d.id === doctorId ? { ...d, access_level: accessLevel } : d));
            await fetchStats();
        } catch (_err) {
            setError('Failed to update access level.');
        }
    };

    const activateDoctor = async (doctorId: number) => {
        try {
            setError(null);
            const res = await api.post(`/admin/doctors/${doctorId}/activate/`);
            setDoctors(prev => prev.map(d => d.id === doctorId ? { ...d, is_active: true } : d));
            setRejectedDoctors(prev => prev.map(d => d.id === doctorId ? res.data : d));
            await fetchStats();
        } catch (_err) {
            setError('Failed to activate doctor.');
        }
    };

    const deactivateDoctor = async (doctorId: number) => {
        try {
            setError(null);
            await api.post(`/admin/doctors/${doctorId}/deactivate/`);
            setDoctors(prev => prev.map(d => d.id === doctorId ? { ...d, is_active: false } : d));
            await fetchStats();
        } catch (_err) {
            setError('Failed to deactivate doctor.');
        }
    };

    const approveDoctor = async (doctorId: number) => {
        try {
            setError(null);
            await api.post(`/admin/doctors/${doctorId}/approve/`);
            setPendingDoctors(prev => prev.filter(d => d.id !== doctorId));
            setTotalPending(prev => Math.max(0, prev - 1));
            await fetchStats();
            await fetchDoctors(1);
        } catch (_err) {
            setError('Failed to approve doctor.');
        }
    };

    const rejectDoctor = async (doctorId: number, reason: string) => {
        try {
            setError(null);
            await api.post(`/admin/doctors/${doctorId}/reject/`, { reason });
            setPendingDoctors(prev => prev.filter(d => d.id !== doctorId));
            setTotalPending(prev => Math.max(0, prev - 1));
            await fetchStats();
        } catch (_err) {
            setError('Failed to reject doctor.');
        }
    };

    const transferPatients = async (fromDoctorId: number, toDoctorId: number) => {
        const res = await api.post(`/admin/doctors/${fromDoctorId}/transfer-patients/`, {
            to_doctor_id: toDoctorId,
        });
        return res.data as { transferred_count: number; from_doctor: string; to_doctor: string };
    };

    const searchDoctors = async (query: string): Promise<AdminDoctor[]> => {
        const res = await api.get('/admin/doctors/search/', { params: { q: query } });
        return res.data.results;
    };

    return (
        <AdminContext.Provider
            value={{
                profile, stats, isLoading, error,
                doctors, totalDoctors, currentPage,
                pendingDoctors, totalPending,
                rejectedDoctors, totalRejected,
                logout,
                fetchStats,
                fetchDoctors, fetchPendingDoctors, fetchRejectedDoctors,
                updateDoctorAccessLevel,
                activateDoctor, deactivateDoctor,
                approveDoctor, rejectDoctor,
                transferPatients,
                searchDoctors,
            }}
        >
            {children}
        </AdminContext.Provider>
    );
};

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) throw new Error('useAdmin must be used within AdminContextProvider');
    return context;
};
