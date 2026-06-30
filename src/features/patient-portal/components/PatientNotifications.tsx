import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast, parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import { usePatientPortal } from '../context/PatientPortalContext';
import { formatPortalRelativeTime } from '../utils/i18n';

export default function PatientNotifications() {
    const { t, i18n } = useTranslation();
    usePageTitle(t('patient_portal.notifications.document_title'));
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { unreadCount, invalidateUnreadCount } = usePatientPortal();
    const activeLanguage = i18n.resolvedLanguage || i18n.language;

    const { data: notifications = [], isLoading, isError } = useQuery({
        queryKey: [...queryKeys.patientPortal.notifications(), activeLanguage],
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
        onError: (err) => toast.error(parseApiError(err, t('patient_portal.notifications.error.mark_read'))),
    });

    const { mutate: markAllRead, isPending: isMarkingAll } = useMutation({
        mutationFn: patientPortalService.markAllNotificationsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.notifications() });
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.dashboard() });
            invalidateUnreadCount();
            toast.success(t('patient_portal.notifications.toast.all_read'));
        },
        onError: (err) => toast.error(parseApiError(err, t('patient_portal.notifications.error.mark_all_read'))),
    });

    return (
        <>
            <PageHeader
                title={t('patient_portal.notifications.title')}
                subtitle={t('patient_portal.notifications.subtitle', { count: unreadCount })}
                actions={unreadCount > 0 ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => markAllRead()} disabled={isMarkingAll}>
                        {t('patient_portal.notifications.mark_all_read')}
                    </button>
                ) : undefined}
            />

            {isLoading && <SectionCard title=""><TabSkeleton rows={4} /></SectionCard>}
            {isError && <div className="error-message" style={{ margin: '0 0 1rem' }}>{t('patient_portal.notifications.error.load')}</div>}

            {!isLoading && !isError && (
                <SectionCard title={t('patient_portal.notifications.recent_updates')} empty={{ title: t('patient_portal.notifications.empty_title'), subtitle: t('patient_portal.notifications.empty_subtitle') }}>
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
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatPortalRelativeTime(item.created_at, activeLanguage)}</div>
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
