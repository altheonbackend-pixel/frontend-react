// Shared constants for the doctor Settings page.

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

// IANA timezones offered to doctors. Mirrors the backend TIMEZONE_CHOICES
// in apps/accounts/models.py. labelKey resolves against the i18n catalogue.
export const TIMEZONES = [
    { value: 'UTC',                 labelKey: 'patient_portal.timezones.utc' },
    { value: 'Africa/Dakar',        labelKey: 'timezones.africa_dakar' },
    { value: 'Asia/Karachi',        labelKey: 'patient_portal.timezones.asia_karachi' },
    { value: 'Asia/Kolkata',        labelKey: 'patient_portal.timezones.asia_kolkata' },
    { value: 'Asia/Dhaka',          labelKey: 'patient_portal.timezones.asia_dhaka' },
    { value: 'Asia/Dubai',          labelKey: 'patient_portal.timezones.asia_dubai' },
    { value: 'Asia/Riyadh',         labelKey: 'patient_portal.timezones.asia_riyadh' },
    { value: 'Asia/Baghdad',        labelKey: 'patient_portal.timezones.asia_baghdad' },
    { value: 'Asia/Istanbul',       labelKey: 'patient_portal.timezones.asia_istanbul' },
    { value: 'Europe/London',       labelKey: 'patient_portal.timezones.europe_london' },
    { value: 'Europe/Paris',        labelKey: 'patient_portal.timezones.europe_paris' },
    { value: 'Europe/Berlin',       labelKey: 'patient_portal.timezones.europe_berlin' },
    { value: 'Africa/Cairo',        labelKey: 'patient_portal.timezones.africa_cairo' },
    { value: 'Africa/Lagos',        labelKey: 'patient_portal.timezones.africa_lagos' },
    { value: 'Africa/Nairobi',      labelKey: 'patient_portal.timezones.africa_nairobi' },
    { value: 'America/New_York',    labelKey: 'patient_portal.timezones.america_new_york' },
    { value: 'America/Chicago',     labelKey: 'patient_portal.timezones.america_chicago' },
    { value: 'America/Los_Angeles', labelKey: 'patient_portal.timezones.america_los_angeles' },
    { value: 'Australia/Sydney',    labelKey: 'patient_portal.timezones.australia_sydney' },
] as const;

export const SLOT_DURATIONS = [10, 15, 20, 30] as const;

// Currency choices — mirrors Doctor.CURRENCY_CHOICES in apps/accounts/models.py.
export const CURRENCIES = [
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'GBP', label: 'British Pound (£)' },
    { value: 'CAD', label: 'Canadian Dollar (C$)' },
    { value: 'AUD', label: 'Australian Dollar (A$)' },
    { value: 'AED', label: 'UAE Dirham (د.إ)' },
    { value: 'SAR', label: 'Saudi Riyal (﷼)' },
    { value: 'PKR', label: 'Pakistani Rupee (₨)' },
    { value: 'INR', label: 'Indian Rupee (₹)' },
    { value: 'BDT', label: 'Bangladeshi Taka (৳)' },
    { value: 'NGN', label: 'Nigerian Naira (₦)' },
    { value: 'KES', label: 'Kenyan Shilling (KSh)' },
    { value: 'EGP', label: 'Egyptian Pound (E£)' },
    { value: 'TRY', label: 'Turkish Lira (₺)' },
] as const;

export interface DayOff {
    id: number;
    date: string;
    reason: string;
}
