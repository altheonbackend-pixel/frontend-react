import { z } from 'zod';

export const appointmentSchema = z.object({
  patient: z.string().min(1, 'Select a patient'),
  appointment_date: z.string().min(1, 'Date and time required'),
  reason_for_appointment: z.string().min(3, 'Reason must be at least 3 characters'),
  appointment_type: z.enum(['in_person', 'telemedicine']),
  status: z.enum(['scheduled', 'confirmed']),
  notes: z.string(),
});

export type AppointmentFormData = z.infer<typeof appointmentSchema>;
