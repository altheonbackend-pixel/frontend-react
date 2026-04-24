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

    return (
        <>
            {!asTab && (
                <PageHeader
                    title="My Referrals"
                    subtitle="Specialist referrals arranged by your care team."
                />
            )}

            <SectionCard
                title={`Referrals (${referrals.length})`}
                empty={{ title: 'No referrals on record', subtitle: 'Specialist referrals will appear here when your doctor arranges one.' }}
            >
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {referrals.map(item => (
                        <div key={item.id} style={{ padding: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-base)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                                        {item.specialty_requested.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                        {item.referred_by && `From ${item.referred_by}`}
                                        {item.referred_to && ` → ${item.referred_to}`}
                                        {item.is_external && ' (External)'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <StatusBadge status={item.status} />
                                    <StatusBadge status={item.urgency} />
                                </div>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                {item.reason_for_referral}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{formatDate(item.date_of_referral)}</div>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </>
    );
}
