// src/features/auth/hooks/useGeoLanguageDetect.ts
// Auto-pick French on first visit for francophone regions.
//
// Strategy (cheapest-first; we never make a second guess):
//   1. If the user already has a saved preference (i18next localStorage key or
//      manual `?lng=` choice), do nothing — the user's choice always wins.
//   2. Look at `navigator.language` / `navigator.languages`. This covers most
//      cases without any network call (a French user's browser is usually `fr-*`).
//   3. Fall back to IP-based geolocation via the free ipapi.co endpoint and
//      map francophone countries → 'fr'.
//
// Runs at most once per browser, gated by a `geo_lang_seen` localStorage flag
// so a return visitor never re-triggers the detection (no surprise re-switch
// after they've manually picked English).

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const SEEN_KEY = 'altheon_geo_lang_seen';
const I18N_LNG_KEY = 'i18nextLng'; // default key for i18next-browser-languagedetector

/**
 * Countries where French is an official or co-official language, or where a
 * majority of the population speaks French. ISO 3166-1 alpha-2 codes.
 *
 * Source: OIF list of full-member French-speaking states & territories, trimmed
 * to those where French is actually a primary working language (excludes
 * observer states like Bulgaria or Greece).
 */
const FRANCOPHONE_COUNTRIES = new Set([
    'FR', // France
    'BE', // Belgium
    'CH', // Switzerland
    'LU', // Luxembourg
    'MC', // Monaco
    'CA', // Canada (partial, but FR is co-official)
    // French overseas departments / collectivities
    'GF', 'GP', 'MQ', 'RE', 'YT', 'PM', 'BL', 'MF', 'WF', 'PF', 'NC',
    // African francophone
    'SN', // Senegal
    'CI', // Côte d'Ivoire
    'CM', // Cameroon
    'MA', // Morocco
    'TN', // Tunisia
    'DZ', // Algeria
    'ML', // Mali
    'BF', // Burkina Faso
    'NE', // Niger
    'TG', // Togo
    'BJ', // Benin
    'MG', // Madagascar
    'RW', // Rwanda
    'BI', // Burundi
    'CD', // DR Congo
    'CG', // Congo-Brazzaville
    'GA', // Gabon
    'GN', // Guinea
    'GQ', // Equatorial Guinea
    'KM', // Comoros
    'DJ', // Djibouti
    'MR', // Mauritania
    'CF', // Central African Republic
    'TD', // Chad
    // Caribbean / Pacific
    'HT', // Haiti
    'VU', // Vanuatu
    'SC', // Seychelles
]);

function browserPrefersFrench(): boolean {
    if (typeof navigator === 'undefined') return false;
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of langs) {
        if (!tag) continue;
        if (tag.toLowerCase().startsWith('fr')) return true;
    }
    return false;
}

async function fetchCountryCode(signal: AbortSignal): Promise<string | null> {
    try {
        // ipapi.co returns plain text country code (e.g. "FR\n") on the /country/ path.
        // No API key needed under their free tier (30k req/month).
        const res = await fetch('https://ipapi.co/country/', { signal });
        if (!res.ok) return null;
        const text = (await res.text()).trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(text)) return text;
        return null;
    } catch {
        return null;
    }
}

export function useGeoLanguageDetect() {
    const { i18n } = useTranslation();

    useEffect(() => {
        // Only run once per browser.
        if (localStorage.getItem(SEEN_KEY)) return;

        // If the user already has any stored preference, don't override it.
        const savedLng = localStorage.getItem(I18N_LNG_KEY);
        if (savedLng && savedLng !== 'undefined' && savedLng !== 'null') {
            localStorage.setItem(SEEN_KEY, '1');
            return;
        }

        // 1. Cheap path: browser-language hint.
        if (browserPrefersFrench()) {
            i18n.changeLanguage('fr');
            localStorage.setItem(SEEN_KEY, '1');
            return;
        }

        // 2. IP-based fallback. Time-box the request so a slow ipapi doesn't
        //    block first-paint; the AbortController is wired to a 2.5s timer.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);

        fetchCountryCode(controller.signal).then(country => {
            clearTimeout(timeout);
            // Mark as seen regardless of result so we never re-probe.
            localStorage.setItem(SEEN_KEY, '1');
            if (country && FRANCOPHONE_COUNTRIES.has(country)) {
                i18n.changeLanguage('fr');
            }
        });

        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
        // Run exactly once on mount — i18n instance is stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}

export default useGeoLanguageDetect;
