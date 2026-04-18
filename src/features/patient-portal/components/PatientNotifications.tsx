import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { usePatientPortal } from '../context/PatientPortalContext';

function timeAgo(value: string) {
    const diff = Date.now() - new Date(value).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function PatientNotifications() {
    const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = usePatientPortal();
    const navigate = useNavigate();
    usePageTitle('Patient Notifications');

    return (
        <>
            <PageHeader
                title="Notifications"
                subtitle={`${unreadCount} unread update${unreadCount === 1 ? '' : 's'} in your patient portal.`}
                actions={unreadCount > 0 ? <button className="btn btn-secondary btn-sm" onClick={markAllNotificationsRead}>Mark all read</button> : undefined}
            />

            <SectionCard title="Recent updates">
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {notifications.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                                markNotificationRead(item.id);
                                if (item.link) navigate(item.link);
                            }}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '1rem',
                                borderRadius: 'var(--radius-lg)',
                                border: `1px solid ${item.is_read ? 'var(--border-subtle)' : 'var(--accent-light)'}`,
                                background: item.is_read ? 'var(--bg-base)' : 'var(--accent-lighter)',
                                display: 'grid',
                                gap: '0.35rem',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(item.created_at)}</div>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.body}</div>
                        </button>
                    ))}
                </div>
            </SectionCard>
        </>
    );
}
