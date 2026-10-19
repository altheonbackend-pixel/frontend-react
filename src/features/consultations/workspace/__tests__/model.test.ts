import { describe, expect, it } from 'vitest';
import {
    alertSignature, alertsFor, canSign, diffAgainstSnapshot, emptyValues, fromConsultation,
    readiness, sectionDone, toPayload, vitalError, type ConsultationDTO,
} from '../model';

const base = () => ({ ...emptyValues('2026-10-18'), reason_for_consultation: 'Diabetes and BP follow-up' });

describe('payload mapping', () => {
    it('turns vital strings into numbers, French commas included, and blanks into null', () => {
        const v = { ...base(), temperature: '38,4', pulse: '104', weight: '' };
        const p = toPayload(v, ['temperature', 'pulse', 'weight', 'icd_code']);
        expect(p).toEqual({ temperature: 38.4, pulse: 104, weight: null, icd_code: null });
    });
    it('reads decimals from the API as plain numbers', () => {
        const c = { id: 1, patient: 'p', doctor: 1, consultation_date: '2026-10-04', consultation_type: 'in_person',
            consultation_status: 'signed', record_status: 'active', visible_to_patient: true,
            weight: '87.00', bp_systolic: 132, diagnosis: null } as unknown as ConsultationDTO;
        const v = fromConsultation(c);
        expect(v.weight).toBe('87');
        expect(v.bp_systolic).toBe('132');
        expect(v.diagnosis).toBe('');
    });
});

describe('vital validation', () => {
    it('reports non-numbers, decimals in whole-number fields and out-of-range values', () => {
        expect(vitalError('pulse', 'abc')).toBe('number');
        expect(vitalError('bp_systolic', '120.5')).toBe('whole');
        expect(vitalError('sp2', '104')).toBe('range');
        expect(vitalError('temperature', '36,9')).toBeNull();
        expect(vitalError('weight', '')).toBeNull();
    });
});

describe('readiness to sign', () => {
    it('requires a reason and a diagnosis or assessment', () => {
        const items = readiness({ ...emptyValues('2026-10-18') }, new Set());
        expect(canSign(items)).toBe(false);
        expect(canSign(readiness({ ...base(), assessment: 'Viral URTI' }, new Set()))).toBe(true);
    });
    it('blocks until each critical vital is acknowledged, and re-asks when the value changes', () => {
        const v = { ...base(), diagnosis: 'Hypertension', bp_systolic: '186', bp_diastolic: '96', temperature: '38.4' };
        expect(canSign(readiness(v, new Set()))).toBe(false);
        const critical = alertsFor(v).filter(a => a.severity === 'critical');
        expect(critical).toHaveLength(1); // fever is a warning, not blocking
        const acked = new Set(critical.map(alertSignature));
        expect(canSign(readiness(v, acked))).toBe(true);
        expect(canSign(readiness({ ...v, bp_systolic: '192' }, acked))).toBe(false);
    });
    it('treats the patient summary and follow-up as optional', () => {
        const items = readiness({ ...base(), diagnosis: 'URTI' }, new Set());
        expect(items.find(i => i.key === 'summary')).toMatchObject({ ok: false, required: false });
        expect(canSign(items)).toBe(true);
    });
});

describe('sections and amendment diff', () => {
    it('marks sections done as they are filled', () => {
        const done = sectionDone({ ...base(), pulse: '80', plan: 'Rest' }, 0);
        expect(done).toMatchObject({ visit: true, vitals: true, note: true, diagnosis: false, orders: false });
    });
    it('lists only the fields that changed since signing', () => {
        const snapshot = { diagnosis: 'Stable angina', icd_code: 'I20.9', weight: '78.00', plan: 'ECG' };
        const v = { ...base(), diagnosis: 'Unstable angina', icd_code: 'I20.0', weight: '78', plan: 'ECG' };
        expect(diffAgainstSnapshot(v, snapshot)).toEqual([
            { field: 'diagnosis', was: 'Stable angina', now: 'Unstable angina' },
            { field: 'icd_code', was: 'I20.9', now: 'I20.0' },
        ]);
        expect(diffAgainstSnapshot(v, null)).toEqual([]);
    });
});
