import api from '../../../shared/services/api';

export interface PatientDashboardData {
    pending_appointment_requests: number;
    next_appointment: {
        id: number;
        appointment_date: string;
        doctor_name: string;
        specialty: string;
        status: string;
        portal_instructions: string;
    } | null;
    active_medications_count: number;
    unread_notifications: number;
    latest_visible_consultation: {
        id: number;
        consultation_date: string;
        patient_summary: string;
    } | null;
    latest_lab_result: {
        id: number;
        test_name: string;
        status: string;
        test_date: string;
    } | null;
    conditions_count: number;
}

export interface PatientAppointment {
    id: number;
    doctor_id: number;
    doctor_name: string;
    specialty: string;
    clinic: string | null;
    appointment_date: string;
    reason_for_appointment: string;
    status: 'pending' | 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
    notes: string;
    portal_instructions: string;
    patient_can_cancel: boolean;
    patient_can_reschedule: boolean;
}

export interface PatientDoctorOption {
    id: number;
    full_name: string;
    specialty: string;
    clinic: string | null;
    next_available: string | null;
}

export interface PatientAttachment {
    id: number;
    original_filename: string;
    file_size: number | null;
    mime_type: string;
    created_at: string;
    download_url: string | null;
}

export interface ConsultationPrescription {
    id: number;
    medication_name: string;
    dosage: string;
    frequency: string;
    frequency_display: string;
    duration_days: number | null;
    instructions: string;
    patient_medication_note: string;
    is_active: boolean;
}

export interface PatientConsultation {
    id: number;
    consultation_date: string;
    doctor_name: string;
    consultation_type: 'in_person' | 'telemedicine';
    reason_for_consultation: string;
    diagnosis: string;
    patient_summary: string;
    patient_instructions: string;
    follow_up_date: string | null;
    file_attachments: PatientAttachment[];
    prescriptions: ConsultationPrescription[];
    // Vitals
    weight: string | null;
    height: string | null;
    height_unit: 'cm' | 'm';
    temperature: string | null;
    sp2: string | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    bp_display: string | null;
    // Follow-up appointment live status
    follow_up_appointment_info: {
        id: number;
        status: string;
        appointment_date: string;
    } | null;
}

export interface PatientPrescription {
    id: number;
    medication_name: string;
    dosage: string;
    frequency: string;
    frequency_display: string;
    duration_days: number | null;
    instructions: string;
    patient_medication_note: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    prescribed_at: string;
    doctor_name: string;
}

export interface PatientLabResult {
    id: number;
    test_name: string;
    test_date: string;
    result_value: string | null;
    result_value_text: string | null;
    unit: string | null;
    reference_range: string | null;
    status: 'normal' | 'abnormal' | 'critical' | 'pending';
    patient_note: string;
    released_to_patient_at: string | null;
    submitted_by_patient: boolean;
    review_status: 'not_required' | 'pending_review' | 'accepted' | 'rejected';
    rejection_reason: string;
    file_attachments: PatientAttachment[];
}

export interface PatientNotification {
    id: number;
    type: string;
    title: string;
    body: string;
    link: string | null;
    is_read: boolean;
    created_at: string;
}

export interface PatientPortalProfile {
    patient_id: string;
    full_name: string;
    email: string;
    date_of_birth: string | null;
    phone_number: string | null;
    address: string | null;
    emergency_contact_name: string | null;
    emergency_contact_number: string | null;
    blood_group: string | null;
    primary_doctor_name: string | null;
    email_verified: boolean;
    claim_status: 'unclaimed' | 'invited' | 'claimed' | 'locked';
    preferred_language: string;
}

export interface PatientPortalSettings {
    preferred_language: string;
    timezone: string;
    email_notifications: boolean;
    appointment_reminders: boolean;
    lab_result_notifications: boolean;
    visit_summary_notifications: boolean;
    marketing_emails: boolean;
}

export interface PatientCondition {
    id: number;
    name: string;
    patient_friendly_name: string;
    status: 'active' | 'resolved' | 'chronic' | 'in_remission';
    onset_date: string | null;
    notes: string;
}

export interface PatientAllergy {
    id: number;
    allergen: string;
    reaction_type: 'drug' | 'food' | 'environmental' | 'other';
    severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
    reaction_description: string;
}

export interface PatientDoctorProfile {
    id: number;
    full_name: string;
    specialty: string | null;
    clinic: string | null;
    phone_number: string | null;
    email: string;
}

export interface PatientReferral {
    id: number;
    reason_for_referral: string;
    urgency: 'routine' | 'urgent' | 'emergency';
    status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
    specialty_requested: string;
    referred_by: string | null;
    referred_to: string | null;
    is_external: boolean;
    date_of_referral: string;
}

export const patientPortalService = {
    getDashboard: () =>
        api.get<PatientDashboardData>('/patient/dashboard/').then(r => r.data),

    getProfile: () =>
        api.get<PatientPortalProfile>('/patient/profile/').then(r => r.data),

    updateProfile: (data: Partial<Pick<PatientPortalProfile, 'phone_number' | 'address' | 'emergency_contact_name' | 'emergency_contact_number'>>) =>
        api.patch<PatientPortalProfile>('/patient/profile/', data).then(r => r.data),

    getSettings: () =>
        api.get<PatientPortalSettings>('/patient/settings/').then(r => r.data),

    updateSettings: (data: Partial<PatientPortalSettings>) =>
        api.patch<PatientPortalSettings>('/patient/settings/', data).then(r => r.data),

    getAppointments: () =>
        api.get<PatientAppointment[]>('/patient/appointments/').then(r => r.data),

    requestAppointment: (data: { doctor_id: number; appointment_date: string; reason: string; appointment_type?: string; notes?: string }) =>
        api.post<{ id: number; status: string; message: string }>('/patient/appointments/request/', data).then(r => r.data),

    getDoctors: () =>
        api.get<PatientDoctorOption[]>('/patient/doctors/').then(r => r.data),

    getConsultations: () =>
        api.get<PatientConsultation[]>('/patient/consultations/').then(r => r.data),

    getConsultation: (id: number) =>
        api.get<PatientConsultation>(`/patient/consultations/${id}/`).then(r => r.data),

    getPrescriptions: () =>
        api.get<PatientPrescription[]>('/patient/prescriptions/').then(r => r.data),

    getLabResults: () =>
        api.get<PatientLabResult[]>('/patient/lab-results/').then(r => r.data),

    uploadLabResult: (formData: FormData) =>
        api.post<PatientLabResult>('/patient/lab-results/upload/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(r => r.data),

    getLabResult: (id: number) =>
        api.get<PatientLabResult>(`/patient/lab-results/${id}/`).then(r => r.data),

    getNotifications: () =>
        api.get<PatientNotification[]>('/patient/notifications/').then(r => r.data),

    getUnreadCount: () =>
        api.get<{ unread_count: number }>('/patient/notifications/unread-count/').then(r => r.data.unread_count),

    markNotificationRead: (id: number) =>
        api.post(`/patient/notifications/${id}/mark-read/`).then(r => r.data),

    markAllNotificationsRead: () =>
        api.post('/patient/notifications/mark-all-read/').then(r => r.data),

    cancelAppointment: (id: number) =>
        api.post(`/patient/appointments/${id}/cancel/`).then(r => r.data),

    // ── Doctor-side portal management (called from PatientDetail) ──────────────

    getPortalStatus: (patientId: string) =>
        api.get<{
            portal_enabled: boolean;
            allow_self_claim: boolean;
            claim_status: 'unclaimed' | 'invited' | 'claimed' | 'locked';
            invited_at: string | null;
            claimed_at: string | null;
            primary_contact_email: string | null;
        }>(`/patients/${patientId}/portal/status/`).then(r => r.data),

    sendPortalInvite: (patientId: string, email: string) =>
        api.post(`/patients/${patientId}/portal/invite/`, { email }).then(r => r.data),

    updatePortalSettings: (patientId: string, data: Record<string, boolean>) =>
        api.patch(`/patients/${patientId}/portal/settings/`, data).then(r => r.data),

    shareConsultation: (consultationId: number, data: { patient_summary?: string; patient_instructions?: string }) =>
        api.post(`/consultations/${consultationId}/share-with-patient/`, data).then(r => r.data),

    releaseLabResult: (labId: number, data: { patient_note?: string }) =>
        api.post(`/lab-results/${labId}/release-to-patient/`, data).then(r => r.data),

    getPendingAppointmentRequests: () =>
        api.get<Array<{
            id: number;
            patient_name: string;
            patient_id: string;
            appointment_date: string;
            reason: string;
            notes: string;
        }>>('/doctor/appointment-requests/').then(r => r.data),

    approveAppointmentRequest: (id: number, portal_instructions?: string) =>
        api.post(`/appointments/${id}/approve/`, { portal_instructions }).then(r => r.data),

    rejectAppointmentRequest: (id: number, reason?: string) =>
        api.post(`/appointments/${id}/reject/`, { reason }).then(r => r.data),

    rescheduleAppointment: (id: number, new_appointment_date: string) =>
        api.post(`/patient/appointments/${id}/reschedule/`, { new_appointment_date }).then(r => r.data),

    getConditions: () =>
        api.get<PatientCondition[]>('/patient/conditions/').then(r => r.data),

    getAllergies: () =>
        api.get<PatientAllergy[]>('/patient/allergies/').then(r => r.data),

    getReferrals: () =>
        api.get<PatientReferral[]>('/patient/referrals/').then(r => r.data),

    getDoctorProfile: (id: number) =>
        api.get<PatientDoctorProfile>(`/patient/doctor/${id}/`).then(r => r.data),

    getAvailableSlots: (doctorId: number, date: string) =>
        api.get<{ date: string; doctor_id: number; slots: string[]; doctor_available: boolean; doctor_timezone: string; patient_timezone: string }>(
            '/patient/appointments/available-slots/',
            { params: { doctor_id: doctorId, date } },
        ).then(r => r.data),

    changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
        api.post('/patient/change-password/', data).then(r => r.data),
};
