// src/features/referrals/components/ReferralEventTimeline.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/queryKeys';
import { getEvents } from '../services/referralService';
import { type ReferralEvent } from '../../../shared/types';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';

interface Props {
    referralId: number;
}

const STATUS_COLOR: Record<string, string> = {
    draft:       'var(--text-muted)',
    pending:     '#3b82f6',
    accepted:    '#10b981',
    in_progress: '#8b5cf6',
    completed:   '#059669',
    rejected:    '#ef4444',
    cancelled:   '#6b7280',
    returned:    '#f59e0b',
    recalled:    '#f97316',
    expired:     '#dc2626',
};

const dot = (status: string) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: STATUS_COLOR[status] ?? 'var(--text-muted)',
    flexShrink: 0,
    marginTop: 3,
});

const ReferralEventTimeline = ({ referralId }: Props) => {
    const [open, setOpen] = useState(false);
    const { formatDateTime } = useFormatDateTime();

    const { data: events = [], isLoading, isError } = useQuery<ReferralEvent[]>({
        queryKey: queryKeys.referrals.events(referralId),
        queryFn: async () => {
            const res = await getEvents(referralId);
            return (res.data.results ?? res.data) as ReferralEvent[];
        },
        enabled: open,
        staleTime: 60_000,
    });

    return (
        <div style={{ marginTop: '0.5rem' }}>
            <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                onClick={() => setOpen(o => !o)}
            >
                {open ? '▾ Hide Audit Timeline' : '▸ View Audit Timeline'}
            </button>

            {open && (
                <div style={{ marginTop: '0.5rem', paddingLeft: '0.25rem' }}>
                    {isLoading && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</div>}
                    {isError && <div style={{ fontSize: '0.875rem', color: 'var(--color-danger)' }}>Failed to load events.</div>}

                    {!isLoading && !isError && events.length === 0 && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No events recorded.</div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {events.map((ev, idx) => (
                            <div key={ev.id} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
                                {/* Connector line */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 10 }}>
                                    <div style={dot(ev.to_status)} />
                                    {idx < events.length - 1 && (
                                        <div style={{ width: 2, flex: 1, background: 'var(--border-subtle)', minHeight: 20 }} />
                                    )}
                                </div>

                                <div style={{ paddingBottom: idx < events.length - 1 ? '0.625rem' : 0, flex: 1 }}>
                                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {ev.from_status ? (
                                            <>
                                                <span style={{ color: STATUS_COLOR[ev.from_status] ?? 'var(--text-muted)' }}>{ev.from_status}</span>
                                                {' → '}
                                                <span style={{ color: STATUS_COLOR[ev.to_status] ?? 'var(--text-muted)' }}>{ev.to_status}</span>
                                            </>
                                        ) : (
                                            <span style={{ color: STATUS_COLOR[ev.to_status] ?? 'var(--text-muted)' }}>Created as {ev.to_status}</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                        {ev.actor_label} · {formatDateTime(ev.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReferralEventTimeline;
