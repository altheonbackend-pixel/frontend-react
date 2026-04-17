import { z } from 'zod';

export const appointmentSchema = z.object({
  patient: z.string().min(1, 'Select a patient'),
  appointment_date: z.string().min(1, 'Date and time required'),
  reason_for_appointment: z.string().min(3, 'Reason must be at least 3 characters'),
  status: z.enum(['scheduled', 'confirmed']).default('scheduled'),
  notes: z.string().optional().default(''),
});

export type AppointmentFormData = z.infer<typeof appointmentSchema>;
