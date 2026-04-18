import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { usePatientPortal } from '../context/PatientPortalContext';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export default function PatientVisits() {
    const { visits } = usePatientPortal();
    usePageTitle('Patient Visits');

    return (
        <>
            <PageHeader
                title="Visit summaries"
                subtitle="A patient-friendly timeline of visible consultations and follow-up plans."
            />

            <div style={{ display: 'grid', gap: '1rem' }}>
                {visits.map(visit => (
                    <SectionCard key={visit.id} title={visit.reason_for_consultation}>
                        <div style={{ display: 'grid', gap: '0.85rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                <span>{formatDate(visit.consultation_date)}</span>
                                <span>{visit.doctor_name}</span>
                                <span>{visit.consultation_type === 'telemedicine' ? 'Telemedicine' : 'In person'}</span>
                            </div>

                            <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Diagnosis summary</div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{visit.diagnosis_summary}</div>
                            </div>

                            <div>
                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>What your doctor shared with you</div>
                                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{visit.patient_summary}</div>
                            </div>

                            {visit.follow_up_date && (
                                <div style={{ padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-lighter)', color: 'var(--text-primary)', fontWeight: 600 }}>
                                    Follow-up suggested on {formatDate(visit.follow_up_date)}
                                </div>
                            )}
                        </div>
                    </SectionCard>
                ))}
            </div>
        </>
    );
}
