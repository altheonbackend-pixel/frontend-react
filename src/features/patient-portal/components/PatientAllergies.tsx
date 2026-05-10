import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import { enumLabel } from '../utils/i18n';

export default function PatientAllergies({ asTab = false }: { asTab?: boolean }) {
    const { t } = useTranslation();
    usePageTitle(t('patient_portal.allergies.document_title'));

    const { data: allergies = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.allergies(),
        queryFn: patientPortalService.getAllergies,
        staleTime: 5 * 60_000,
    });

    if (isLoading) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.allergies.title')} subtitle="" />}
                <SectionCard title={t('patient_portal.common.loading')}><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.allergies.title')} subtitle="" />}
                <div className="error-message" style={{ margin: '1rem' }}>{t('patient_portal.allergies.error.load')}</div>
            </>
        );
    }

    return (
        <>
            {!asTab && (
                <PageHeader
                    title={t('patient_portal.allergies.title')}
                    subtitle={t('patient_portal.allergies.subtitle')}
                />
            )}

            <SectionCard
                title={t('patient_portal.allergies.card_title', { count: allergies.length })}
                empty={{ title: t('patient_portal.allergies.empty_title'), subtitle: t('patient_portal.allergies.empty_subtitle') }}
            >
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {allergies.map(item => (
                        <div key={item.id} style={{ padding: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-base)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.allergen}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                        {enumLabel(t, 'patient_portal.reaction_type', item.reaction_type)}
                                    </div>
                                </div>
                                <StatusBadge status={item.severity} />
                            </div>
                            {item.reaction_description && (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    {item.reaction_description}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </SectionCard>
        </>
    );
}
