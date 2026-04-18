import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { usePatientPortal } from '../context/PatientPortalContext';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export default function PatientLabs() {
    const { labs } = usePatientPortal();
    usePageTitle('Patient Labs');

    return (
        <>
            <PageHeader
                title="Lab results"
                subtitle="A simple patient view of released lab results, reference ranges, and doctor notes."
            />

            <div style={{ display: 'grid', gap: '1rem' }}>
                {labs.map(lab => (
                    <SectionCard key={lab.id}>
                        <div style={{ display: 'grid', gap: '0.8rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{lab.test_name}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatDate(lab.test_date)}</div>
                                </div>
                                <StatusBadge status={lab.status} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                                <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Result</div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{lab.result_value}{lab.unit ? ` ${lab.unit}` : ''}</div>
                                </div>
                                <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Reference range</div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{lab.reference_range}</div>
                                </div>
                            </div>

                            <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: lab.status === 'abnormal' ? 'var(--color-warning-light)' : 'var(--color-info-light)' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Patient note</div>
                                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{lab.patient_note}</div>
                            </div>
                        </div>
                    </SectionCard>
                ))}
            </div>
        </>
    );
}
