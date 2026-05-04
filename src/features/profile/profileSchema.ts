import { z } from 'zod';

export const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email address'),
  specialty: z.string(),
  license_number: z.string(),
  phone_number: z.union([z.string().min(7, 'Enter a valid phone number'), z.literal('')]),
  address: z.union([z.string().min(5, 'Address must be at least 5 characters'), z.literal('')]),
  next_available: z.string().optional(),
  timezone: z.string().optional(),
  accepting_referrals: z.boolean().optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
