/**
 * Central datetime formatting for Altheon Connect.
 *
 * One module, one set of rules — never reach for `toLocaleString` /
 * `toLocaleDateString` / `toLocaleTimeString` directly in components, since
 * those silently use the browser's timezone and locale. Always go through
 * this file so doctor/patient timezone preferences are respected end-to-end.
 *
 * Backend canonical formats (mirrored from `core.time_utils.FMT_*`):
 *   - DATE        → "17 May 2026"
 *   - TIME        → "14:30"
 *   - DATETIME    → "Sun, 17 May 14:30"  (one-line UI)
 *   - DATETIME_LONG → "Sun, 17 May 2026 at 14:30"
 *
 * For inputs:
 *   - ISO 8601 strings ("2026-05-17T14:30:00Z" or "2026-05-17T14:30:00+05:00") — preferred.
 *   - Date-only strings ("2026-05-17") — assumed local-midnight in the chosen tz.
 *   - `Date` and number (ms epoch).
 *
 * For options:
 *   - `timeZone`: IANA string. Defaults to the browser tz. The caller is
 *     responsible for passing the doctor/patient tz when known — usually
 *     via the `useFormatDateTime` hook.
 *   - `locale`: BCP-47 string. Defaults to 'en'; pass the i18n active language
 *     when calling from a component.
 *   - `appendTzLabel`: when true, suffix " (PKT)" / " (UTC+05:00)" — use this
 *     in emails-like contexts where the user might otherwise misread the time.
 */

export type DateInput = string | number | Date | null | undefined;

export interface FormatOptions {
    timeZone?: string;
    locale?: string;
    appendTzLabel?: boolean;
}

/**
 * Convert any supported input into a Date. Returns `null` for null/undefined/
 * empty/invalid input so callers can render fallbacks safely.
 *
 * Date-only strings like "2026-05-17" are anchored at local-midnight UTC
 * (via the "T00:00:00Z" suffix) so they don't drift into yesterday/tomorrow
 * when the browser sits west/east of UTC.
 */
export function toDate(value: DateInput): Date | null {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    // String: detect date-only and anchor at UTC midnight to avoid TZ drift.
    const trimmed = value.trim();
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    const d = new Date(dateOnly ? `${trimmed}T00:00:00Z` : trimmed);
    return isNaN(d.getTime()) ? null : d;
}

/** Returns the browser's resolved IANA timezone, or 'UTC' on environments
 * (older test runners) where the Intl API doesn't expose one. */
export function getBrowserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

function buildOptions(
    base: Intl.DateTimeFormatOptions,
    { timeZone }: FormatOptions,
): Intl.DateTimeFormatOptions {
    return timeZone ? { ...base, timeZone } : base;
}

function format(value: DateInput, opts: FormatOptions, base: Intl.DateTimeFormatOptions): string {
    const d = toDate(value);
    if (!d) return '';
    const locale = opts.locale || 'en';
    const intlOpts = buildOptions(base, opts);
    let out = new Intl.DateTimeFormat(locale, intlOpts).format(d);
    if (opts.appendTzLabel) {
        out += ` (${tzLabel(d, opts.timeZone)})`;
    }
    return out;
}

/** "17 May 2026" — long-form date, no time. */
export function formatDate(value: DateInput, opts: FormatOptions = {}): string {
    return format(value, opts, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Sun, 17 May" — short date with weekday, for inline use. */
export function formatDateShort(value: DateInput, opts: FormatOptions = {}): string {
    return format(value, opts, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "17 May" — day + month only, useful for week ranges and inline chips. */
export function formatDayMonth(value: DateInput, opts: FormatOptions = {}): string {
    return format(value, opts, { day: 'numeric', month: 'short' });
}

/** "Sunday, 17 May 2026" — long-form date with weekday, for page headers. */
export function formatDateLong(value: DateInput, opts: FormatOptions = {}): string {
    return format(value, opts, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** "14:30" — 24-hour clock, no seconds. */
export function formatTime(value: DateInput, opts: FormatOptions = {}): string {
    return format(value, opts, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "Sun, 17 May 14:30" — the canonical one-line datetime for lists. */
export function formatDateTime(value: DateInput, opts: FormatOptions = {}): string {
    return format(value, opts, {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
}

/** "Sunday, 17 May 2026 at 14:30" — for headers and confirmations. */
export function formatDateTimeLong(value: DateInput, opts: FormatOptions = {}): string {
    return format(value, opts, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
}

/** "in 5 minutes" / "2 hours ago" — uses browser-local for the "now" comparison. */
export function formatRelative(value: DateInput, opts: FormatOptions = {}): string {
    const d = toDate(value);
    if (!d) return '';
    const locale = opts.locale || 'en';
    const diffMs = d.getTime() - Date.now();
    const absMs = Math.abs(diffMs);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (absMs < 60_000) return rtf.format(0, 'minute');
    if (absMs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
    if (absMs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
    if (absMs < 7 * 86_400_000) return rtf.format(Math.round(diffMs / 86_400_000), 'day');
    return formatDate(d, opts);
}

/** True if `value` is strictly in the past. Useful for "past slot" badges. */
export function isPast(value: DateInput, now: number = Date.now()): boolean {
    const d = toDate(value);
    return d ? d.getTime() < now : false;
}

/**
 * YYYY-MM-DD for the *calendar day in `timeZone`* — never the browser's day.
 * Use this when sending a date to the backend for endpoints like
 * `/appointments/day-slots/?date=YYYY-MM-DD`, where the backend interprets
 * the date in the doctor's timezone. Passing a browser-local YYYY-MM-DD
 * would cause off-by-one bugs when patient and doctor sit in different zones.
 */
export function toIsoDateInTz(value: DateInput, timeZone?: string): string {
    const d = toDate(value);
    if (!d) return '';
    const opts: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        ...(timeZone ? { timeZone } : {}),
    };
    // en-CA → "YYYY-MM-DD" — a stable, locale-independent ISO format.
    return new Intl.DateTimeFormat('en-CA', opts).format(d);
}

/**
 * Short tz label for inline display: "PKT" / "PST" when available, otherwise
 * "UTC±HH:MM". Useful for "14:30 (PKT)" labels where the user might otherwise
 * assume UTC.
 */
export function tzLabel(value: DateInput, timeZone?: string): string {
    const d = toDate(value) || new Date();
    const tz = timeZone || getBrowserTimezone();
    try {
        // shortGeneric gives "PKT" / "PST" on modern Intl; falls back to offset.
        const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
            .formatToParts(d);
        const name = parts.find(p => p.type === 'timeZoneName')?.value;
        if (name && !/^GMT[+-]?\d/.test(name)) return name;
    } catch { /* fall through */ }
    return offsetLabel(d, tz);
}

function offsetLabel(d: Date, timeZone: string): string {
    // Reconstruct the offset by formatting the same instant in the target tz
    // and comparing to UTC. This is robust across DST.
    const dtfTz = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const parts = Object.fromEntries(
        dtfTz.formatToParts(d).filter(p => p.type !== 'literal').map(p => [p.type, p.value]),
    );
    const localMs = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour === '24' ? 0 : parts.hour),
        Number(parts.minute), Number(parts.second),
    );
    const offsetMin = Math.round((localMs - d.getTime()) / 60_000);
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `UTC${sign}${hh}:${mm}`;
}
