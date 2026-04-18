import api from '../../../shared/services/api';

export interface PatientDashboardData {
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
}

export interface PatientAppointment {
    id: number;
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
    email_notifications: boolean;
    appointment_reminders: boolean;
    lab_result_notifications: boolean;
    visit_summary_notifications: boolean;
    marketing_emails: boolean;
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

    requestAppointment: (data: { doctor_id: number; appointment_date: string; reason: string; notes?: string }) =>
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
};
