// shared/queryKeys.ts — Centralised TanStack Query key factory.
// All cache keys live here so invalidations are never typo'd.

export const queryKeys = {
    dashboard: () => ['dashboard'] as const,

    patients: {
        list: (filters?: object) => ['patients', 'list', filters] as const,
        detail: (id: string) => ['patients', 'detail', id] as const,
        quickNote: (id: string) => ['patients', 'quickNote', id] as const,
        // Per-tab lazy-loaded data (fetched only when tab is first activated)
        consultations: (id: string) => ['patients', id, 'consultations'] as const,
        procedures: (id: string) => ['patients', id, 'procedures'] as const,
        referrals: (id: string) => ['patients', id, 'referrals'] as const,
        vitals: (id: string) => ['patients', id, 'vitals'] as const,
        labs: (id: string) => ['patients', id, 'labs'] as const,
        medications: (id: string) => ['patients', id, 'medications'] as const,
        appointments: (id: string) => ['patients', id, 'appointments'] as const,
    },

    consultations: {
        list: (patientId?: string) => ['consultations', 'list', patientId] as const,
        followUps: () => ['consultations', 'followUps'] as const,
    },

    appointments: {
        dots: (month: string) => ['appointments', 'dots', month] as const,
        list: (date: string) => ['appointments', 'list', date] as const,
    },

    prescriptions: {
        list: (filters?: object) => ['prescriptions', 'list', filters] as const,
    },

    referrals: {
        list: (filters?: object) => ['referrals', 'list', filters] as const,
    },

    notifications: {
        unreadCount: () => ['notifications', 'unreadCount'] as const,
        list: () => ['notifications', 'list'] as const,
    },

    stats: {
        doctor: () => ['stats', 'doctor'] as const,
    },

    patientPortal: {
        dashboard: () => ['patient', 'dashboard'] as const,
        profile: () => ['patient', 'profile'] as const,
        settings: () => ['patient', 'settings'] as const,
        appointments: () => ['patient', 'appointments'] as const,
        doctors: () => ['patient', 'doctors'] as const,
        consultations: () => ['patient', 'consultations'] as const,
        consultation: (id: number) => ['patient', 'consultations', id] as const,
        prescriptions: () => ['patient', 'prescriptions'] as const,
        labResults: () => ['patient', 'lab-results'] as const,
        labResult: (id: number) => ['patient', 'lab-results', id] as const,
        notifications: () => ['patient', 'notifications'] as const,
        notificationsUnreadCount: () => ['patient', 'notifications', 'unread-count'] as const,
        conditions: () => ['patient', 'conditions'] as const,
        allergies: () => ['patient', 'allergies'] as const,
        referrals: () => ['patient', 'referrals'] as const,
        doctorProfile: (id: number) => ['patient', 'doctor', id] as const,
    },
} as const;
