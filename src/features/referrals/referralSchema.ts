import { z } from 'zod';

export const SPECIALTY_VALUES = [
    'general_practice','cardiology','dermatology','endocrinology','gastroenterology',
    'hematology','infectious_disease','internal_medicine','nephrology','neurology',
    'oncology','ophthalmology','orthopedics','pediatrics','psychiatry','pulmonology',
    'radiology','rheumatology','surgery_general','urology','gynecology','ent',
    'emergency_medicine','anesthesiology','pathology','other',
] as const;

export const referralSchema = z.object({
    is_external: z.boolean(),
    referred_to: z.number().int().positive().nullable().optional(),
    external_doctor_name:  z.string(),
    external_doctor_email: z.union([z.string().email('Enter a valid email'), z.literal('')]).optional(),
    specialty_requested: z.enum(SPECIALTY_VALUES, { message: 'Select a specialty' }),
    urgency: z.enum(['routine', 'urgent', 'emergency']),
    referral_type: z.enum([
        'consultation_required',
        'second_opinion_only',
        'transfer_of_care',
        'procedure_request',
        'diagnostic_request',
    ]),
    care_relationship_type: z.enum([
        'consultation_only',
        'shared_care',
        'transfer_of_care',
    ]),
    reason_for_referral: z.string().min(10, 'Reason must be at least 10 characters'),
    comments: z.string(),
    is_draft: z.boolean(),
}).superRefine((data, ctx) => {
    if (!data.is_external && !data.referred_to) {
        ctx.addIssue({ code: 'custom', message: 'Select a receiving doctor', path: ['referred_to'] });
    }
    if (data.is_external && !data.external_doctor_name?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Doctor name is required for external referrals', path: ['external_doctor_name'] });
    }
    if (data.is_external && !data.external_doctor_email?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Doctor email is required for external referrals', path: ['external_doctor_email'] });
    }
});

export type ReferralFormData = z.infer<typeof referralSchema>;
