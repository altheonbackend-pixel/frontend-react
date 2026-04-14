import { useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * Polls the unread notification count every `intervalMs` milliseconds.
 * Automatically pauses when the browser tab is hidden to conserve bandwidth.
 * Fires immediately on mount.
 *
 * @param onNewNotifications  Callback receiving the current unread count.
 * @param intervalMs          Poll interval in ms (default 30 seconds).
 */
export function useNotificationPolling(
    onNewNotifications: (count: number) => void,
    intervalMs = 30_000,
) {
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const callbackRef = useRef(onNewNotifications);
    callbackRef.current = onNewNotifications;

    const poll = useCallback(async () => {
        if (document.visibilityState !== 'visible') return;
        try {
            const res = await api.get('/notifications/unread-count/');
            callbackRef.current(res.data.count ?? 0);
        } catch {
            // Silent fail — polling is non-critical
        }
    }, []);

    useEffect(() => {
        poll();
        intervalRef.current = setInterval(poll, intervalMs);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') poll();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [poll, intervalMs]);
}
