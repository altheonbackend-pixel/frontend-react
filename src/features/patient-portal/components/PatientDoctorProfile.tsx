import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import Avatar from '../../../shared/components/Avatar';

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
    const { t } = useTranslation();
    usePageTitle(t('patient_portal.doctor_profile.document_title'));
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
                title={isLoading ? t('patient_portal.common.loading') : doctor?.full_name ?? t('patient_portal.doctor_profile.title')}
                subtitle={doctor?.specialty ?? undefined}
                actions={
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
                        {t('patient_portal.common.back')}
                    </button>
                }
            />

            {isLoading && (
                <SectionCard title=""><TabSkeleton rows={4} /></SectionCard>
            )}

            {isError && (
                <div className="error-message" style={{ margin: '0 0 1rem' }}>
                    {t('patient_portal.doctor_profile.error.load')}
                </div>
            )}

            {doctor && (
                <div style={{ display: 'grid', gap: '1.25rem' }}>
                    {/* Avatar + name hero */}
                    <SectionCard>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <Avatar name={doctor.full_name.replace('Dr. ', '')} src={doctor.avatar_url} size="xl" />
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
                    <SectionCard title={t('patient_portal.doctor_profile.contact_information')}>
                        <InfoRow label={t('patient_portal.doctor_profile.practice_clinic')} value={doctor.clinic} />
                        <InfoRow label={t('patient_portal.doctor_profile.phone')} value={doctor.phone_number} />
                        <InfoRow label={t('patient_portal.doctor_profile.email')} value={doctor.email} />
                        {!doctor.phone_number && !doctor.clinic && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                                {t('patient_portal.doctor_profile.no_contact_details')}
                            </p>
                        )}
                    </SectionCard>

                    {/* Book appointment CTA */}
                    <SectionCard title={t('patient_portal.doctor_profile.book_appointment')}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                            {t('patient_portal.doctor_profile.book_intro', { name: doctor.full_name })}
                        </p>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate('/patient/appointments')}
                        >
                            {t('patient_portal.doctor_profile.go_to_appointments')}
                        </button>
                    </SectionCard>
                </div>
            )}
        </>
    );
}
