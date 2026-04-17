import { z } from 'zod';

export const referralSchema = z.object({
  is_external: z.boolean().default(false),
  referred_to: z.preprocess(
    v => (v === '' || v == null) ? null : Number(v),
    z.number().optional().nullable()
  ),
  external_doctor_name: z.string().optional().default(''),
  external_hospital: z.string().optional().default(''),
  specialty_requested: z.string().min(1, 'Specialty is required'),
  urgency: z.enum(['routine', 'urgent', 'emergency']).default('routine'),
  reason_for_referral: z.string().min(10, 'Reason must be at least 10 characters'),
  comments: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  if (!data.is_external && !data.referred_to) {
    ctx.addIssue({ code: 'custom', message: 'Select a receiving doctor', path: ['referred_to'] });
  }
  if (data.is_external && !data.external_hospital?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Hospital name required for external referrals', path: ['external_hospital'] });
  }
});

export type ReferralFormData = z.infer<typeof referralSchema>;
