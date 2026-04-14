// shared/config/features.ts — Feature flags controlled by environment variables.
// Set in .env.local for development, Vercel/Render env vars for staging/production.
// Default: all optional features OFF in production until explicitly enabled.

export const features = {
    // Clinics: enable when you have 50+ active doctors
    // Set VITE_FEATURE_CLINICS=true in Vercel prod env vars to activate
    clinics: import.meta.env.VITE_FEATURE_CLINICS === 'true',

    // Forum: community discussion board between doctors
    forum: import.meta.env.VITE_FEATURE_FORUM === 'true',
} as const;
