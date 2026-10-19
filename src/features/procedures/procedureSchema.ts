import { z } from 'zod';

// Values only — the visible label is resolved at render time through
// `consultation.procedure_category.<value>` so the dropdown follows the
// user's language. Hardcoding English labels here left the category list
// in English on a French UI.
export const PROCEDURE_CATEGORY_VALUES = [
    'surgical',
    'diagnostic',
    'therapeutic',
    'screening',
    'vaccination',
    'other',
] as const;

export type ProcedureCategory = typeof PROCEDURE_CATEGORY_VALUES[number];

/** i18n key for a category value, e.g. 'surgical' → consultation.procedure_category.surgical */
export const procedureCategoryKey = (value: string) => `consultation.procedure_category.${value}`;

const CATEGORY_VALUES = PROCEDURE_CATEGORY_VALUES as unknown as [string, ...string[]];

// Messages are i18n keys, resolved with t() where the error is rendered.
export const procedureSchema = z.object({
  procedure_category: z.enum(CATEGORY_VALUES),
  procedure_type: z.string().min(1, 'medical_procedure.error.type_required'),
  procedure_date: z.string().min(1, 'medical_procedure.error.date_required'),
  result: z.string(),
});

export type ProcedureFormData = z.infer<typeof procedureSchema>;
