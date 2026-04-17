import { z } from 'zod';

export const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email address'),
  specialty: z.string().optional().default(''),
  license_number: z.string().optional().default(''),
  phone_number: z.string().min(7, 'Enter a valid phone number').optional().or(z.literal('')),
  address: z.string().min(5, 'Address must be at least 5 characters').optional().or(z.literal('')),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
