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
    workplaces?: Workplace[];
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
    medical_history: string | null;
    blood_group: string | null;
    address: string | null;
    email: string | null;
    phone_number: string | null;
    emergency_contact_name: string | null;
    emergency_contact_number: string | null;
    allergies: string | null;
}

export interface Appointment {
    id: number;
    patient: string;
    doctor: number;
    appointment_date: string;
    reason_for_appointment: string;
    status: string;
    workplace: number;
    patient_details?: {
        unique_id: string;
        first_name: string;
        last_name: string;
    };
    workplace_details?: {
        id: number;
        name: string;
        address: string;
    };
}

export interface Workplace {
    id: number;
    name: string;
    address: string;
    is_public: boolean;
    creator: number;
}

export interface Consultation {
    id: number;
    patient: string;
    doctor: number;
    consultation_date: string;
    reason_for_consultation: string;
    medical_report: string | null;
    diagnosis: string | null;
    medications: string | null;
    weight: number | null;
    height: number | null;
    sp2: number | null;
    temperature: number | null;
    blood_pressure: string | null;
}

export interface MedicalProcedure {
    id: number;
    patient: string;
    operator: number;
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
    workplace_details: Workplace;
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
    workplace?: number | null;
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
}

export interface WorkplaceStats {
    id: number;
    name: string;
    consultation_count: number;
    patient_count: number;
    procedure_count: number;
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
    total_workplaces: number;
    total_patients: number;
    total_consultations: number;
    total_referrals: number;
    total_procedures: number;
    stats_by_workplace: WorkplaceStats[];
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
    license_number: string | null;
    access_level: 1 | 2;
    is_active: boolean;
    verification_status: 'pending_admin' | 'active' | 'rejected';
    max_clinics_owned: number;
    max_clinics_joined: number;
    forum_suspended: boolean;
    rejection_reason: string;
    clinics_owned: number;
    clinics_joined: number;
    date_joined: string | null;
}

export interface AdminClinic {
    id: number;
    name: string;
    address: string;
    is_public: boolean;
    creator_id: number | null;
    creator_name: string | null;
    creator_email: string | null;
    member_count: number;
}

export interface AdminForumPost {
    id: number;
    title: string;
    content: string;
    created_at: string;
    author_id: number;
    author_name: string;
    author_email: string;
    comment_count: number;
}
