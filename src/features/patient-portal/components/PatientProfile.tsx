import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import AvatarManager from '../../../shared/components/AvatarManager';
import { useAuth } from '../../auth/hooks/useAuth';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast, parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

const patientProfileSchema = z.object({
    phone_number: z.string().optional(),
    address: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_number: z.string().optional(),
});

type PatientProfileFormData = z.infer<typeof patientProfileSchema>;

export default function PatientProfile({ asTab = false }: { asTab?: boolean }) {
    const { t } = useTranslation();
    const { setPatientAvatar } = useAuth();
    usePageTitle(t('patient_portal.profile.document_title'));
    const queryClient = useQueryClient();

    const { data: profile, isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.profile(),
        queryFn: patientPortalService.getProfile,
        staleTime: 5 * 60_000,
    });

    const {
        register,
        handleSubmit,
        reset,
        formState: { isDirty, isSubmitting },
    } = useForm<PatientProfileFormData>({
        resolver: zodResolver(patientProfileSchema),
        defaultValues: {
            phone_number: '',
            address: '',
            emergency_contact_name: '',
            emergency_contact_number: '',
        },
    });

    useEffect(() => {
        if (profile) {
            reset({
                phone_number: profile.phone_number ?? '',
                address: profile.address ?? '',
                emergency_contact_name: profile.emergency_contact_name ?? '',
                emergency_contact_number: profile.emergency_contact_number ?? '',
            });
        }
    }, [profile, reset]);

    const { mutate: saveProfile } = useMutation({
        mutationFn: (data: PatientProfileFormData) => patientPortalService.updateProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.profile() });
            toast.success(t('patient_portal.profile.toast.updated'));
        },
        onError: (err) => toast.error(parseApiError(err, t('patient_portal.profile.error.update'))),
    });

    if (isLoading) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.profile.title')} subtitle={t('patient_portal.profile.subtitle_short')} />}
                <SectionCard title={t('patient_portal.common.loading')}><TabSkeleton rows={5} /></SectionCard>
            </>
        );
    }

    if (isError || !profile) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.profile.title')} subtitle="" />}
                <div className="error-message" style={{ margin: '1rem' }}>{t('patient_portal.profile.error.load')}</div>
            </>
        );
    }

    return (
        <>
            {!asTab && (
                <PageHeader
                    title={t('patient_portal.profile.title')}
                    subtitle={t('patient_portal.profile.subtitle')}
                />
            )}

            <div className="patient-profile-grid">
                <SectionCard>
                    <div style={{ display: 'grid', justifyItems: 'center', gap: '0.75rem' }}>
                        <AvatarManager
                            name={profile.full_name}
                            currentUrl={profile.avatar_url}
                            mode="both"
                            onUpload={async (blob) => {
                                const res = await patientPortalService.uploadAvatar(blob);
                                queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.profile() });
                                setPatientAvatar(res?.avatar_url ?? null);  // live-update sidebar/topbar
                                toast.success(t('settings.avatar.updated'));
                            }}
                            onRemove={async () => {
                                await patientPortalService.removeAvatar();
                                queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.profile() });
                                setPatientAvatar(null);
                                toast.success(t('settings.avatar.removed'));
                            }}
                        />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>{profile.full_name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{profile.email}</div>
                        </div>
                        <div style={{ width: '100%', display: 'grid', gap: '0.65rem', marginTop: '0.5rem' }}>
                            {[
                                { label: t('patient_portal.profile.date_of_birth'), value: profile.date_of_birth ?? '—' },
                                { label: t('patient_portal.profile.blood_group'), value: profile.blood_group ?? '—' },
                                { label: t('patient_portal.profile.primary_doctor'), value: profile.primary_doctor_name ?? '—' },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                                </div>
                            ))}
                        </div>
                        {profile.patient_id && (
                            <div
                                title={profile.patient_id}
                                style={{
                                    width: '100%',
                                    marginTop: '0.25rem',
                                    padding: '0.4rem 0.65rem',
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                    textAlign: 'center',
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                    background: 'var(--bg-subtle)',
                                    borderRadius: 'var(--radius-sm)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {t('patient_portal.profile.patient_id')}: {profile.patient_id}
                            </div>
                        )}
                    </div>
                </SectionCard>

                <SectionCard title={t('patient_portal.profile.contact_details')}>
                    <form className="form" onSubmit={handleSubmit(data => saveProfile(data))}>
                        <div className="form-group">
                            <label htmlFor="phone_number">{t('patient_portal.profile.phone_number')}</label>
                            <input id="phone_number" {...register('phone_number')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="address">{t('patient_portal.profile.address')}</label>
                            <textarea id="address" rows={3} {...register('address')} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label htmlFor="emergency_contact_name">{t('patient_portal.profile.emergency_contact_name')}</label>
                                <input id="emergency_contact_name" {...register('emergency_contact_name')} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="emergency_contact_number">{t('patient_portal.profile.emergency_contact_number')}</label>
                                <input id="emergency_contact_number" {...register('emergency_contact_number')} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !isDirty}>
                                {isSubmitting ? t('patient_portal.common.saving') : t('patient_portal.profile.save_changes')}
                            </button>
                        </div>
                    </form>
                </SectionCard>
            </div>
        </>
    );
}
