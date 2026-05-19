import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../shared/components/SectionCard';
import { usePageTitle } from '../../shared/hooks/usePageTitle';
import { queryKeys } from '../../shared/queryKeys';
import api from '../../shared/services/api';
import { useFormatDateTime } from '../../shared/hooks/useUserTimezone';

interface AuditEntry {
    id: number;
    actor_name: string | null;
    action: string;
    action_display: string;
    target_model: string;
    target_id: string;
    description: string;
    ip_address: string | null;
    timestamp: string;
}

export default function AuditLog() {
    const { t } = useTranslation();
    usePageTitle(t('audit.my_activity.title'));
    const { formatDateTimeLong } = useFormatDateTime();
    const formatTimestamp = (value: string) => formatDateTimeLong(value, { appendTzLabel: true });

    const { data: entries = [], isLoading, isError } = useQuery<AuditEntry[]>({
        queryKey: queryKeys.audit.myActivity(),
        queryFn: () => api.get('/audit/my-activity/').then(r => r.data),
        staleTime: 60_000,
    });

    return (
        <>
            <PageHeader
                title={t('audit.my_activity.title')}
                subtitle={t('audit.my_activity.subtitle')}
            />

            <SectionCard title={t('audit.my_activity.activity_count', { count: entries.length })}>
                {isLoading && <TabSkeleton rows={6} />}
                {isError && (
                    <div className="error-message">{t('audit.my_activity.error.load')}</div>
                )}
                {!isLoading && !isError && entries.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>{t('audit.my_activity.empty')}</div>
                )}
                {!isLoading && !isError && entries.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('audit.my_activity.timestamp')}</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('audit.my_activity.action')}</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('audit.my_activity.target')}</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('audit.my_activity.details')}</th>
                                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('audit.my_activity.ip')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry, i) => (
                                    <tr
                                        key={entry.id}
                                        style={{
                                            borderBottom: '1px solid var(--border-subtle)',
                                            background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-subtle)',
                                        }}
                                    >
                                        <td style={{ padding: '0.625rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                                            {formatTimestamp(entry.timestamp)}
                                        </td>
                                        <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {entry.action_display}
                                        </td>
                                        <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                                            {entry.target_model && (
                                                <span>
                                                    {entry.target_model}
                                                    {entry.target_id && <span style={{ color: 'var(--text-muted)' }}> #{entry.target_id}</span>}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                                            {entry.description || '—'}
                                        </td>
                                        <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {entry.ip_address || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>
        </>
    );
}
