import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

export default function PatientMedications() {
    usePageTitle('Patient Medications');

    const { data: prescriptions = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.prescriptions(),
        queryFn: patientPortalService.getPrescriptions,
        staleTime: 2 * 60_000,
    });

    const active = prescriptions.filter(p => p.is_active);
    const history = prescriptions.filter(p => !p.is_active);

    if (isLoading) {
        return (
            <>
                <PageHeader title="Medications" subtitle="" />
                <SectionCard title="Loading…"><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                <PageHeader title="Medications" subtitle="" />
                <div className="error-message" style={{ margin: '1rem' }}>Failed to load medications. Please refresh.</div>
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Medications"
                subtitle="Review your active medicines, instructions, and previous prescription history."
            />

            <SectionCard title={`Active medications (${active.length})`} empty={{ title: 'No active medications', subtitle: 'Active prescriptions shared by your doctor will appear here.' }}>
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {active.map(item => (
                        <div key={item.id} style={{ padding: '1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-base)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.medication_name}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.dosage} · {item.frequency_display}</div>
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
                                <span>Prescribed by {item.doctor_name}</span>
                                <span>{formatDate(item.prescribed_at)}</span>
                                {item.end_date && <span>Until {formatDate(item.end_date)}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {history.length > 0 && (
                <>
                    <div style={{ height: '1rem' }} />
                    <SectionCard title="Medication history">
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {history.map(item => (
                                <div key={item.id} style={{ padding: '0.95rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.medication_name}</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{item.dosage} · {item.frequency_display}</div>
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(item.prescribed_at)}</div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </>
            )}
        </>
    );
}
