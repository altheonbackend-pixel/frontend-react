// src/shared/components/StatusBadge.tsx
// Single unified component for every status in the app.

type StatusType =
    | 'active' | 'inactive' | 'transferred' | 'deceased'
    | 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
    | 'no_show' | 'rescheduled' | 'pending'
    | 'routine' | 'urgent' | 'emergency'
    | 'normal' | 'abnormal' | 'critical'
    | 'open' | 'request' | 'invite_only' | 'member';

const LABELS: Record<StatusType, string> = {
    active: 'Active',
    inactive: 'Inactive',
    transferred: 'Transferred',
    deceased: 'Deceased',
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
    rescheduled: 'Rescheduled',
    pending: 'Pending',
    routine: 'Routine',
    urgent: 'Urgent',
    emergency: 'Emergency',
    normal: 'Normal',
    abnormal: 'Abnormal',
    critical: 'Critical',
    open: 'Open',
    request: 'Request',
    invite_only: 'Invite Only',
    member: 'Member',
};

interface StatusBadgeProps {
    status: StatusType | string;
    label?: string;
    size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
    const normalised = status?.toLowerCase().replace(/-/g, '_') as StatusType;
    const displayLabel = label ?? LABELS[normalised] ?? status;
    return (
        <span
            className={`status-badge status-${normalised}`}
            style={size === 'md' ? { fontSize: '0.8rem', padding: '0.25rem 0.75rem' } : undefined}
        >
            {displayLabel}
        </span>
    );
}

export default StatusBadge;
