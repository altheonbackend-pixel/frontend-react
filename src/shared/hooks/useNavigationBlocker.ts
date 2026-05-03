import { useEffect } from 'react';

/**
 * Warns the user before closing or refreshing the tab when the form has
 * unsaved changes. Works with both BrowserRouter and createBrowserRouter.
 */
export function useNavigationBlocker(
    isDirty: boolean,
    _message = 'You have unsaved changes. Leave anyway?',
) {
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);
}
