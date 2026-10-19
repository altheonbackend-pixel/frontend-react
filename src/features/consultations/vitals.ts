// Mirrors backend Consultation.compute_vital_alerts() for the vitals captured on
// the consultation form. Returns i18n keys + interpolation values; keep the
// thresholds in step with backend-django/apps/consultations/models.py.

export interface VitalAlert {
    key: string;
    value: number;
    severity: 'critical' | 'warning';
}

export interface VitalInputs {
    sp2?: number | null;
    temperature?: number | null;
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    pulse?: number | null;
    respiratory_rate?: number | null;
    glucose_finger_stick?: number | null;
    pain_score?: number | null;
}

/** Which vital field each alert belongs to (for tile colouring). */
export const ALERT_FIELD: Record<string, keyof VitalInputs> = {
    hypoxia_critical: 'sp2', hypoxia: 'sp2',
    hyperpyrexia: 'temperature', fever: 'temperature', hypothermia_critical: 'temperature', hypothermia: 'temperature',
    htn_crisis_systolic: 'bp_systolic', hypotension: 'bp_systolic', htn_crisis_diastolic: 'bp_diastolic',
    brady_critical: 'pulse', tachy_critical: 'pulse', tachy: 'pulse', brady: 'pulse',
    bradypnea_critical: 'respiratory_rate', tachypnea_critical: 'respiratory_rate', tachypnea: 'respiratory_rate',
    hypoglycemia_critical: 'glucose_finger_stick', hypoglycemia: 'glucose_finger_stick',
    hyperglycemia_critical: 'glucose_finger_stick', hyperglycemia: 'glucose_finger_stick',
    pain_severe: 'pain_score',
};

export const VITAL_ALERT_PREFIX = 'consultation.vital_alert.';

// Life-threatening readings; everything else flagged is a warning.
const CRITICAL = new Set([
    'hypoxia_critical', 'hyperpyrexia', 'hypothermia_critical', 'htn_crisis_systolic', 'htn_crisis_diastolic',
    'brady_critical', 'tachy_critical', 'bradypnea_critical', 'tachypnea_critical',
    'hypoglycemia_critical', 'hyperglycemia_critical',
]);

export function computeVitalAlerts(inputs: VitalInputs): VitalAlert[] {
    return computeRaw(inputs).map(a => ({ ...a, severity: CRITICAL.has(a.key) ? 'critical' : 'warning' }));
}

function computeRaw({
    sp2, temperature, bp_systolic, bp_diastolic, pulse, respiratory_rate, glucose_finger_stick, pain_score,
}: VitalInputs): Array<{ key: string; value: number }> {
    const alerts: Array<{ key: string; value: number }> = [];
    if (sp2 != null) {
        if (sp2 < 88) alerts.push({ key: `hypoxia_critical`, value: sp2 });
        else if (sp2 < 94) alerts.push({ key: `hypoxia`, value: sp2 });
    }
    if (temperature != null) {
        if (temperature > 40) alerts.push({ key: `hyperpyrexia`, value: temperature });
        else if (temperature >= 38.3) alerts.push({ key: `fever`, value: temperature });
        else if (temperature < 35) alerts.push({ key: `hypothermia_critical`, value: temperature });
        else if (temperature < 35.5) alerts.push({ key: `hypothermia`, value: temperature });
    }
    if (bp_systolic != null) {
        if (bp_systolic > 180) alerts.push({ key: `htn_crisis_systolic`, value: bp_systolic });
        else if (bp_systolic < 90) alerts.push({ key: `hypotension`, value: bp_systolic });
    }
    if (bp_diastolic != null && bp_diastolic > 120) {
        alerts.push({ key: `htn_crisis_diastolic`, value: bp_diastolic });
    }
    if (pulse != null) {
        if (pulse < 40) alerts.push({ key: 'brady_critical', value: pulse });
        else if (pulse > 150) alerts.push({ key: 'tachy_critical', value: pulse });
        else if (pulse > 120) alerts.push({ key: 'tachy', value: pulse });
        else if (pulse < 50) alerts.push({ key: 'brady', value: pulse });
    }
    if (respiratory_rate != null) {
        if (respiratory_rate < 8) alerts.push({ key: 'bradypnea_critical', value: respiratory_rate });
        else if (respiratory_rate > 30) alerts.push({ key: 'tachypnea_critical', value: respiratory_rate });
        else if (respiratory_rate > 24) alerts.push({ key: 'tachypnea', value: respiratory_rate });
    }
    if (glucose_finger_stick != null) {
        const g = glucose_finger_stick;
        if (g < 40) alerts.push({ key: 'hypoglycemia_critical', value: g });
        else if (g < 60) alerts.push({ key: 'hypoglycemia', value: g });
        else if (g > 400) alerts.push({ key: 'hyperglycemia_critical', value: g });
        else if (g > 300) alerts.push({ key: 'hyperglycemia', value: g });
    }
    if (pain_score != null && pain_score >= 7) alerts.push({ key: 'pain_severe', value: pain_score });
    return alerts;
}

/** BMI from kg and a height stored in cm or m (never imperial). */
export function computeBmi(weightKg: number | null | undefined, height: number | null | undefined, unit: string): string | null {
    if (!weightKg || !height || height <= 0) return null;
    const heightM = unit === 'm' ? height : height / 100;
    return (weightKg / (heightM ** 2)).toFixed(1);
}

// Helper: convert empty string input to null for optional numeric fields.
// Accepts the comma decimal separator ("36,9") — French writes vitals that way,
// and the vitals inputs are type="text" so the raw string reaches us unparsed.
// Returns NaN for genuinely unparseable input so zod reports it rather than
// silently dropping the reading.
export const numericValueAs = (v: unknown) => {
    if (v == null) return null;
    const raw = String(v).trim().replace(',', '.');
    return raw === '' ? null : Number(raw);
};
