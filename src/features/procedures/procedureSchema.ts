import { z } from 'zod';

export const PROCEDURE_CATEGORIES = [
    { value: 'surgical', label: 'Surgical' },
    { value: 'diagnostic', label: 'Diagnostic' },
    { value: 'therapeutic', label: 'Therapeutic' },
    { value: 'screening', label: 'Screening' },
    { value: 'vaccination', label: 'Vaccination' },
    { value: 'other', label: 'Other' },
] as const;

const CATEGORY_VALUES = PROCEDURE_CATEGORIES.map(c => c.value) as [string, ...string[]];

export const procedureSchema = z.object({
  procedure_category: z.enum(CATEGORY_VALUES as [string, ...string[]]),
  procedure_type: z.string().min(1, 'Procedure type is required'),
  procedure_date: z.string().min(1, 'Date is required'),
  result: z.string(),
});

export type ProcedureFormData = z.infer<typeof procedureSchema>;
