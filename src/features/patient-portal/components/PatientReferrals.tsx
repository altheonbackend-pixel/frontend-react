import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ACTIVE_STATUSES = new Set(['pending', 'accepted', 'in_progress', 'returned']);

export default function PatientReferrals({ asTab = false }: { asTab?: boolean }) {
    usePageTitle('My Referrals');

    const { data: referrals = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.referrals(),
        queryFn: patientPortalService.getReferrals,
        staleTime: 5 * 60_000,
    });

    if (isLoading) {
        return (
            <>
                {!asTab && <PageHeader title="My Referrals" subtitle="" />}
                <SectionCard title="Loading…"><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                {!asTab && <PageHeader title="My Referrals" subtitle="" />}
                <div className="error-message" style={{ margin: '1rem' }}>Failed to load referrals. Please refresh.</div>
            </>
        );
    }

    const active   = referrals.filter(r => ACTIVE_STATUSES.has(r.status));
    const inactive = referrals.filter(r => !ACTIVE_STATUSES.has(r.status));

    const ReferralCard = ({ item }: { item: typeof referrals[0] }) => {
        const specialtyLabel = item.specialty_display
            ?? item.specialty_requested.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        const doctorLine = item.is_external
            ? `${item.external_doctor_name ?? 'External doctor'} · ${item.external_hospital ?? ''}`.trim()
            : [
                item.referred_by_name && `From Dr. ${item.referred_by_name}`,
                item.referred_to_name && `→ Dr. ${item.referred_to_name}`,
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
                                {doctorLine}{item.is_external ? ' (External)' : ''}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <StatusBadge status={item.status} label={item.status_display} />
                        <StatusBadge status={item.urgency} label={item.urgency_display} />
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
                        Response expected by {formatDate(item.sla_due_at)}
                    </div>
                )}

                {/* Specialist result */}
                {item.result && (
                    <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius)', padding: '0.6rem 0.8rem', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                            Specialist's Findings
                            {item.result_submitted_at && <span style={{ fontWeight: 400, marginLeft: 6 }}>· {formatDate(item.result_submitted_at)}</span>}
                        </div>
                        <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{item.result}</div>
                    </div>
                )}

                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.5rem' }}>Referred {formatDate(item.date_of_referral)}</div>
            </div>
        );
    };

    return (
        <>
            {!asTab && (
                <PageHeader
                    title="My Referrals"
                    subtitle="Specialist referrals arranged by your care team."
                />
            )}

            {active.length > 0 && (
                <SectionCard title={`Active (${active.length})`}>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {active.map(item => <ReferralCard key={item.id} item={item} />)}
                    </div>
                </SectionCard>
            )}

            <SectionCard
                title={inactive.length > 0 ? `Past Referrals (${inactive.length})` : `Referrals (${referrals.length})`}
                empty={{ title: 'No referrals on record', subtitle: 'Specialist referrals will appear here when your doctor arranges one.' }}
            >
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {inactive.map(item => <ReferralCard key={item.id} item={item} />)}
                </div>
            </SectionCard>
        </>
    );
}
