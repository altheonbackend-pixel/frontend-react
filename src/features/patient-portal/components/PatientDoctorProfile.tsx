import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem', padding: '0.625rem 0', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
            <div style={{ color: 'var(--text-primary)' }}>{value}</div>
        </div>
    );
}

export default function PatientDoctorProfile() {
    usePageTitle('Doctor Profile');
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const doctorId = Number(id);

    const { data: doctor, isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.doctorProfile(doctorId),
        queryFn: () => patientPortalService.getDoctorProfile(doctorId),
        enabled: !!doctorId,
        staleTime: 10 * 60_000,
    });

    return (
        <>
            <PageHeader
                title={isLoading ? 'Loading…' : doctor?.full_name ?? 'Doctor Profile'}
                subtitle={doctor?.specialty ?? undefined}
                actions={
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
                        ← Back
                    </button>
                }
            />

            {isLoading && (
                <SectionCard title=""><TabSkeleton rows={4} /></SectionCard>
            )}

            {isError && (
                <div className="error-message" style={{ margin: '0 0 1rem' }}>
                    Doctor profile not found or not available.
                </div>
            )}

            {doctor && (
                <div style={{ display: 'grid', gap: '1.25rem' }}>
                    {/* Avatar + name hero */}
                    <SectionCard>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{
                                width: 72, height: 72, borderRadius: '50%',
                                background: 'var(--accent-lighter)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent)',
                                flexShrink: 0,
                            }}>
                                {doctor.full_name.replace('Dr. ', '').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{doctor.full_name}</div>
                                {doctor.specialty && (
                                    <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{doctor.specialty}</div>
                                )}
                                {doctor.clinic && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.15rem' }}>{doctor.clinic}</div>
                                )}
                            </div>
                        </div>
                    </SectionCard>

                    {/* Contact details */}
                    <SectionCard title="Contact information">
                        <InfoRow label="Practice / Clinic" value={doctor.clinic} />
                        <InfoRow label="Phone" value={doctor.phone_number} />
                        <InfoRow label="Email" value={doctor.email} />
                        {!doctor.phone_number && !doctor.clinic && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                                No contact details on file.
                            </p>
                        )}
                    </SectionCard>

                    {/* Book appointment CTA */}
                    <SectionCard title="Book an appointment">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                            You can request an appointment with {doctor.full_name} through the appointments section.
                        </p>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate('/patient/appointments')}
                        >
                            Go to appointments →
                        </button>
                    </SectionCard>
                </div>
            )}
        </>
    );
}
