import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

function formatDate(value: string | null) {
    if (!value) return null;
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PatientConditions({ asTab = false }: { asTab?: boolean }) {
    usePageTitle('My Conditions');

    const { data: conditions = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.conditions(),
        queryFn: patientPortalService.getConditions,
        staleTime: 5 * 60_000,
    });

    if (isLoading) {
        return (
            <>
                {!asTab && <PageHeader title="My Conditions" subtitle="" />}
                <SectionCard title="Loading…"><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                {!asTab && <PageHeader title="My Conditions" subtitle="" />}
                <div className="error-message" style={{ margin: '1rem' }}>Failed to load conditions. Please refresh.</div>
            </>
        );
    }

    return (
        <>
            {!asTab && (
                <PageHeader
                    title="My Conditions"
                    subtitle="Medical conditions shared with you by your care team."
                />
            )}

            <SectionCard
                title={`Conditions (${conditions.length})`}
                empty={{ title: 'No conditions on record', subtitle: 'Conditions shared by your doctor will appear here.' }}
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
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Since {formatDate(item.onset_date)}</div>
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
        </>
    );
}
