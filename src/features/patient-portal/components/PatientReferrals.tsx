import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import { enumLabel, formatPortalDate } from '../utils/i18n';

const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'in_progress', 'returned']);

export default function PatientReferrals({ asTab = false }: { asTab?: boolean }) {
    const { t, i18n } = useTranslation();
    usePageTitle(t('patient_portal.referrals.document_title'));

    const { data: referrals = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.referrals(),
        queryFn: patientPortalService.getReferrals,
        staleTime: 5 * 60_000,
    });

    if (isLoading) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.referrals.title')} subtitle="" />}
                <SectionCard title={t('patient_portal.common.loading')}><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.referrals.title')} subtitle="" />}
                <div className="error-message" style={{ margin: '1rem' }}>{t('patient_portal.referrals.error.load')}</div>
            </>
        );
    }

    const active   = referrals.filter(r => ACTIVE_STATUSES.has(r.status));
    const inactive = referrals.filter(r => !ACTIVE_STATUSES.has(r.status));

    const ReferralCard = ({ item }: { item: typeof referrals[0] }) => {
        const specialtyLabel = item.specialty_display
            ?? item.specialty_requested.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        const doctorLine = item.is_external
            ? `${item.external_doctor_name ?? t('patient_portal.referrals.external_doctor')} · ${item.external_hospital ?? ''}`.trim()
            : [
                item.referred_by_name && t('patient_portal.referrals.from_doctor', { name: item.referred_by_name }),
                item.referred_to_name && t('patient_portal.referrals.to_doctor', { name: item.referred_to_name }),
              ].filter(Boolean).join(' ');

        return (
            <div style={{ padding: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-base)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {specialtyLabel}
                            {item.referral_type_display && (
                                <span style={{ fontWeight: 400, fontSize: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.1rem 0.4rem' }}>
                                    {item.referral_type_display}
                                </span>
                            )}
                        </div>
                        {doctorLine && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.15rem' }}>
                                {doctorLine}{item.is_external ? ` ${t('patient_portal.referrals.external_parenthetical')}` : ''}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <StatusBadge status={item.status} label={enumLabel(t, 'common.status', item.status, item.status_display)} />
                        <StatusBadge status={item.urgency} label={enumLabel(t, 'common.status', item.urgency, item.urgency_display)} />
                    </div>
                </div>

                {/* Patient summary (doctor-written) */}
                {item.patient_summary ? (
                    <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius)', padding: '0.6rem 0.8rem', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {item.patient_summary}
                    </div>
                ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        {item.reason_for_referral}
                    </div>
                )}

                {/* SLA hint for urgent/emergency */}
                {item.sla_due_at && ACTIVE_STATUSES.has(item.status) && item.urgency !== 'routine' && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        {t('patient_portal.referrals.response_expected_by', { date: formatPortalDate(item.sla_due_at, i18n.resolvedLanguage) })}
                    </div>
                )}

                {/* Specialist result */}
                {item.result && (
                    <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius)', padding: '0.6rem 0.8rem', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                            {t('patient_portal.referrals.specialist_findings')}
                            {item.result_submitted_at && <span style={{ fontWeight: 400, marginLeft: 6 }}>· {formatPortalDate(item.result_submitted_at, i18n.resolvedLanguage)}</span>}
                        </div>
                        <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{item.result}</div>
                    </div>
                )}

                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.5rem' }}>{t('patient_portal.referrals.referred_date', { date: formatPortalDate(item.date_of_referral, i18n.resolvedLanguage) })}</div>
            </div>
        );
    };

    return (
        <>
            {!asTab && (
                <PageHeader
                    title={t('patient_portal.referrals.title')}
                    subtitle={t('patient_portal.referrals.subtitle')}
                />
            )}

            {active.length > 0 && (
                <SectionCard title={t('patient_portal.referrals.active_title', { count: active.length })}>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {active.map(item => <ReferralCard key={item.id} item={item} />)}
                    </div>
                </SectionCard>
            )}

            <SectionCard
                title={inactive.length > 0 ? t('patient_portal.referrals.past_title', { count: inactive.length }) : t('patient_portal.referrals.card_title', { count: referrals.length })}
                empty={{ title: t('patient_portal.referrals.empty_title'), subtitle: t('patient_portal.referrals.empty_subtitle') }}
            >
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {inactive.map(item => <ReferralCard key={item.id} item={item} />)}
                </div>
            </SectionCard>
        </>
    );
}
