import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import { enumLabel, formatPortalDate } from '../utils/i18n';

export default function PatientMedications({ asTab = false }: { asTab?: boolean }) {
    const { t, i18n } = useTranslation();
    usePageTitle(t('patient_portal.medications.document_title'));

    const { data: prescriptions = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.prescriptions(),
        queryFn: patientPortalService.getPrescriptions,
        staleTime: 2 * 60_000,
    });

    const active = prescriptions.filter(p => p.is_active);
    const history = prescriptions.filter(p => !p.is_active);
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const HISTORY_PREVIEW = 3;
    const visibleHistory = historyExpanded ? history : history.slice(0, HISTORY_PREVIEW);

    if (isLoading) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.medications.title')} subtitle="" />}
                <SectionCard title={t('patient_portal.common.loading')}><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.medications.title')} subtitle="" />}
                <div className="error-message" style={{ margin: '1rem' }}>{t('patient_portal.medications.error.load')}</div>
            </>
        );
    }

    return (
        <>
            {!asTab && (
                <PageHeader
                    title={t('patient_portal.medications.title')}
                    subtitle={t('patient_portal.medications.subtitle')}
                />
            )}

            <SectionCard title={t('patient_portal.medications.active_title', { count: active.length })} empty={{ title: t('patient_portal.medications.empty_active_title'), subtitle: t('patient_portal.medications.empty_active_subtitle') }}>
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {active.map(item => (
                        <div key={item.id} style={{ padding: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-base)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.medication_name}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.dosage} · {enumLabel(t, 'patient_portal.frequency', item.frequency, item.frequency_display)}</div>
                                </div>
                                <StatusBadge status="active" />
                            </div>
                            {item.instructions && (
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>{item.instructions}</div>
                            )}
                            {item.patient_medication_note && (
                                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-lighter)', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.65rem' }}>
                                    {item.patient_medication_note}
                                </div>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                <span>{t('patient_portal.medications.prescribed_by', { name: item.doctor_name })}</span>
                                <span>{formatPortalDate(item.prescribed_at, i18n.resolvedLanguage)}</span>
                                {item.end_date && <span>{t('patient_portal.medications.until', { date: formatPortalDate(item.end_date, i18n.resolvedLanguage) })}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {history.length > 0 && (
                <>
                    <div style={{ height: '1rem' }} />
                    <SectionCard title={t('patient_portal.medications.history_title', { count: history.length })}>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {visibleHistory.map(item => (
                                <div key={item.id} style={{ padding: '0.95rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.medication_name}</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{item.dosage} · {enumLabel(t, 'patient_portal.frequency', item.frequency, item.frequency_display)}</div>
                                    </div>
	                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatPortalDate(item.prescribed_at, i18n.resolvedLanguage)}</div>
                                </div>
                            ))}
                        </div>
                        {history.length > HISTORY_PREVIEW && (
                            <button
                                onClick={() => setHistoryExpanded(e => !e)}
                                style={{
                                    marginTop: '0.875rem',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--accent)',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    padding: 0,
                                    fontWeight: 600,
                                }}
                            >
                                {historyExpanded
                                    ? t('patient_portal.common.show_fewer')
                                    : t('patient_portal.medications.show_all', { count: history.length })}
                            </button>
                        )}
                    </SectionCard>
                </>
            )}
        </>
    );
}
