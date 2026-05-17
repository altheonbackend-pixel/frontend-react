import type { TFunction } from 'i18next';
import {
    formatDate as sharedFormatDate,
    formatDateTime as sharedFormatDateTime,
    formatRelative as sharedFormatRelative,
    formatTime as sharedFormatTime,
} from '../../../shared/utils/datetime';

export const PATIENT_PORTAL_LANGUAGES = ['en', 'fr'] as const;
export type PatientPortalLanguage = typeof PATIENT_PORTAL_LANGUAGES[number];

export function normalizePortalLanguage(language?: string | null): PatientPortalLanguage {
    return language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function isSupportedPortalLanguage(language?: string | null): language is PatientPortalLanguage {
    return PATIENT_PORTAL_LANGUAGES.includes(language as PatientPortalLanguage);
}

// Thin adapters over the shared datetime utils so existing patient-portal
// callers keep working without churn. New code should call the shared
// formatters directly, or use `useFormatDateTime()` from shared/hooks.

export function formatPortalDate(
    value: string | number | Date,
    language: string | undefined,
    options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
) {
    return new Intl.DateTimeFormat(normalizePortalLanguage(language), options).format(new Date(value));
}

export function formatPortalDateTime(value: string | number | Date, language: string | undefined, timeZone?: string) {
    return sharedFormatDateTime(value, { locale: normalizePortalLanguage(language), timeZone });
}

export function formatPortalTime(value: string | number | Date, language: string | undefined, timeZone?: string) {
    return sharedFormatTime(value, { locale: normalizePortalLanguage(language), timeZone });
}

export function formatPortalRelativeTime(value: string | number | Date, language: string | undefined) {
    return sharedFormatRelative(value, { locale: normalizePortalLanguage(language) });
}

// Retained for explicit "long date with year" use cases. Most callers should
// migrate to the shared `formatDate` directly.
export function formatPortalLongDate(value: string | number | Date, language: string | undefined, timeZone?: string) {
    return sharedFormatDate(value, { locale: normalizePortalLanguage(language), timeZone });
}

export function humanizeEnum(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function enumLabel(t: TFunction, keyPrefix: string, value: string | null | undefined, fallback?: string) {
    if (!value) return fallback ?? '';
    return t(`${keyPrefix}.${value}`, { defaultValue: fallback ?? humanizeEnum(value) });
}
