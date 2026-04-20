import { z } from 'zod';

export const referralSchema = z.object({
  is_external: z.boolean(),
  referred_to: z.number().int().positive().nullable().optional(),
  external_doctor_name: z.string(),
  external_doctor_email: z.union([z.string().email('Enter a valid email'), z.literal('')]).optional(),
  external_hospital: z.string(),
  specialty_requested: z.enum([
    'general_practice','cardiology','dermatology','endocrinology','gastroenterology',
    'hematology','infectious_disease','internal_medicine','nephrology','neurology',
    'oncology','ophthalmology','orthopedics','pediatrics','psychiatry','pulmonology',
    'radiology','rheumatology','surgery_general','urology','gynecology','ent',
    'emergency_medicine','anesthesiology','pathology','other',
  ], { errorMap: () => ({ message: 'Select a specialty' }) }),
  urgency: z.enum(['routine', 'urgent', 'emergency']),
  reason_for_referral: z.string().min(10, 'Reason must be at least 10 characters'),
  comments: z.string(),
}).superRefine((data, ctx) => {
  if (!data.is_external && !data.referred_to) {
    ctx.addIssue({ code: 'custom', message: 'Select a receiving doctor', path: ['referred_to'] });
  }
  if (data.is_external && !data.external_hospital?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Hospital name required for external referrals', path: ['external_hospital'] });
  }
});

export type ReferralFormData = z.infer<typeof referralSchema>;
