import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

const REACTION_TYPE_LABELS: Record<string, string> = {
    drug: 'Drug',
    food: 'Food',
    environmental: 'Environmental',
    other: 'Other',
};

export default function PatientAllergies() {
    usePageTitle('My Allergies');

    const { data: allergies = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.allergies(),
        queryFn: patientPortalService.getAllergies,
        staleTime: 5 * 60_000,
    });

    if (isLoading) {
        return (
            <>
                <PageHeader title="My Allergies" subtitle="" />
                <SectionCard title="Loading…"><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                <PageHeader title="My Allergies" subtitle="" />
                <div className="error-message" style={{ margin: '1rem' }}>Failed to load allergies. Please refresh.</div>
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="My Allergies"
                subtitle="Known allergies on record with your care team."
            />

            <SectionCard
                title={`Allergies (${allergies.length})`}
                empty={{ title: 'No allergies on record', subtitle: 'Allergy information shared by your doctor will appear here.' }}
            >
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {allergies.map(item => (
                        <div key={item.id} style={{ padding: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-base)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.allergen}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                        {REACTION_TYPE_LABELS[item.reaction_type] ?? item.reaction_type}
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
