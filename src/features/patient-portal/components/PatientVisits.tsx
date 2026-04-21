import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
}

function formatDateShort(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

const FREQ_LABEL: Record<string, string> = {
    once: 'Once',
    once_daily: 'Once daily',
    twice_daily: 'Twice daily',
    three_times_daily: '3× daily',
    four_times_daily: '4× daily',
    as_needed: 'As needed',
    weekly: 'Weekly',
    other: 'Other',
};

export default function PatientVisits() {
    usePageTitle('Patient Visits');
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    const { data: visits = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.consultations(),
        queryFn: patientPortalService.getConsultations,
        staleTime: 2 * 60_000,
    });

    const toggle = (id: number) =>
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    if (isLoading) {
        return (
            <>
                <PageHeader title="Visit summaries" subtitle="" />
                <SectionCard title=""><TabSkeleton rows={5} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                <PageHeader title="Visit summaries" subtitle="" />
                <div className="error-message" style={{ margin: '0 0 1rem' }}>Failed to load visits. Please refresh.</div>
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Visit summaries"
                subtitle="Your doctor's notes and prescriptions from each visit — shared with you for your records."
            />

            {visits.length === 0 && (
                <SectionCard empty={{ title: 'No visit summaries yet', subtitle: 'Your doctor will share summaries after consultations.' }}>{null}</SectionCard>
            )}

            <div style={{ display: 'grid', gap: '1rem' }}>
                {visits.map(visit => {
                    const isOpen = expanded[visit.id] ?? true;
                    const rxList = visit.prescriptions ?? [];

                    return (
                        <div
                            key={visit.id}
                            style={{
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-lg)',
                                background: 'var(--bg-base)',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Card header — always visible */}
                            <button
                                type="button"
                                onClick={() => toggle(visit.id)}
                                style={{
                                    width: '100%',
                                    padding: '1rem 1.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    gap: '1rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    {/* Date as the primary headline */}
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                        {formatDate(visit.consultation_date)}
                                    </div>
                                    {/* Reason as subtitle */}
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        {visit.reason_for_consultation}
                                    </div>
                                    {/* Badges row */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                                        <span style={{
                                            fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.55rem',
                                            borderRadius: '999px', border: '1px solid var(--border-subtle)',
                                            color: 'var(--text-secondary)', background: 'var(--bg-subtle)',
                                        }}>
                                            {visit.consultation_type === 'telemedicine' ? '📹 Telemedicine' : '🏥 In person'}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {visit.doctor_name}
                                        </span>
                                        {rxList.length > 0 && (
                                            <span style={{
                                                fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.55rem',
                                                borderRadius: '999px', background: 'var(--accent-lighter)',
                                                color: 'var(--accent)',
                                            }}>
                                                💊 {rxList.length} medication{rxList.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem', flexShrink: 0, marginTop: '0.1rem' }}>
                                    {isOpen ? '▲' : '▼'}
                                </span>
                            </button>

                            {/* Expandable body */}
                            {isOpen && (
                                <div style={{ padding: '0 1.25rem 1.25rem', display: 'grid', gap: '1rem', borderTop: '1px solid var(--border-subtle)' }}>

                                    {/* Diagnosis */}
                                    {visit.diagnosis && (
                                        <div style={{ paddingTop: '1rem' }}>
                                            <div className="visit-section-label">Diagnosis</div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                                                {visit.diagnosis}
                                            </div>
                                        </div>
                                    )}

                                    {/* Doctor's note to patient */}
                                    {visit.patient_summary && (
                                        <div>
                                            <div className="visit-section-label">What your doctor shared with you</div>
                                            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.75, marginTop: '0.25rem' }}>
                                                {visit.patient_summary}
                                            </div>
                                        </div>
                                    )}

                                    {/* Instructions */}
                                    {visit.patient_instructions && (
                                        <div style={{
                                            padding: '0.875rem',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--accent-lighter)',
                                            borderLeft: '3px solid var(--accent)',
                                        }}>
                                            <div className="visit-section-label">Instructions from your doctor</div>
                                            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: '0.25rem' }}>
                                                {visit.patient_instructions}
                                            </div>
                                        </div>
                                    )}

                                    {/* Prescriptions from this visit */}
                                    {rxList.length > 0 && (
                                        <div>
                                            <div className="visit-section-label">Medications prescribed at this visit</div>
                                            <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                {rxList.map(rx => (
                                                    <div
                                                        key={rx.id}
                                                        style={{
                                                            display: 'flex',
                                                            gap: '0.75rem',
                                                            alignItems: 'flex-start',
                                                            padding: '0.75rem',
                                                            borderRadius: 'var(--radius-md)',
                                                            background: 'var(--bg-subtle)',
                                                            border: '1px solid var(--border-subtle)',
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '2rem', height: '2rem', borderRadius: '50%',
                                                            background: 'var(--accent-lighter)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '1rem', flexShrink: 0,
                                                        }}>
                                                            💊
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                                                {rx.medication_name}
                                                                {!rx.is_active && (
                                                                    <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                                        (discontinued)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                                                {rx.dosage}
                                                                {rx.frequency && <> · {rx.frequency_display ?? FREQ_LABEL[rx.frequency] ?? rx.frequency}</>}
                                                                {rx.duration_days && <> · {rx.duration_days} day{rx.duration_days !== 1 ? 's' : ''}</>}
                                                            </div>
                                                            {rx.patient_medication_note && (
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                                                    {rx.patient_medication_note}
                                                                </div>
                                                            )}
                                                            {rx.instructions && (
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                                                    {rx.instructions}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Follow-up */}
                                    {visit.follow_up_date && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.6rem',
                                            padding: '0.75rem 1rem',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                                            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                                        }}>
                                            <span style={{ fontSize: '1rem' }}>📅</span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>
                                                Follow-up recommended on {formatDateShort(visit.follow_up_date)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Documents */}
                                    {visit.file_attachments?.length > 0 && (
                                        <div>
                                            <div className="visit-section-label">Documents</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
                                                {visit.file_attachments.map(att => (
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
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
}
