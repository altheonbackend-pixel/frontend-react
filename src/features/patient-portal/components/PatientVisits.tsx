import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

export default function PatientVisits() {
    usePageTitle('Patient Visits');

    const { data: visits = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.consultations(),
        queryFn: patientPortalService.getConsultations,
        staleTime: 2 * 60_000,
    });

    return (
        <>
            <PageHeader
                title="Visit summaries"
                subtitle="A patient-friendly timeline of visible consultations and follow-up plans."
            />

            {isLoading && <SectionCard title=""><TabSkeleton rows={4} /></SectionCard>}
            {isError && <div className="error-message" style={{ margin: '0 0 1rem' }}>Failed to load visits. Please refresh.</div>}

            {!isLoading && !isError && visits.length === 0 && (
                <SectionCard empty={{ title: 'No visit summaries yet', subtitle: 'Your doctor will share summaries after consultations.' }}>{null}</SectionCard>
            )}

            <div style={{ display: 'grid', gap: '1rem' }}>
                {visits.map(visit => (
                    <SectionCard key={visit.id} title={visit.reason_for_consultation}>
                        <div style={{ display: 'grid', gap: '0.85rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                <span>{formatDate(visit.consultation_date)}</span>
                                <span>{visit.doctor_name}</span>
                                <span>{visit.consultation_type === 'telemedicine' ? 'Telemedicine' : 'In person'}</span>
                            </div>

                            {visit.diagnosis && (
                                <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Diagnosis</div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{visit.diagnosis}</div>
                                </div>
                            )}

                            {visit.patient_summary && (
                                <div>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>What your doctor shared with you</div>
                                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{visit.patient_summary}</div>
                                </div>
                            )}

                            {visit.patient_instructions && (
                                <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-lighter)' }}>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Instructions</div>
                                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{visit.patient_instructions}</div>
                                </div>
                            )}

                            {visit.follow_up_date && (
                                <div style={{ padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-lighter)', color: 'var(--text-primary)', fontWeight: 600 }}>
                                    Follow-up suggested on {formatDate(visit.follow_up_date)}
                                </div>
                            )}
                            {visit.file_attachments?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Documents</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {visit.file_attachments.map(att => (
                                            <a
                                                key={att.id}
                                                href={att.download_url ?? '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'underline' }}
                                            >
                                                {att.original_filename}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                ))}
            </div>
        </>
    );
}
