import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast, parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
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
    usePageTitle('Patient Notifications');
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { unreadCount, invalidateUnreadCount } = usePatientPortal();

    const { data: notifications = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.notifications(),
        queryFn: patientPortalService.getNotifications,
        staleTime: 30_000,
    });

    const { mutate: markRead } = useMutation({
        mutationFn: patientPortalService.markNotificationRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.notifications() });
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.dashboard() });
            invalidateUnreadCount();
        },
        onError: (err) => toast.error(parseApiError(err, 'Failed to mark notification as read.')),
    });

    const { mutate: markAllRead, isPending: isMarkingAll } = useMutation({
        mutationFn: patientPortalService.markAllNotificationsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.notifications() });
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.dashboard() });
            invalidateUnreadCount();
            toast.success('All notifications marked as read.');
        },
        onError: (err) => toast.error(parseApiError(err, 'Failed to mark all as read.')),
    });

    return (
        <>
            <PageHeader
                title="Notifications"
                subtitle={`${unreadCount} unread update${unreadCount === 1 ? '' : 's'} in your patient portal.`}
                actions={unreadCount > 0 ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => markAllRead()} disabled={isMarkingAll}>
                        Mark all read
                    </button>
                ) : undefined}
            />

            {isLoading && <SectionCard title=""><TabSkeleton rows={4} /></SectionCard>}
            {isError && <div className="error-message" style={{ margin: '0 0 1rem' }}>Failed to load notifications. Please refresh.</div>}

            {!isLoading && !isError && (
                <SectionCard title="Recent updates" empty={{ title: 'No notifications yet', subtitle: 'Updates from your care team will appear here.' }}>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {notifications.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    if (!item.is_read) markRead(item.id);
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
                                    cursor: item.link ? 'pointer' : 'default',
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
            )}
        </>
    );
}
