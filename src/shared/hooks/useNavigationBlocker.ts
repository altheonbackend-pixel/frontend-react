import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Blocks in-app navigation (sidebar links, back button) when the form has
 * unsaved changes. Also blocks browser unload (tab close / refresh).
 *
 * @param isDirty  - true when the form has unsaved changes
 * @param message  - confirmation message shown in the dialog
 */
export function useNavigationBlocker(
    isDirty: boolean,
    message = 'You have unsaved changes. Leave anyway?',
) {
    const blocker = useBlocker(isDirty);

    useEffect(() => {
        if (blocker.state === 'blocked') {
            if (window.confirm(message)) {
                blocker.proceed();
            } else {
                blocker.reset();
            }
        }
    }, [blocker, message]);

    // Also block browser-level unload (tab close / refresh / hard navigation)
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);
}
