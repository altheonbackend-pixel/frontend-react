// src/shared/types.ts — Shared interfaces used across multiple features

export interface User {
    id: number;
    email: string;
    full_name: string;
    access_level?: 1 | 2;
    specialty?: string | null;
    phone_number?: string | null;
    address?: string | null;
}

export interface DoctorProfile {
    id: number;
    full_name: string;
    email: string;
    access_level: 1 | 2;
    specialty: string | null;
    specialty_display?: string | null;
    license_number: string | null;
    phone_number: string | null;
    address: string | null;
    email_verified?: boolean;
}

export interface SpecialtyChoice {
    value: string;
    label: string;
}

export interface Patient {
    unique_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    age: number | null;
    status?: string;
    status_display?: string;
    medical_history: string | null;
    blood_group: string | null;
    address: string | null;
    email: string | null;
    phone_number: string | null;
    emergency_contact_name: string | null;
    emergency_contact_number: string | null;
}

export interface Appointment {
    id: number;
    patient: string;
    doctor: number;
    appointment_date: string;
    reason_for_appointment: string;
    status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled' | 'pending';
    status_display?: string;
    notes?: string | null;
    cancellation_reason?: string | null;
    confirmed_at?: string | null;
    completed_at?: string | null;
    rescheduled_from?: number | null;
    patient_details?: {
        unique_id: string;
        first_name: string;
        last_name: string;
        status?: string;
        status_display?: string;
    };
}

export interface FollowUpConsultation {
    id: number;
    patient: string;
    patient_name?: string;
    follow_up_date: string;
    reason_for_consultation: string;
    diagnosis?: string | null;
}

export interface Prescription {
    id: number;
    consultation: number | null;
    doctor: number;
    patient: string;
    patient_name?: string;
    medication_name: string;
    dosage: string;
    frequency: string;
    frequency_display?: string;
    duration_days: number | null;
    instructions: string;
    is_active: boolean;
    prescribed_at: string;
}

export interface Consultation {
    id: number;
    patient: string;
    doctor: number;
    appointment?: number | null;
    consultation_date: string;
    consultation_type: 'in_person' | 'telemedicine' | 'home_visit';
    consultation_type_display?: string;
    reason_for_consultation: string;
    symptoms: string[];
    medical_report: string | null;
    diagnosis: string | null;
    icd_code: string | null;
    follow_up_date: string | null;
    weight: number | null;
    height: number | null;
    height_unit: string;
    sp2: number | null;
    temperature: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    blood_pressure_display?: string | null;
    has_vital_alerts?: boolean;
    vital_alert_reasons?: string[];
    visible_to_patient: boolean;
}

export interface LabResult {
    id: number;
    patient: string;
    ordered_by?: number | null;
    ordered_by_name?: string;
    consultation?: number | null;
    test_name: string;
    test_date: string;
    result_value: string;
    unit: string;
    reference_range: string;
    status: 'normal' | 'abnormal' | 'critical' | 'pending';
    status_display?: string;
    notes: string;
    attachment?: string | null;
    created_at: string;
    updated_at: string;
}

export interface NotebookEntry {
    id: number;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface PatientQuickNote {
    id?: number;
    patient: string;
    content: string;
    updated_at?: string | null;
}

export interface PatientCondition {
    id: number;
    patient: string;
    name: string;
    icd_code: string;
    status: 'active' | 'resolved' | 'chronic' | 'in_remission';
    status_display?: string;
    onset_date: string | null;
    notes: string;
    recorded_by: number | null;
    recorded_by_name?: string;
    created_at: string;
    updated_at: string;
}

export interface PatientAllergy {
    id: number;
    patient: string;
    allergen: string;
    reaction_type: 'drug' | 'food' | 'environmental' | 'other';
    reaction_type_display?: string;
    severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
    severity_display?: string;
    reaction_description: string;
    is_active: boolean;
    recorded_by: number | null;
    recorded_by_name?: string;
    created_at: string;
}

export interface PatientNote {
    id: number;
    title: string;
    content: string;
    note_type: string;
    note_type_display?: string;
    patient: string | null;
    author: number;
    author_name?: string;
    created_at: string;
    updated_at: string;
}

export interface MedicalProcedure {
    id: number;
    patient: string;
    operator: number;
    procedure_category: 'surgical' | 'diagnostic' | 'therapeutic' | 'screening' | 'vaccination' | 'other';
    procedure_category_display?: string;
    procedure_type: string;
    procedure_date: string;
    result: string | null;
    attachments: string | null;
}

export interface DeletedAppointment {
    id: number;
    appointment_id: number;
    patient_details: Patient;
    doctor_details: DoctorProfile;
    appointment_date: string;
    reason_for_appointment: string;
    deletion_date: string;
    deletion_reason: string;
    deletion_comment: string | null;
    deleted_by_name: string;
}

export interface Referral {
    id: number;
    patient: string;
    referred_to: number;
    referred_by: number | null;
    specialty_requested: string;
    specialty_display?: string;
    reason_for_referral: string;
    attached_documents: string | null;
    date_of_referral: string;
    comments: string | null;
    // Phase 3 lifecycle fields
    status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
    status_display?: string;
    urgency: 'routine' | 'urgent' | 'emergency';
    urgency_display?: string;
    response_notes: string;
    responded_at: string | null;
    referred_to_details?: { id: number; full_name: string; specialty: string };
    referred_by_details?: { id: number; full_name: string; specialty: string };
    patient_details?: { unique_id: string; first_name: string; last_name: string };
}

export interface Notification {
    id: number;
    type: string;
    title: string;
    body: string;
    is_read: boolean;
    link: string;
    created_at: string;
}

export interface PatientList {
    unique_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    age: number;
}

export interface PatientWithHistory extends Patient {
    consultations: Consultation[];
    medical_procedures: MedicalProcedure[];
    referrals: Referral[];
    conditions: PatientCondition[];
    allergy_records: PatientAllergy[];
    patient_notes: PatientNote[];
    lab_results: LabResult[];
    status: string;
}

export interface DoctorStats {
    id: number;
    full_name: string;
    specialty: string;
    consultation_count: number;
    patient_count: number;
    referral_count: number;
    procedure_count: number;
}

export interface GlobalStats {
    total_doctors: number;
    total_patients: number;
    total_consultations: number;
    total_referrals: number;
    total_procedures: number;
}

export interface AuthTokens {
    refresh: string;
    access: string;
}

export interface AdminProfile {
    user_type: 'admin';
    email: string;
    full_name: string;
}

export interface AdminStats {
    total_doctors: number;
    total_active_doctors: number;
    total_inactive_doctors: number;
    pending_doctors: number;
    rejected_doctors: number;
    total_patients: number;
    total_appointments: number;
    total_consultations: number;
    total_procedures: number;
    total_referrals: number;
    total_clinics: number;
    total_public_clinics: number;
    total_forum_posts: number;
    forum_suspended_doctors: number;
    doctors_by_access_level: {
        [key: string]: number;
    };
}

export interface AdminDoctor {
    id: number;
    full_name: string;
    email: string;
    specialty: string | null;
    specialty_display?: string | null;
    license_number: string | null;
    access_level: 1 | 2;
    access_level_display?: string | null;
    is_active: boolean;
    verification_status: 'pending_admin' | 'active' | 'rejected';
    verification_status_display?: string | null;
    rejection_reason: string;
    date_joined: string | null;
}
