import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import { useAuth } from '../../auth/hooks/useAuth';

interface PatientPortalContextType {
    unreadCount: number;
    invalidateUnreadCount: () => void;
}

const PatientPortalContext = createContext<PatientPortalContextType | undefined>(undefined);

export function PatientPortalProvider({ children }: { children: ReactNode }) {
    const { userType } = useAuth();
    const queryClient = useQueryClient();

    const { data: unreadCount = 0 } = useQuery({
        queryKey: queryKeys.patientPortal.notificationsUnreadCount(),
        queryFn: patientPortalService.getUnreadCount,
        enabled: userType === 'patient',
        staleTime: 30_000,
        refetchInterval: 60_000,
    });

    const invalidateUnreadCount = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.notificationsUnreadCount() });
    };

    return (
        <PatientPortalContext.Provider value={{ unreadCount, invalidateUnreadCount }}>
            {children}
        </PatientPortalContext.Provider>
    );
}

export function usePatientPortal() {
    const context = useContext(PatientPortalContext);
    if (!context) throw new Error('usePatientPortal must be used within a PatientPortalProvider');
    return context;
}
