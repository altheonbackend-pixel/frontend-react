import type { TFunction } from 'i18next';

/**
 * Translate a backend enum value for display.
 *
 * The API returns choice labels through Django's `get_*_display()`, which is
 * always English — `specialty_display`, `status_display`, the `label` field of
 * `/specialties/`, and so on. Rendering those directly leaves English strings
 * on a French UI. Always key off the raw enum *value* against a local
 * catalogue instead, and keep the server string only as a last-resort fallback.
 *
 *   enumLabel(t, 'specialties', 'cardiology', doctor.specialty_display)
 *     → "Cardiologie" in FR, "Cardiology" in EN
 */
export function humanizeEnum(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function enumLabel(
    t: TFunction,
    keyPrefix: string,
    value: string | null | undefined,
    fallback?: string,
) {
    if (!value) return fallback ?? '';
    return t(`${keyPrefix}.${value}`, { defaultValue: fallback ?? humanizeEnum(value) });
}

/** Convenience for the most common case — doctor specialties. */
export function specialtyLabel(t: TFunction, value?: string | null, fallback?: string) {
    return enumLabel(t, 'specialties', value, fallback);
}

export default enumLabel;
