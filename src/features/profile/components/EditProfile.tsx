import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/hooks/useAuth';
import { type DoctorProfile } from '../../../shared/types';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';
import { profileSchema, type ProfileFormData } from '../profileSchema';

const EditProfile = () => {
    const { t } = useTranslation();
    const { profile, updateProfileData, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            first_name: '',
            last_name: '',
            email: '',
            specialty: '',
            license_number: '',
            phone_number: '',
            address: '',
        },
    });

    useEffect(() => {
        if (!isAuthenticated) {
            toast.error(t('edit_profile.error.auth'));
            return;
        }
        if (profile) {
            const nameParts = profile.full_name.split(' ');
            const firstName = nameParts.shift() || '';
            const lastName = nameParts.join(' ');
            reset({
                first_name: firstName,
                last_name: lastName,
                email: profile.email,
                specialty: profile.specialty || '',
                license_number: profile.license_number || '',
                phone_number: profile.phone_number || '',
                address: profile.address || '',
            });
        }
    }, [profile, isAuthenticated, reset, t]);

    const handleClose = () => navigate('/profile');

    const onSubmit = async (data: ProfileFormData) => {
        try {
            const response = await api.put('/profile/update/', data);
            const updatedProfile: DoctorProfile = {
                id: response.data.id,
                full_name: `${response.data.first_name} ${response.data.last_name}`,
                email: response.data.email,
                specialty: response.data.specialty,
                license_number: response.data.license_number,
                phone_number: response.data.phone_number,
                address: response.data.address,
                access_level: response.data.access_level || 1,
            };
            updateProfileData(updatedProfile);
            toast.success(t('edit_profile.success', { defaultValue: 'Profile updated.' }));
            navigate('/profile');
        } catch (err) {
            toast.error(parseApiError(err, t('edit_profile.error.save')));
        }
    };

    if (!profile) {
        return (
            <Modal open onClose={handleClose} title={t('edit_profile.title')} size="lg">
                <div>{t('edit_profile.error.load')}</div>
            </Modal>
        );
    }

    return (
        <Modal
            open
            onClose={handleClose}
            title={t('edit_profile.title')}
            size="lg"
            dirty={isDirty}
            footer={
                <>
                    <button type="button" onClick={handleClose} className="cancel-button" disabled={isSubmitting}>
                        {t('edit_profile.cancel')}
                    </button>
                    <button type="submit" form="edit-profile-form" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? t('edit_profile.saving') : t('edit_profile.save')}
                    </button>
                </>
            }
        >
            <form id="edit-profile-form" onSubmit={handleSubmit(onSubmit)} className="form">
                <div className="form-group">
                    <label htmlFor="first_name">{t('edit_profile.labels.first_name')}</label>
                    <input type="text" id="first_name" {...register('first_name')} />
                    {errors.first_name && <span className="field-error">{errors.first_name.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="last_name">{t('edit_profile.labels.last_name')}</label>
                    <input type="text" id="last_name" {...register('last_name')} />
                    {errors.last_name && <span className="field-error">{errors.last_name.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="email">{t('edit_profile.labels.email')}</label>
                    <input type="email" id="email" {...register('email')} />
                    {errors.email && <span className="field-error">{errors.email.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="specialty">{t('edit_profile.labels.specialty')}</label>
                    <input type="text" id="specialty" {...register('specialty')} />
                </div>
                <div className="form-group">
                    <label htmlFor="license_number">{t('edit_profile.labels.license')}</label>
                    <input type="text" id="license_number" {...register('license_number')} />
                </div>
                <div className="form-group">
                    <label htmlFor="phone_number">{t('edit_profile.labels.phone')}</label>
                    <input type="text" id="phone_number" {...register('phone_number')} />
                    {errors.phone_number && <span className="field-error">{errors.phone_number.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="address">{t('edit_profile.labels.address')}</label>
                    <textarea id="address" {...register('address')} />
                    {errors.address && <span className="field-error">{errors.address.message}</span>}
                </div>
            </form>
        </Modal>
    );
};

export default EditProfile;
