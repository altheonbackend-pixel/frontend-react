import type { TFunction } from 'i18next';

export const PATIENT_PORTAL_LANGUAGES = ['en', 'fr'] as const;
export type PatientPortalLanguage = typeof PATIENT_PORTAL_LANGUAGES[number];

export function normalizePortalLanguage(language?: string | null): PatientPortalLanguage {
    return language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function isSupportedPortalLanguage(language?: string | null): language is PatientPortalLanguage {
    return PATIENT_PORTAL_LANGUAGES.includes(language as PatientPortalLanguage);
}

export function formatPortalDate(
    value: string | number | Date,
    language: string | undefined,
    options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
) {
    return new Intl.DateTimeFormat(normalizePortalLanguage(language), options).format(new Date(value));
}

export function formatPortalDateTime(value: string | number | Date, language: string | undefined, timeZone?: string) {
    return formatPortalDate(value, language, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        ...(timeZone ? { timeZone } : {}),
    });
}

export function formatPortalTime(value: string | number | Date, language: string | undefined, timeZone?: string) {
    return formatPortalDate(value, language, {
        hour: '2-digit',
        minute: '2-digit',
        ...(timeZone ? { timeZone } : {}),
    });
}

export function formatPortalRelativeTime(value: string | number | Date, language: string | undefined) {
    const diffMs = new Date(value).getTime() - Date.now();
    const absMs = Math.abs(diffMs);
    const formatter = new Intl.RelativeTimeFormat(normalizePortalLanguage(language), { numeric: 'auto' });

    if (absMs < 60_000) return formatter.format(0, 'minute');
    if (absMs < 3_600_000) return formatter.format(Math.round(diffMs / 60_000), 'minute');
    if (absMs < 86_400_000) return formatter.format(Math.round(diffMs / 3_600_000), 'hour');
    return formatter.format(Math.round(diffMs / 86_400_000), 'day');
}

export function humanizeEnum(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function enumLabel(t: TFunction, keyPrefix: string, value: string | null | undefined, fallback?: string) {
    if (!value) return fallback ?? '';
    return t(`${keyPrefix}.${value}`, { defaultValue: fallback ?? humanizeEnum(value) });
}
