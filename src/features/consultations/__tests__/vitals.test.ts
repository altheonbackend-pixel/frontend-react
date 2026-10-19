import { describe, expect, it } from 'vitest';
import { computeBmi, computeVitalAlerts } from '../vitals';

const keys = (v: Parameters<typeof computeVitalAlerts>[0]) => computeVitalAlerts(v).map(a => a.key);

describe('computeVitalAlerts (parity with backend compute_vital_alerts)', () => {
    it('returns nothing for normal vitals', () => {
        expect(keys({ sp2: 98, temperature: 37, bp_systolic: 120, bp_diastolic: 80 })).toEqual([]);
    });
    it('uses the 38.3 °C sepsis fever threshold, not 38.5', () => {
        expect(keys({ temperature: 38.3 })).toEqual(['fever']);
        expect(keys({ temperature: 38.2 })).toEqual([]);
        expect(keys({ temperature: 40.5 })).toEqual(['hyperpyrexia']);
    });
    it('grades hypoxia and hypothermia', () => {
        expect(keys({ sp2: 87 })).toEqual(['hypoxia_critical']);
        expect(keys({ sp2: 93 })).toEqual(['hypoxia']);
        expect(keys({ temperature: 34.9 })).toEqual(['hypothermia_critical']);
        expect(keys({ temperature: 35.4 })).toEqual(['hypothermia']);
    });
    it('flags blood pressure extremes', () => {
        expect(keys({ bp_systolic: 181, bp_diastolic: 121 })).toEqual(['htn_crisis_systolic', 'htn_crisis_diastolic']);
        expect(keys({ bp_systolic: 89 })).toEqual(['hypotension']);
    });
});

describe('computeBmi', () => {
    it('handles cm and m without the imperial factor', () => {
        expect(computeBmi(70, 175, 'cm')).toBe('22.9');
        expect(computeBmi(70, 1.75, 'm')).toBe('22.9');
    });
    it('returns null when data is missing', () => {
        expect(computeBmi(null, 175, 'cm')).toBeNull();
        expect(computeBmi(70, 0, 'cm')).toBeNull();
    });
});

describe('vital alert severity', () => {
    it('marks life-threatening readings critical and the rest as warnings', () => {
        const s = computeVitalAlerts({ sp2: 86, temperature: 38.4 }).map(a => [a.key, a.severity]);
        expect(s).toEqual([['hypoxia_critical', 'critical'], ['fever', 'warning']]);
    });
});

describe('extended vitals (parity with backend)', () => {
    it('grades pulse, respiratory rate, glucose and pain', () => {
        expect(keys({ pulse: 38 })).toEqual(['brady_critical']);
        expect(keys({ pulse: 125 })).toEqual(['tachy']);
        expect(keys({ respiratory_rate: 26 })).toEqual(['tachypnea']);
        expect(keys({ respiratory_rate: 6 })).toEqual(['bradypnea_critical']);
        expect(keys({ glucose_finger_stick: 55 })).toEqual(['hypoglycemia']);
        expect(keys({ glucose_finger_stick: 420 })).toEqual(['hyperglycemia_critical']);
        expect(keys({ pain_score: 7 })).toEqual(['pain_severe']);
        expect(keys({ pulse: 80, respiratory_rate: 16, glucose_finger_stick: 110, pain_score: 2 })).toEqual([]);
    });
});
