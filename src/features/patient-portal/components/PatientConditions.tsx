import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import { enumLabel, formatPortalDate } from '../utils/i18n';

const SEVERITY_COLORS: Record<string, string> = {
    mild: 'var(--color-warning)',
    moderate: 'var(--color-warning-dark, #b45309)',
    severe: 'var(--color-danger)',
    life_threatening: 'var(--color-danger)',
};

export default function PatientConditions({ asTab = false }: { asTab?: boolean }) {
    const { t, i18n } = useTranslation();
    usePageTitle(t('patient_portal.conditions.document_title'));

    const { data: conditions = [], isLoading: condLoading, isError: condError } = useQuery({
        queryKey: queryKeys.patientPortal.conditions(),
        queryFn: patientPortalService.getConditions,
        staleTime: 5 * 60_000,
    });

    const { data: allergies = [], isLoading: allergyLoading, isError: allergyError } = useQuery({
        queryKey: queryKeys.patientPortal.allergies(),
        queryFn: patientPortalService.getAllergies,
        staleTime: 5 * 60_000,
    });

    const isLoading = condLoading || allergyLoading;
    const isError = condError || allergyError;

    if (isLoading) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.conditions.title')} subtitle="" />}
                <SectionCard title={t('patient_portal.common.loading')}><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.conditions.title')} subtitle="" />}
                <div className="error-message" style={{ margin: '1rem' }}>{t('patient_portal.conditions.error.load')}</div>
            </>
        );
    }

    return (
        <>
            {!asTab && (
                <PageHeader
                    title={t('patient_portal.conditions.title')}
                    subtitle={t('patient_portal.conditions.subtitle')}
                />
            )}

            <SectionCard
                title={t('patient_portal.conditions.card_title', { count: conditions.length })}
                empty={{ title: t('patient_portal.conditions.empty_title'), subtitle: t('patient_portal.conditions.empty_subtitle') }}
            >
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {conditions.map(item => (
                        <div key={item.id} style={{ padding: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-base)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                                        {item.patient_friendly_name || item.name}
                                    </div>
                                    {item.onset_date && (
	                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{t('patient_portal.conditions.since', { date: formatPortalDate(item.onset_date, i18n.resolvedLanguage) })}</div>
                                    )}
                                </div>
                                <StatusBadge status={item.status} />
                            </div>
                            {item.notes && (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{item.notes}</div>
                            )}
                        </div>
                    ))}
                </div>
            </SectionCard>

            <SectionCard
                title={t('patient_portal.allergies.card_title', { count: allergies.length })}
                empty={{ title: t('patient_portal.allergies.empty_title'), subtitle: t('patient_portal.allergies.empty_subtitle') }}
            >
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {allergies.map((item: { id: number; allergen: string; reaction_type: string; severity: string; notes?: string }) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.875rem 1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-base)' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                                    {item.allergen}
                                </div>
                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {enumLabel(t, 'patient_portal.reaction_type', item.reaction_type)}
                                    {item.notes ? ` · ${item.notes}` : ''}
                                </div>
                            </div>
                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                padding: '2px 10px',
                                borderRadius: '999px',
                                background: `color-mix(in srgb, ${SEVERITY_COLORS[item.severity] ?? 'var(--text-muted)'} 12%, transparent)`,
                                color: SEVERITY_COLORS[item.severity] ?? 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                marginLeft: '12px',
                            }}>
                                {enumLabel(t, 'patient_portal.severity', item.severity)}
                            </span>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </>
    );
}
