// Vitals input parsing + schema behaviour.
//
// Regression cover for the "impossible to save a consultation under 37" report:
// the vitals inputs are type="text" so a French comma decimal ("36,9") reaches
// numericValueAs as a raw string. Previously they were type="number", the
// browser rejected the comma as badInput, and native form validation blocked
// submit before react-hook-form ever ran.
import { describe, it, expect } from 'vitest';
import { numericValueAs } from '../vitals';
import { consultationSchema } from '../consultationSchema';

describe('numericValueAs', () => {
    it('parses a comma decimal separator', () => {
        expect(numericValueAs('36,9')).toBe(36.9);
        expect(numericValueAs('72,25')).toBe(72.25);
    });

    it('still parses a dot decimal separator', () => {
        expect(numericValueAs('36.9')).toBe(36.9);
    });

    it('parses whole numbers', () => {
        expect(numericValueAs('37')).toBe(37);
    });

    it('treats empty and whitespace-only input as null, not 0', () => {
        // Number('') and Number('  ') are both 0 — a silent fake reading.
        expect(numericValueAs('')).toBeNull();
        expect(numericValueAs('   ')).toBeNull();
        expect(numericValueAs(null)).toBeNull();
        expect(numericValueAs(undefined)).toBeNull();
    });

    it('trims surrounding whitespace', () => {
        expect(numericValueAs('  36,9  ')).toBe(36.9);
    });

    it('returns NaN for unparseable input so zod reports it', () => {
        expect(numericValueAs('abc')).toBeNaN();
    });
});

describe('consultationSchema vitals', () => {
    const base = {
        consultation_type: 'in_person' as const,
        consultation_date: '2026-07-22T10:00',
        reason_for_consultation: 'Routine check',
        diagnosis: '',
        medical_report: '',
        visible_to_patient: true,
        patient_summary: '',
        patient_instructions: '',
        height_unit: 'cm' as const,
    };

    const parse = (vitals: Record<string, unknown>) =>
        consultationSchema.safeParse({ ...base, ...vitals });

    it('accepts a temperature below 37 — the originally reported value', () => {
        const result = parse({ temperature: numericValueAs('36,9') });
        expect(result.success).toBe(true);
    });

    it('accepts omitted vitals', () => {
        expect(parse({ temperature: numericValueAs('') }).success).toBe(true);
    });

    it('rejects out-of-range temperature with a readable message', () => {
        const result = parse({ temperature: 12 });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Temperature too low');
        }
    });

    it('reports a readable message for unparseable input, not "received nan"', () => {
        const result = parse({ temperature: numericValueAs('abc') });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Enter a number, e.g. 36.9');
        }
    });
});
