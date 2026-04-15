import { useEffect, useRef, useCallback, useState } from 'react';
import api from '../services/api';

const MIN_INTERVAL = 30_000;   // 30 s when there are unread notifications
const MAX_INTERVAL = 120_000;  // 2 min ceiling when inbox is empty

/**
 * Polls the unread notification count with exponential backoff when no new
 * notifications are found, resetting to MIN_INTERVAL as soon as any appear.
 * Automatically pauses when the browser tab is hidden.
 */
export function useNotificationPolling(
    onNewNotifications: (count: number) => void,
) {
    const [pollInterval, setPollInterval] = useState(MIN_INTERVAL);
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const callbackRef = useRef(onNewNotifications);
    callbackRef.current = onNewNotifications;

    const poll = useCallback(async () => {
        if (document.visibilityState !== 'visible') return;
        try {
            const res = await api.get('/notifications/unread-count/');
            const count: number = res.data.count ?? 0;
            callbackRef.current(count);
            // Reset to fast polling when there are notifications; slow down otherwise
            setPollInterval(prev =>
                count > 0 ? MIN_INTERVAL : Math.min(prev * 1.5, MAX_INTERVAL)
            );
        } catch {
            // Silent fail — polling is non-critical; back off on error too
            setPollInterval(prev => Math.min(prev * 1.5, MAX_INTERVAL));
        }
    }, []);

    useEffect(() => {
        poll();
        intervalRef.current = setInterval(poll, pollInterval);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') poll();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [poll, pollInterval]);
}
