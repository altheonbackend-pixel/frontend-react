/**
 * Tests for shared/utils/datetime.ts.
 *
 * Every assertion pins both the date and the timezone, since the whole point
 * of this module is to *not* leak the browser/test-runner timezone into the
 * output. The same input + the same `timeZone` option must produce the same
 * string regardless of where Vitest runs.
 */
import { describe, it, expect } from 'vitest';
import {
    toDate,
    formatDate,
    formatDateShort,
    formatTime,
    formatDateTime,
    formatDateTimeLong,
    isPast,
    toIsoDateInTz,
    tzLabel,
    getBrowserTimezone,
} from '../datetime';

// 2026-05-17 14:30:00 UTC — the "appointment" we'll format across timezones.
const APPT_UTC_ISO = '2026-05-17T14:30:00Z';

describe('toDate', () => {
    it('returns null for null/undefined/empty', () => {
        expect(toDate(null)).toBeNull();
        expect(toDate(undefined)).toBeNull();
        expect(toDate('')).toBeNull();
    });

    it('parses ISO strings with tz', () => {
        const d = toDate(APPT_UTC_ISO)!;
        expect(d.getUTCHours()).toBe(14);
        expect(d.getUTCMinutes()).toBe(30);
    });

    it('anchors date-only strings at UTC midnight, not browser-local', () => {
        const d = toDate('2026-05-17')!;
        expect(d.toISOString()).toBe('2026-05-17T00:00:00.000Z');
    });

    it('returns null for garbage input', () => {
        expect(toDate('not a date')).toBeNull();
        expect(toDate('99-99-99')).toBeNull();
    });

    it('accepts a Date and number', () => {
        const stamp = Date.UTC(2026, 4, 17, 14, 30);
        expect(toDate(stamp)!.getTime()).toBe(stamp);
        expect(toDate(new Date(stamp))!.getTime()).toBe(stamp);
    });
});

describe('formatTime — same instant, different timezones', () => {
    it('UTC → 14:30', () => {
        expect(formatTime(APPT_UTC_ISO, { timeZone: 'UTC' })).toBe('14:30');
    });
    it('Asia/Karachi (+5) → 19:30', () => {
        expect(formatTime(APPT_UTC_ISO, { timeZone: 'Asia/Karachi' })).toBe('19:30');
    });
    it('America/Los_Angeles in May (PDT, -7) → 07:30', () => {
        expect(formatTime(APPT_UTC_ISO, { timeZone: 'America/Los_Angeles' })).toBe('07:30');
    });
});

describe('formatDateTime', () => {
    it('produces a canonical one-line format', () => {
        // "Sun, 17 May, 14:30" — exact punctuation varies by Intl impl, so we
        // assert on substrings rather than the full string.
        const out = formatDateTime(APPT_UTC_ISO, { timeZone: 'UTC', locale: 'en' });
        expect(out).toMatch(/Sun/);
        expect(out).toMatch(/May/);
        expect(out).toMatch(/14:30/);
    });

    it('localizes month names', () => {
        const out = formatDateTime(APPT_UTC_ISO, { timeZone: 'UTC', locale: 'fr' });
        // French short month for May is "mai"
        expect(out.toLowerCase()).toContain('mai');
    });

    it('appends tz label when requested', () => {
        const out = formatDateTime(APPT_UTC_ISO, { timeZone: 'Asia/Karachi', appendTzLabel: true });
        // Either "PKT" (short generic) or "UTC+05:00" (offset fallback)
        expect(out).toMatch(/\((PKT|UTC\+05:00|GMT\+5)\)/);
    });
});

describe('formatDate / formatDateShort / formatDateTimeLong', () => {
    it('formatDate is long form with year', () => {
        expect(formatDate(APPT_UTC_ISO, { timeZone: 'UTC', locale: 'en' })).toMatch(/2026/);
    });
    it('formatDateShort drops the year', () => {
        const out = formatDateShort(APPT_UTC_ISO, { timeZone: 'UTC', locale: 'en' });
        expect(out).not.toMatch(/2026/);
        expect(out).toMatch(/Sun/);
    });
    it('formatDateTimeLong includes weekday + year + time', () => {
        const out = formatDateTimeLong(APPT_UTC_ISO, { timeZone: 'UTC', locale: 'en' });
        expect(out).toMatch(/Sunday/);
        expect(out).toMatch(/2026/);
        expect(out).toMatch(/14:30/);
    });
});

describe('isPast', () => {
    it('treats earlier-than-now as past', () => {
        expect(isPast('2020-01-01T00:00:00Z')).toBe(true);
    });
    it('treats null as not-past (no opinion)', () => {
        expect(isPast(null)).toBe(false);
    });
    it('accepts a fixed `now` for deterministic comparisons', () => {
        const now = Date.UTC(2026, 4, 17, 14, 30);
        expect(isPast('2026-05-17T14:29:00Z', now)).toBe(true);
        expect(isPast('2026-05-17T14:31:00Z', now)).toBe(false);
    });
});

describe('toIsoDateInTz', () => {
    it('returns the local calendar day, not the UTC day', () => {
        // 23:00 UTC on May 17 = 04:00 on May 18 in Asia/Karachi
        expect(toIsoDateInTz('2026-05-17T23:00:00Z', 'Asia/Karachi')).toBe('2026-05-18');
        expect(toIsoDateInTz('2026-05-17T23:00:00Z', 'UTC')).toBe('2026-05-17');
    });

    it('handles date-only input safely (no off-by-one)', () => {
        // Date-only is anchored at UTC midnight, so its UTC day is its label day.
        expect(toIsoDateInTz('2026-05-17', 'UTC')).toBe('2026-05-17');
    });
});

describe('tzLabel', () => {
    it('returns a non-empty label', () => {
        expect(tzLabel(APPT_UTC_ISO, 'UTC').length).toBeGreaterThan(0);
        expect(tzLabel(APPT_UTC_ISO, 'Asia/Karachi').length).toBeGreaterThan(0);
    });
});

describe('getBrowserTimezone', () => {
    it('returns a string (typically the runner tz, e.g. UTC)', () => {
        expect(typeof getBrowserTimezone()).toBe('string');
        expect(getBrowserTimezone().length).toBeGreaterThan(0);
    });
});
