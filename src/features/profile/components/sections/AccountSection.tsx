import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useDoctorProfile } from '../../hooks/useDoctorProfile';
import { profileSchema, type ProfileFormData } from '../../profileSchema';
import { toast, parseApiError } from '../../../../shared/components/ui';
import api from '../../../../shared/services/api';
import type { SpecialtyChoice } from '../../../../shared/types';

export default function AccountSection() {
    const { t } = useTranslation();
    const { profile, saveProfile } = useDoctorProfile();

    const { data: specialties = [] } = useQuery<SpecialtyChoice[]>({
        queryKey: ['specialties'],
        queryFn: () => api.get('/specialties/').then(r => r.data),
        staleTime: 60 * 60_000,
    });

    const {
        register, handleSubmit, reset,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            first_name: '', last_name: '', email: '', specialty: '',
            license_number: '', phone_number: '', country: '', city: '', address: '',
        },
    });

    useEffect(() => {
        if (!profile) return;
        const parts = (profile.full_name || '').split(' ');
        const first = parts.shift() || '';
        reset({
            first_name: first,
            last_name: parts.join(' '),
            email: profile.email,
            specialty: profile.specialty || '',
            license_number: profile.license_number || '',
            phone_number: profile.phone_number || '',
            country: profile.country || '',
            city: profile.city || '',
            address: profile.address || '',
        });
    }, [profile, reset]);

    const onSubmit = async (data: ProfileFormData) => {
        try {
            await saveProfile(data);
            toast.success(t('settings.account.saved'));
            reset(data);
        } catch (err) {
            toast.error(parseApiError(err, t('settings.account.save_error')));
        }
    };

    return (
        <form className="settings-card" onSubmit={handleSubmit(onSubmit)}>
            <div className="settings-card-head">
                <h2 className="settings-card-title">{t('settings.account.title')}</h2>
                <p className="settings-card-subtitle">{t('settings.account.subtitle')}</p>
            </div>

            <div className="settings-card-body">
                <div className="settings-grid-2">
                    <div className="form-group">
                        <label htmlFor="first_name">{t('edit_profile.labels.first_name')}</label>
                        <input id="first_name" type="text" className="input" {...register('first_name')} />
                        {errors.first_name && <span className="field-error">{errors.first_name.message}</span>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="last_name">{t('edit_profile.labels.last_name')}</label>
                        <input id="last_name" type="text" className="input" {...register('last_name')} />
                        {errors.last_name && <span className="field-error">{errors.last_name.message}</span>}
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="email">{t('edit_profile.labels.email')}</label>
                    <input id="email" type="email" className="input" {...register('email')} />
                    {errors.email && <span className="field-error">{errors.email.message}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="phone_number">{t('edit_profile.labels.phone')}</label>
                    <input id="phone_number" type="tel" className="input" {...register('phone_number')} />
                    {errors.phone_number && <span className="field-error">{errors.phone_number.message}</span>}
                </div>

                <div className="settings-grid-2">
                    <div className="form-group">
                        <label htmlFor="specialty">{t('edit_profile.labels.specialty')}</label>
                        <select id="specialty" className="select-input" {...register('specialty')}>
                            <option value="">{t('settings.account.select_specialty')}</option>
                            {specialties.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="license_number">{t('edit_profile.labels.license')}</label>
                        <input id="license_number" type="text" className="input" {...register('license_number')} />
                    </div>
                </div>

                <div className="settings-grid-2">
                    <div className="form-group">
                        <label htmlFor="country">{t('settings.account.country')}</label>
                        <input id="country" type="text" className="input" {...register('country')} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="city">{t('settings.account.city')}</label>
                        <input id="city" type="text" className="input" {...register('city')} />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="address">{t('edit_profile.labels.address')}</label>
                    <textarea id="address" className="textarea" rows={2} {...register('address')} />
                    {errors.address && <span className="field-error">{errors.address.message}</span>}
                </div>
            </div>

            <div className="settings-card-footer">
                <button type="submit" className="btn btn-primary btn-sm" disabled={!isDirty || isSubmitting}>
                    {isSubmitting ? t('common.saving') : t('settings.save_changes')}
                </button>
            </div>
        </form>
    );
}
