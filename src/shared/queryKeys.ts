// shared/queryKeys.ts — Centralised TanStack Query key factory.
// All cache keys live here so invalidations are never typo'd.

export const queryKeys = {
    dashboard: () => ['dashboard'] as const,

    patients: {
        list: (filters?: object) => ['patients', 'list', filters] as const,
        detail: (id: string) => ['patients', 'detail', id] as const,
        quickNote: (id: string) => ['patients', 'quickNote', id] as const,
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
} as const;
