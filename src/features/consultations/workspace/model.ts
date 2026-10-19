// Consultation workspace — pure data logic (no React), unit-tested.
// Maps the note between the API shape and the form, decides what is still
// missing before signing, and diffs an amendment against the signed version.

import { computeVitalAlerts, type VitalAlert } from '../vitals';

export const VITAL_FIELDS = [
    'weight', 'height', 'bp_systolic', 'bp_diastolic', 'pulse', 'temperature',
    'sp2', 'respiratory_rate', 'glucose_finger_stick', 'pain_score',
] as const;
export type VitalField = typeof VITAL_FIELDS[number];

export const TEXT_FIELDS = [
    'reason_for_consultation', 'subjective', 'objective', 'assessment', 'plan',
    'diagnosis', 'icd_code', 'patient_summary', 'patient_instructions',
] as const;
export type TextField = typeof TEXT_FIELDS[number];

export interface WorkspaceValues {
    consultation_date: string;
    consultation_type: 'in_person' | 'telemedicine' | 'home_visit';
    height_unit: 'cm' | 'm';
    follow_up_date: string;
    visible_to_patient: boolean;
    reason_for_consultation: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    diagnosis: string;
    icd_code: string;
    patient_summary: string;
    patient_instructions: string;
    weight: string;
    height: string;
    bp_systolic: string;
    bp_diastolic: string;
    pulse: string;
    temperature: string;
    sp2: string;
    respiratory_rate: string;
    glucose_finger_stick: string;
    pain_score: string;
}

/** Plausible ranges (same limits the old form's zod schema used, extended). */
export const VITAL_RANGES: Record<VitalField, { min: number; max: number; int?: boolean }> = {
    weight: { min: 0.5, max: 500 },
    height: { min: 0.3, max: 300 },
    bp_systolic: { min: 50, max: 300, int: true },
    bp_diastolic: { min: 30, max: 200, int: true },
    pulse: { min: 20, max: 250, int: true },
    temperature: { min: 30, max: 45 },
    sp2: { min: 50, max: 100 },
    respiratory_rate: { min: 4, max: 80, int: true },
    glucose_finger_stick: { min: 10, max: 900 },
    pain_score: { min: 0, max: 10, int: true },
};

/** "36,9" → 36.9; "" → null; garbage → NaN (reported as an error). */
export function parseNumber(raw: string | number | null | undefined): number | null {
    if (raw == null) return null;
    const s = String(raw).trim().replace(',', '.');
    if (s === '') return null;
    return Number(s);
}

export function vitalError(field: VitalField, raw: string): 'number' | 'range' | 'whole' | null {
    const n = parseNumber(raw);
    if (n == null) return null;
    if (Number.isNaN(n)) return 'number';
    const r = VITAL_RANGES[field];
    if (r.int && !Number.isInteger(n)) return 'whole';
    if (n < r.min || n > r.max) return 'range';
    return null;
}

const str = (v: unknown) => (v == null ? '' : String(v));

export interface ConsultationDTO {
    id: number;
    patient: string;
    doctor: number;
    appointment?: number | null;
    consultation_date: string;
    consultation_type: string;
    consultation_status: 'draft' | 'in_progress' | 'signed' | 'amended';
    record_status: 'active' | 'voided' | 'entered_in_error';
    height_unit?: string;
    follow_up_date?: string | null;
    follow_up_appointment?: number | null;
    follow_up_appointment_info?: { id: number; status: string; appointment_date: string } | null;
    visible_to_patient: boolean;
    share_with_patient_at?: string | null;
    signed_at?: string | null;
    amended_at?: string | null;
    amendment_reason?: string;
    void_reason?: string;
    created_at?: string | null;
    signed_snapshot?: Record<string, unknown> | null;
    doctor_name?: string | null;
    prescriptions?: Array<{ id: number; medication_name: string; dosage: string; frequency: string; frequency_display?: string; duration_days: number | null; status: string }>;
    lab_orders?: Array<{ id: number; test_name: string; order_status: string; priority: string; notes: string }>;
    procedures?: Array<{ id: number; procedure_type: string; procedure_category: string; procedure_date: string; result?: string | null }>;
    vital_alert_dismissals?: Array<{ id: number; alert_text: string; reason: string; dismissed_at: string }>;
    [key: string]: unknown;
}

export function emptyValues(today: string): WorkspaceValues {
    return {
        consultation_date: today, consultation_type: 'in_person', height_unit: 'cm', follow_up_date: '',
        visible_to_patient: true,
        reason_for_consultation: '', subjective: '', objective: '', assessment: '', plan: '',
        diagnosis: '', icd_code: '', patient_summary: '', patient_instructions: '',
        weight: '', height: '', bp_systolic: '', bp_diastolic: '', pulse: '', temperature: '',
        sp2: '', respiratory_rate: '', glucose_finger_stick: '', pain_score: '',
    };
}

export function fromConsultation(c: ConsultationDTO): WorkspaceValues {
    const v = emptyValues(c.consultation_date);
    v.consultation_type = (['in_person', 'telemedicine', 'home_visit'].includes(c.consultation_type)
        ? c.consultation_type : 'in_person') as WorkspaceValues['consultation_type'];
    v.height_unit = c.height_unit === 'm' ? 'm' : 'cm';
    v.follow_up_date = str(c.follow_up_date);
    v.visible_to_patient = !!c.visible_to_patient;
    for (const f of TEXT_FIELDS) v[f] = str(c[f]);
    // Decimals come back as "87.00" — show them as typed numbers.
    for (const f of VITAL_FIELDS) v[f] = c[f] == null ? '' : String(Number(c[f]));
    return v;
}

/** API body for the given fields (all fields when `only` is omitted). */
export function toPayload(v: WorkspaceValues, only?: Array<keyof WorkspaceValues>): Record<string, unknown> {
    const keys = only ?? (Object.keys(v) as Array<keyof WorkspaceValues>);
    const out: Record<string, unknown> = {};
    for (const k of keys) {
        if ((VITAL_FIELDS as readonly string[]).includes(k)) {
            const n = parseNumber(v[k] as string);
            out[k] = n == null || Number.isNaN(n) ? null : n;
        } else if (k === 'follow_up_date' || k === 'icd_code') {
            out[k] = (v[k] as string) || null;
        } else {
            out[k] = v[k];
        }
    }
    return out;
}

export function vitalInputs(v: WorkspaceValues) {
    const n = (f: VitalField) => {
        const x = parseNumber(v[f]);
        return x == null || Number.isNaN(x) ? null : x;
    };
    return {
        sp2: n('sp2'), temperature: n('temperature'), bp_systolic: n('bp_systolic'), bp_diastolic: n('bp_diastolic'),
        pulse: n('pulse'), respiratory_rate: n('respiratory_rate'), glucose_finger_stick: n('glucose_finger_stick'),
        pain_score: n('pain_score'),
    };
}

export function alertsFor(v: WorkspaceValues): VitalAlert[] {
    return computeVitalAlerts(vitalInputs(v));
}

/** Stable text stored with an acknowledgement, so a changed value needs a new one. */
export function alertSignature(a: VitalAlert): string {
    return `${a.key}:${a.value}`;
}

export type ReadinessKey = 'reason' | 'diagnosis' | 'vitals_valid' | 'critical_ack' | 'summary' | 'follow_up';

export interface ReadinessItem {
    key: ReadinessKey;
    ok: boolean;
    required: boolean;
    count?: number;
}

/** What the review-and-sign sheet checks. Required items block signing. */
export function readiness(v: WorkspaceValues, acknowledged: Set<string>): ReadinessItem[] {
    const critical = alertsFor(v).filter(a => a.severity === 'critical');
    const unacked = critical.filter(a => !acknowledged.has(alertSignature(a)));
    const invalidVitals = VITAL_FIELDS.filter(f => vitalError(f, v[f]) != null);
    return [
        { key: 'reason', ok: v.reason_for_consultation.trim().length >= 5, required: true },
        { key: 'diagnosis', ok: !!(v.diagnosis.trim() || v.icd_code.trim() || v.assessment.trim()), required: true },
        { key: 'vitals_valid', ok: invalidVitals.length === 0, required: true, count: invalidVitals.length },
        { key: 'critical_ack', ok: unacked.length === 0, required: true, count: unacked.length },
        { key: 'summary', ok: !v.visible_to_patient || !!v.patient_summary.trim(), required: false },
        { key: 'follow_up', ok: !!v.follow_up_date, required: false },
    ];
}

export const canSign = (items: ReadinessItem[]) => items.every(i => !i.required || i.ok);

export type SectionKey = 'visit' | 'vitals' | 'note' | 'diagnosis' | 'orders' | 'patient';

export function sectionDone(v: WorkspaceValues, orderCount: number): Record<SectionKey, boolean> {
    return {
        visit: v.reason_for_consultation.trim().length >= 5,
        vitals: VITAL_FIELDS.some(f => parseNumber(v[f]) != null),
        note: !!(v.subjective.trim() || v.objective.trim() || v.assessment.trim() || v.plan.trim()),
        diagnosis: !!(v.diagnosis.trim() || v.icd_code.trim()),
        orders: orderCount > 0,
        patient: !v.visible_to_patient || !!v.patient_summary.trim(),
    };
}

export interface FieldChange {
    field: string;
    was: string;
    now: string;
}

/** Fields an amendment changed, compared with the signed snapshot. */
export function diffAgainstSnapshot(v: WorkspaceValues, snapshot: Record<string, unknown> | null | undefined): FieldChange[] {
    if (!snapshot) return [];
    const changes: FieldChange[] = [];
    const norm = (field: string, raw: unknown) => {
        if (raw == null || raw === '') return '';
        if ((VITAL_FIELDS as readonly string[]).includes(field)) return String(Number(raw));
        return String(raw).trim();
    };
    for (const field of [...TEXT_FIELDS, ...VITAL_FIELDS, 'consultation_date', 'follow_up_date'] as const) {
        if (!(field in snapshot)) continue;
        const was = norm(field, snapshot[field]);
        const now = norm(field, v[field as keyof WorkspaceValues]);
        if (was !== now) changes.push({ field, was, now });
    }
    return changes;
}

export const isEditableStatus = (c: Pick<ConsultationDTO, 'consultation_status' | 'record_status'>) =>
    c.record_status === 'active' && c.consultation_status !== 'signed';
