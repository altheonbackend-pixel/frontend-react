// src/features/patients/services/patientService.ts

import api from '../../../shared/services/api';

export const getMyPatients = () =>
    api.get('/doctors/me/patients/');

export const getPatient = (id: string) =>
    api.get(`/patients/${encodeURIComponent(id)}/`);

export const createPatient = (data: Record<string, unknown>) =>
    api.post('/patients/', data);

export const updatePatient = (id: string, data: Record<string, unknown>) =>
    api.patch(`/patients/${encodeURIComponent(id)}/`, data);

export const deletePatient = (id: string) =>
    api.delete(`/patients/${encodeURIComponent(id)}/`);


// ─── Workflow B — global search + access requests ───────────────────────────

export interface MaskedPatientCard {
    unique_id: string;
    initials: string;
    masked_dob_year: number | null;
    masked_phone: string | null;
    masked_email: string | null;
    has_access: boolean;
}

export interface AccessRequest {
    id: number;
    patient_unique_id: string;
    patient_initials: string;
    doctor_name: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
    delivery_method: 'push' | 'email' | 'sms' | 'in_person';
    reason: string;
    created_at: string;
    expires_at: string;
    resolved_at: string | null;
    otp_attempts: number;
    /** Only populated for in_person delivery — doctor reads OTP aloud. */
    otp?: string;
    delivered?: { method: string; sent: boolean; reason: string };
}

export interface GlobalSearchPayload {
    email?: string;
    phone?: string;
    last_name?: string;
    date_of_birth?: string;
}

export const globalPatientSearch = (data: GlobalSearchPayload) =>
    api.post<{ count: number; results: MaskedPatientCard[] }>(
        '/patients/global-search/', data,
    );

export const listAccessRequests = () =>
    api.get<{ results: AccessRequest[] } | AccessRequest[]>('/patient-access-requests/');

export const createAccessRequest = (data: {
    patient_unique_id: string;
    delivery_method?: 'push' | 'email' | 'sms' | 'in_person';
    reason?: string;
}) => api.post<AccessRequest>('/patient-access-requests/', data);

export const verifyAccessOtp = (requestId: number, otp: string) =>
    api.post<AccessRequest>(
        `/patient-access-requests/${requestId}/verify-otp/`,
        { otp },
    );

export const redeemClinicCode = (code: string) =>
    api.post<{
        patient_unique_id: string;
        membership_id: number;
        expires_at: string;
        role: string;
    }>('/patient-access-requests/by-clinic-code/', { code });

export const cancelAccessRequest = (requestId: number) =>
    api.post<AccessRequest>(`/patient-access-requests/${requestId}/cancel/`);
