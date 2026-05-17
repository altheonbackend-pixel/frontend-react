/**
 * Resolve the *active user's* IANA timezone and provide formatters that
 * use it automatically.
 *
 * Order:
 *   1. Doctor profile (`profile.timezone`) when the user is a doctor.
 *   2. Patient portal settings (loaded via tanstack-query) when the user is a patient.
 *   3. Browser's resolved IANA tz (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
 *   4. 'UTC' as a final safety net.
 *
 * Components should call `useFormatDateTime()` and use its formatters — never
 * reach for `toLocaleString` directly, since that uses the *browser* timezone
 * which can differ from the user's configured timezone.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/hooks/useAuth';
import api from '../services/api';
import {
    formatDate,
    formatDateLong,
    formatDateShort,
    formatDateTime,
    formatDateTimeLong,
    formatDayMonth,
    formatRelative,
    formatTime,
    getBrowserTimezone,
    toIsoDateInTz,
    type DateInput,
    type FormatOptions,
} from '../utils/datetime';

interface PatientSettingsTimezone {
    timezone?: string | null;
}

export function useUserTimezone(): string {
    const { userType, profile } = useAuth();
    const browserTz = getBrowserTimezone();

    // Doctor: profile hydrates synchronously on session restore — read directly.
    const doctorTz = profile?.timezone;

    // Patient: settings live behind a separate query. We only fetch when the
    // user is actually a patient so doctors don't issue unnecessary calls.
    const { data: patientSettings } = useQuery<PatientSettingsTimezone>({
        queryKey: ['patient', 'settings', 'timezone'],
        queryFn: async () => {
            const res = await api.get('/patient/settings/');
            return res.data;
        },
        enabled: userType === 'patient',
        staleTime: 5 * 60_000,
    });

    if (userType === 'doctor' && doctorTz) return doctorTz;
    if (userType === 'patient' && patientSettings?.timezone) return patientSettings.timezone;
    return browserTz || 'UTC';
}

/**
 * Pre-bound formatters that pick up the active user's tz and i18n language.
 *
 *     const { formatDateTime } = useFormatDateTime();
 *     return <span>{formatDateTime(appt.appointment_date)}</span>;
 *
 * For "in a different timezone" use cases, call the raw formatters from
 * `shared/utils/datetime` directly and pass an explicit `timeZone`.
 */
export function useFormatDateTime() {
    const timeZone = useUserTimezone();
    const { i18n } = useTranslation();
    const locale = i18n.language || 'en';

    return useMemo(() => {
        const bind = <Fn extends (v: DateInput, opts?: FormatOptions) => string>(fn: Fn) =>
            (v: DateInput, opts: FormatOptions = {}) =>
                fn(v, { timeZone, locale, ...opts });
        return {
            timeZone,
            locale,
            formatDate: bind(formatDate),
            formatDateShort: bind(formatDateShort),
            formatDateLong: bind(formatDateLong),
            formatDayMonth: bind(formatDayMonth),
            formatTime: bind(formatTime),
            formatDateTime: bind(formatDateTime),
            formatDateTimeLong: bind(formatDateTimeLong),
            formatRelative: bind(formatRelative),
            toIsoDateInTz: (v: DateInput) => toIsoDateInTz(v, timeZone),
        };
    }, [timeZone, locale]);
}
