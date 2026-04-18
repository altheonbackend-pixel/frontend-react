import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PatientProfile } from '../../../shared/types';
import {
    createInitialPatientPortalState,
    type PatientDoctorOption,
    type PatientPortalAppointment,
    type PatientPortalLab,
    type PatientPortalMedication,
    type PatientPortalNotification,
    type PatientPortalSettings,
    type PatientPortalState,
    type PatientPortalVisit,
} from '../mockData';

const STORAGE_KEY = 'altheon_patient_portal_demo_state';

interface RequestAppointmentInput {
    doctorId: number;
    appointmentDate: string;
    type: 'in_person' | 'telemedicine';
    reason: string;
    notes: string;
}

interface PatientPortalContextType {
    doctors: PatientDoctorOption[];
    appointments: PatientPortalAppointment[];
    visits: PatientPortalVisit[];
    medications: PatientPortalMedication[];
    labs: PatientPortalLab[];
    notifications: PatientPortalNotification[];
    settings: PatientPortalSettings;
    profile: PatientProfile;
    unreadCount: number;
    requestAppointment: (input: RequestAppointmentInput) => void;
    markNotificationRead: (id: number) => void;
    markAllNotificationsRead: () => void;
    updateProfile: (updates: Partial<PatientProfile>) => void;
    updateSettings: (updates: Partial<PatientPortalSettings>) => void;
}

const PatientPortalContext = createContext<PatientPortalContextType | undefined>(undefined);

function loadInitialState(): PatientPortalState {
    if (typeof window === 'undefined') return createInitialPatientPortalState();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialPatientPortalState();
    try {
        return JSON.parse(raw) as PatientPortalState;
    } catch {
        return createInitialPatientPortalState();
    }
}

export function PatientPortalProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<PatientPortalState>(() => loadInitialState());

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);

    const requestAppointment = (input: RequestAppointmentInput) => {
        const doctor = state.doctors.find(d => d.id === input.doctorId);
        if (!doctor) return;

        const nextId = Math.max(0, ...state.appointments.map(a => a.id)) + 1;
        const nextNotifId = Math.max(0, ...state.notifications.map(n => n.id)) + 1;

        setState(prev => ({
            ...prev,
            appointments: [
                {
                    id: nextId,
                    doctor_id: doctor.id,
                    doctor_name: doctor.full_name,
                    specialty: doctor.specialty,
                    clinic: doctor.clinic,
                    appointment_date: input.appointmentDate,
                    type: input.type,
                    status: 'pending',
                    reason: input.reason,
                    notes: input.notes || 'Awaiting doctor approval.',
                    requested_at: new Date().toISOString(),
                    requires_approval: true,
                },
                ...prev.appointments,
            ],
            notifications: [
                {
                    id: nextNotifId,
                    title: 'Appointment request submitted',
                    body: `Your request with ${doctor.full_name} has been sent and is awaiting approval.`,
                    created_at: new Date().toISOString(),
                    is_read: false,
                    link: '/patient/appointments',
                },
                ...prev.notifications,
            ],
        }));
    };

    const markNotificationRead = (id: number) => {
        setState(prev => ({
            ...prev,
            notifications: prev.notifications.map(item => item.id === id ? { ...item, is_read: true } : item),
        }));
    };

    const markAllNotificationsRead = () => {
        setState(prev => ({
            ...prev,
            notifications: prev.notifications.map(item => ({ ...item, is_read: true })),
        }));
    };

    const updateProfile = (updates: Partial<PatientProfile>) => {
        setState(prev => ({
            ...prev,
            profile: {
                ...prev.profile,
                ...updates,
            },
        }));
    };

    const updateSettings = (updates: Partial<PatientPortalSettings>) => {
        setState(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                ...updates,
            },
        }));
    };

    const value = useMemo<PatientPortalContextType>(() => ({
        ...state,
        unreadCount: state.notifications.filter(item => !item.is_read).length,
        requestAppointment,
        markNotificationRead,
        markAllNotificationsRead,
        updateProfile,
        updateSettings,
    }), [state]);

    return (
        <PatientPortalContext.Provider value={value}>
            {children}
        </PatientPortalContext.Provider>
    );
}

export function usePatientPortal() {
    const context = useContext(PatientPortalContext);
    if (!context) {
        throw new Error('usePatientPortal must be used within a PatientPortalProvider');
    }
    return context;
}

