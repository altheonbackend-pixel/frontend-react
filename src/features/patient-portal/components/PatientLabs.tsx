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

export default function PatientLabs() {
    usePageTitle('Patient Labs');

    const { data: labs = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.labResults(),
        queryFn: patientPortalService.getLabResults,
        staleTime: 2 * 60_000,
    });

    if (isLoading) {
        return (
            <>
                <PageHeader title="Lab results" subtitle="" />
                <SectionCard title="Loading…"><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                <PageHeader title="Lab results" subtitle="" />
                <div className="error-message" style={{ margin: '1rem' }}>Failed to load lab results. Please refresh.</div>
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Lab results"
                subtitle="A simple patient view of released lab results, reference ranges, and doctor notes."
            />

            {labs.length === 0 && (
                <SectionCard empty={{ title: 'No lab results yet', subtitle: 'Lab results shared by your doctor will appear here.' }}>{null}</SectionCard>
            )}

            <div style={{ display: 'grid', gap: '1rem' }}>
                {labs.map(lab => {
                    const resultDisplay = lab.result_value
                        ? `${lab.result_value}${lab.unit ? ` ${lab.unit}` : ''}`
                        : lab.result_value_text ?? '—';

                    return (
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
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{resultDisplay}</div>
                                    </div>
                                    {lab.reference_range && (
                                        <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Reference range</div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{lab.reference_range}</div>
                                        </div>
                                    )}
                                </div>

                                {lab.patient_note && (
                                    <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: lab.status === 'abnormal' || lab.status === 'critical' ? 'var(--color-warning-light)' : 'var(--color-info-light)' }}>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Doctor note</div>
                                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{lab.patient_note}</div>
                                    </div>
                                )}
                                {lab.file_attachments?.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Attachments</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {lab.file_attachments.map(att => (
                                                att.download_url ? (
                                                    <a
                                                        key={att.id}
                                                        href={att.download_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'underline' }}
                                                    >
                                                        {att.original_filename}
                                                    </a>
                                                ) : (
                                                    <span
                                                        key={att.id}
                                                        title="File not available"
                                                        style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'line-through', cursor: 'not-allowed' }}
                                                    >
                                                        {att.original_filename}
                                                    </span>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </SectionCard>
                    );
                })}
            </div>
        </>
    );
}
