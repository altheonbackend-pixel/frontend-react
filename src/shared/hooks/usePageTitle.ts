import { useEffect } from 'react';

/**
 * Sets the browser tab title for a given page.
 * Appends " — Altheon Connect" as a consistent suffix.
 * Resets to the plain app name on unmount.
 */
export function usePageTitle(title: string) {
    useEffect(() => {
        document.title = title ? `${title} — Altheon Connect` : 'Altheon Connect';
        return () => {
            document.title = 'Altheon Connect';
        };
    }, [title]);
}
