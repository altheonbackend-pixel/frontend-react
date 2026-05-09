// src/features/referrals/components/ReferralSLABadge.tsx

import { useState, useEffect } from 'react';

interface Props {
    sla_due_at: string;
    sla_breached: boolean;
    urgency: string;
}

function formatCountdown(ms: number): string {
    if (ms <= 0) return 'Overdue';
    const totalSec = Math.floor(ms / 1000);
    const days  = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins  = Math.floor((totalSec % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
}

const ReferralSLABadge = ({ sla_due_at, sla_breached, urgency }: Props) => {
    const [remaining, setRemaining] = useState(() => new Date(sla_due_at).getTime() - Date.now());

    useEffect(() => {
        if (sla_breached) return;
        const tick = setInterval(() => {
            setRemaining(new Date(sla_due_at).getTime() - Date.now());
        }, 60_000);
        return () => clearInterval(tick);
    }, [sla_due_at, sla_breached]);

    if (sla_breached || remaining <= 0) return null;

    const isWarning = urgency === 'emergency' ? remaining < 30 * 60 * 1000 : remaining < 4 * 3600 * 1000;

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.15rem 0.45rem',
                borderRadius: 'var(--radius-sm)',
                background: isWarning ? 'var(--color-warning-bg, #fffbeb)' : 'var(--bg-subtle)',
                color: isWarning ? 'var(--color-warning, #b45309)' : 'var(--text-muted)',
                border: `1px solid ${isWarning ? 'var(--color-warning, #f59e0b)' : 'var(--border-subtle)'}`,
            }}
        >
            ⏱ {formatCountdown(remaining)}
        </span>
    );
};

export default ReferralSLABadge;
