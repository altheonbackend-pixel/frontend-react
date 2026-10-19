// Server data for the consultation workspace: the note, the patient and the
// context panel. All writes go through the lifecycle endpoints built in S1.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';
import type { PatientWithHistory } from '../../../shared/types';
import type { ConsultationDTO } from './model';

export interface ActiveMedication { id: number; display_name: string; status: string; started_at?: string | null }
export interface OpenAlert { id: number; title: string; body: string; severity: string; created_at: string }
export interface LabRow { id: number; test_name: string; test_date: string; result_value: string; unit: string; status: string; reference_range: string }
export interface VisitRow {
    id: number; consultation_date: string; consultation_status: string; record_status?: string;
    reason_for_consultation: string; diagnosis: string | null; plan?: string; medical_report?: string | null;
    bp_systolic: number | null; bp_diastolic: number | null; doctor_name?: string | null;
}

const results = <T,>(data: unknown): T[] => {
    const d = data as { results?: T[] } | T[];
    return Array.isArray(d) ? d : (d.results ?? []);
};

export const consultationKey = (id: number | string) => ['consultation', String(id)] as const;

export function useWorkspaceData(patientId: string, consultationId: number | null) {
    const patient = useQuery<PatientWithHistory>({
        queryKey: ['patients', patientId, 'detail'],
        queryFn: async () => (await api.get(`/patients/${patientId}/`)).data,
        staleTime: 60_000,
    });
    const consultation = useQuery<ConsultationDTO>({
        queryKey: consultationKey(consultationId ?? 'new'),
        queryFn: async () => (await api.get(`/consultations/${consultationId}/`)).data,
        enabled: consultationId != null,
    });
    const visits = useQuery<VisitRow[]>({
        queryKey: ['patients', patientId, 'consultations'],
        queryFn: async () => results<VisitRow>((await api.get('/consultations/', {
            params: { patient: patientId, ordering: '-consultation_date' },
        })).data),
        staleTime: 60_000,
    });
    const meds = useQuery<ActiveMedication[]>({
        queryKey: ['patients', patientId, 'active-medications'],
        queryFn: async () => results<ActiveMedication>((await api.get('/patient-medications/', {
            params: { patient: patientId, active: 'true' },
        })).data),
        staleTime: 60_000,
    });
    const alerts = useQuery<OpenAlert[]>({
        queryKey: ['patients', patientId, 'open-alerts'],
        queryFn: async () => results<OpenAlert>((await api.get('/clinical-alerts/', {
            params: { patient: patientId, open: 'true' },
        })).data),
        staleTime: 60_000,
    });
    const labs = useQuery<LabRow[]>({
        queryKey: ['patients', patientId, 'lab-results'],
        queryFn: async () => results<LabRow>((await api.get('/lab-results/', { params: { patient: patientId } })).data),
        staleTime: 60_000,
    });
    return { patient, consultation, visits, meds, alerts, labs };
}

/** Everything that shows consultation-derived data elsewhere in the app. */
export function useInvalidateConsultation(patientId: string) {
    const qc = useQueryClient();
    return (consultationId?: number | null) => {
        if (consultationId != null) qc.invalidateQueries({ queryKey: consultationKey(consultationId) });
        qc.invalidateQueries({ queryKey: ['patients', patientId] });
        qc.invalidateQueries({ queryKey: ['appointments'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
    };
}
