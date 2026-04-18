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

export default function PatientMedications() {
    const { medications } = usePatientPortal();
    usePageTitle('Patient Medications');

    const active = medications.filter(item => item.is_active);
    const history = medications.filter(item => !item.is_active);

    return (
        <>
            <PageHeader
                title="Medications"
                subtitle="Review your active medicines, instructions, and previous prescription history."
            />

            <SectionCard title="Active medications">
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {active.map(item => (
                        <div key={item.id} style={{ padding: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-base)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.medication_name}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.dosage} · {item.frequency}</div>
                                </div>
                                <StatusBadge status="active" />
                            </div>
                            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>{item.instructions}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                <span>Prescribed by {item.doctor_name}</span>
                                <span>{formatDate(item.prescribed_at)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <div style={{ height: '1rem' }} />

            <SectionCard title="Medication history">
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {history.map(item => (
                        <div key={item.id} style={{ padding: '0.95rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.medication_name}</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{item.dosage} · {item.frequency}</div>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(item.prescribed_at)}</div>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </>
    );
}
