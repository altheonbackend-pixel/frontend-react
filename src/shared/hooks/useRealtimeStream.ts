// CR-P0-13: Subscribe to the doctor or patient real-time SSE stream.
//
// Usage:
//
//   useRealtimeStream('doctor', (event) => {
//     if (event.type === 'alert') queryClient.invalidateQueries({ queryKey: ['alerts'] });
//   });
//
// The hook:
//   - opens an EventSource at /api/v1/sse/{role}/
//   - reconnects with exponential backoff on disconnect
//   - delivers parsed events to the callback
//   - cleans up on unmount

import { useEffect, useRef } from 'react';

const API_BASE: string = (typeof window !== 'undefined' && (window as { __ALTHEON_API_BASE__?: string }).__ALTHEON_API_BASE__) || '/api/v1';

export interface RealtimeEvent {
    type: string;
    payload: Record<string, unknown>;
}

export function useRealtimeStream(
    role: 'doctor' | 'patient',
    onEvent: (event: RealtimeEvent) => void,
) {
    const sourceRef = useRef<EventSource | null>(null);
    const reconnectDelayRef = useRef(1000);
    const stoppedRef = useRef(false);
    const onEventRef = useRef(onEvent);
    onEventRef.current = onEvent;

    useEffect(() => {
        if (typeof EventSource === 'undefined') return;

        const connect = () => {
            if (stoppedRef.current) return;
            const url = `${API_BASE}/sse/${role}/`;
            const es = new EventSource(url, { withCredentials: true });
            sourceRef.current = es;

            es.addEventListener('open', () => {
                reconnectDelayRef.current = 1000;
            });

            // Generic listener for any custom event type the backend emits.
            const dispatch = (e: MessageEvent, fallbackType: string) => {
                let payload: Record<string, unknown> = {};
                try {
                    payload = e.data ? JSON.parse(e.data) : {};
                } catch {
                    payload = { raw: e.data };
                }
                onEventRef.current({ type: e.type || fallbackType, payload });
            };

            ['hello', 'alert', 'message', 'task', 'referral', 'consultation', 'lab', 'appointment']
                .forEach(eventName => {
                    es.addEventListener(eventName, (e) => dispatch(e as MessageEvent, eventName));
                });

            es.onmessage = (e) => dispatch(e, 'message');

            es.onerror = () => {
                es.close();
                sourceRef.current = null;
                if (stoppedRef.current) return;
                const delay = Math.min(reconnectDelayRef.current, 30_000);
                reconnectDelayRef.current = Math.min(delay * 2, 30_000);
                setTimeout(connect, delay);
            };
        };

        connect();

        return () => {
            stoppedRef.current = true;
            sourceRef.current?.close();
        };
    }, [role]);
}

export default useRealtimeStream;
