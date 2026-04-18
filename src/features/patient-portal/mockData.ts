import type { PatientProfile } from '../../shared/types';

export const DEMO_PATIENT_CREDENTIALS = {
    email: 'patient@altheon.demo',
    password: 'Patient123!',
};

export interface PatientDoctorOption {
    id: number;
    full_name: string;
    specialty: string;
    clinic: string;
    next_available: string;
}

export interface PatientPortalAppointment {
    id: number;
    doctor_id: number;
    doctor_name: string;
    specialty: string;
    clinic: string;
    appointment_date: string;
    type: 'in_person' | 'telemedicine';
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    reason: string;
    notes: string;
    requested_at: string;
    requires_approval: boolean;
}

export interface PatientPortalVisit {
    id: number;
    consultation_date: string;
    doctor_name: string;
    consultation_type: 'in_person' | 'telemedicine';
    reason_for_consultation: string;
    diagnosis_summary: string;
    patient_summary: string;
    follow_up_date?: string;
}

export interface PatientPortalMedication {
    id: number;
    medication_name: string;
    dosage: string;
    frequency: string;
    instructions: string;
    prescribed_at: string;
    is_active: boolean;
    doctor_name: string;
}

export interface PatientPortalLab {
    id: number;
    test_name: string;
    test_date: string;
    result_value: string;
    unit?: string;
    reference_range: string;
    status: 'normal' | 'abnormal' | 'critical' | 'pending';
    patient_note: string;
}

export interface PatientPortalNotification {
    id: number;
    title: string;
    body: string;
    created_at: string;
    is_read: boolean;
    link?: string;
}

export interface PatientPortalSettings {
    preferred_language: string;
    email_notifications: boolean;
    appointment_reminders: boolean;
    lab_result_notifications: boolean;
    visit_summary_notifications: boolean;
    marketing_emails: boolean;
}

export interface PatientPortalState {
    doctors: PatientDoctorOption[];
    appointments: PatientPortalAppointment[];
    visits: PatientPortalVisit[];
    medications: PatientPortalMedication[];
    labs: PatientPortalLab[];
    notifications: PatientPortalNotification[];
    settings: PatientPortalSettings;
    profile: PatientProfile;
}

export const DEMO_PATIENT_PROFILE: PatientProfile = {
    id: 1,
    patient_id: 'PT-ALTHEON-001',
    full_name: 'Amina Sheikh',
    email: DEMO_PATIENT_CREDENTIALS.email,
    date_of_birth: '1992-08-18',
    phone_number: '+92 300 1234567',
    address: 'Gulberg, Lahore, Pakistan',
    emergency_contact_name: 'Ali Sheikh',
    emergency_contact_number: '+92 300 4444444',
    blood_group: 'O+',
    primary_doctor_name: 'Dr. Ahmed Hassan',
    email_verified: true,
    claim_status: 'claimed',
    preferred_language: 'en',
};

export const createInitialPatientPortalState = (): PatientPortalState => ({
    doctors: [
        {
            id: 101,
            full_name: 'Dr. Ahmed Hassan',
            specialty: 'Cardiology',
            clinic: 'Altheon Heart Center',
            next_available: '2026-04-22T10:30:00',
        },
        {
            id: 102,
            full_name: 'Dr. Sara Malik',
            specialty: 'Internal Medicine',
            clinic: 'Altheon City Clinic',
            next_available: '2026-04-23T13:00:00',
        },
        {
            id: 103,
            full_name: 'Dr. Omar Qureshi',
            specialty: 'Endocrinology',
            clinic: 'Altheon Specialty Suites',
            next_available: '2026-04-24T09:15:00',
        },
    ],
    appointments: [
        {
            id: 1,
            doctor_id: 101,
            doctor_name: 'Dr. Ahmed Hassan',
            specialty: 'Cardiology',
            clinic: 'Altheon Heart Center',
            appointment_date: '2026-04-22T10:30:00',
            type: 'in_person',
            status: 'confirmed',
            reason: 'Hypertension follow-up',
            notes: 'Please bring your previous blood pressure log.',
            requested_at: '2026-04-15T09:00:00',
            requires_approval: true,
        },
        {
            id: 2,
            doctor_id: 102,
            doctor_name: 'Dr. Sara Malik',
            specialty: 'Internal Medicine',
            clinic: 'Altheon City Clinic',
            appointment_date: '2026-04-28T15:00:00',
            type: 'telemedicine',
            status: 'pending',
            reason: 'General fatigue and medication review',
            notes: 'Awaiting doctor approval.',
            requested_at: '2026-04-18T11:15:00',
            requires_approval: true,
        },
        {
            id: 3,
            doctor_id: 103,
            doctor_name: 'Dr. Omar Qureshi',
            specialty: 'Endocrinology',
            clinic: 'Altheon Specialty Suites',
            appointment_date: '2026-04-02T12:00:00',
            type: 'in_person',
            status: 'completed',
            reason: 'HbA1c review',
            notes: 'Completed successfully.',
            requested_at: '2026-03-28T08:00:00',
            requires_approval: true,
        },
    ],
    visits: [
        {
            id: 21,
            consultation_date: '2026-04-02',
            doctor_name: 'Dr. Omar Qureshi',
            consultation_type: 'in_person',
            reason_for_consultation: 'HbA1c review and medication adjustment',
            diagnosis_summary: 'Type 2 diabetes with improving control',
            patient_summary: 'Your sugar levels are improving. Continue metformin, keep daily walking, and repeat HbA1c in 3 months.',
            follow_up_date: '2026-07-02',
        },
        {
            id: 22,
            consultation_date: '2026-03-12',
            doctor_name: 'Dr. Ahmed Hassan',
            consultation_type: 'in_person',
            reason_for_consultation: 'Blood pressure review',
            diagnosis_summary: 'Essential hypertension',
            patient_summary: 'Blood pressure remains above target but is trending down. Please continue medication and monitor at home.',
            follow_up_date: '2026-04-22',
        },
    ],
    medications: [
        {
            id: 31,
            medication_name: 'Metformin',
            dosage: '500 mg',
            frequency: 'Twice daily',
            instructions: 'Take after meals.',
            prescribed_at: '2026-04-02T12:15:00',
            is_active: true,
            doctor_name: 'Dr. Omar Qureshi',
        },
        {
            id: 32,
            medication_name: 'Amlodipine',
            dosage: '5 mg',
            frequency: 'Once daily',
            instructions: 'Take every morning.',
            prescribed_at: '2026-03-12T11:00:00',
            is_active: true,
            doctor_name: 'Dr. Ahmed Hassan',
        },
        {
            id: 33,
            medication_name: 'Vitamin D',
            dosage: '2000 IU',
            frequency: 'Once daily',
            instructions: 'Take with food.',
            prescribed_at: '2025-12-10T10:00:00',
            is_active: false,
            doctor_name: 'Dr. Sara Malik',
        },
    ],
    labs: [
        {
            id: 41,
            test_name: 'HbA1c',
            test_date: '2026-04-01',
            result_value: '7.1',
            unit: '%',
            reference_range: '4.0 - 5.6',
            status: 'abnormal',
            patient_note: 'Improved compared with your previous result. Your doctor will review again in the next follow-up.',
        },
        {
            id: 42,
            test_name: 'Serum Creatinine',
            test_date: '2026-03-11',
            result_value: '0.89',
            unit: 'mg/dL',
            reference_range: '0.60 - 1.10',
            status: 'normal',
            patient_note: 'Kidney function is within the expected range.',
        },
    ],
    notifications: [
        {
            id: 51,
            title: 'Appointment request received',
            body: 'Your request with Dr. Sara Malik has been sent and is waiting for approval.',
            created_at: '2026-04-18T11:20:00',
            is_read: false,
            link: '/patient/appointments',
        },
        {
            id: 52,
            title: 'Lab result available',
            body: 'A new HbA1c result is ready to review in your portal.',
            created_at: '2026-04-17T08:30:00',
            is_read: false,
            link: '/patient/labs',
        },
        {
            id: 53,
            title: 'Upcoming visit reminder',
            body: 'You have a confirmed appointment with Dr. Ahmed Hassan on 22 April at 10:30.',
            created_at: '2026-04-16T19:00:00',
            is_read: true,
            link: '/patient/appointments',
        },
    ],
    settings: {
        preferred_language: 'en',
        email_notifications: true,
        appointment_reminders: true,
        lab_result_notifications: true,
        visit_summary_notifications: true,
        marketing_emails: false,
    },
    profile: DEMO_PATIENT_PROFILE,
});
