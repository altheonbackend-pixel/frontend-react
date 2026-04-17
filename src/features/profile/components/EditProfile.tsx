import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { type DoctorProfile } from '../../../shared/types';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';

const EditProfile = () => {
    const { t } = useTranslation();
    const { profile, updateProfileData, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        specialty: '',
        license_number: '',
        phone_number: '',
        address: '',
    });
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            toast.error(t('edit_profile.error.auth'));
            setInitialLoading(false);
            return;
        }

        if (profile) {
            const nameParts = profile.full_name.split(' ');
            const firstName = nameParts.shift() || '';
            const lastName = nameParts.join(' ');

            setFormData({
                first_name: firstName,
                last_name: lastName,
                email: profile.email,
                specialty: profile.specialty || '',
                license_number: profile.license_number || '',
                phone_number: profile.phone_number || '',
                address: profile.address || '',
            });
        }

        setInitialLoading(false);
    }, [profile, isAuthenticated, t]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setDirty(true);
        setFormData(prevData => ({ ...prevData, [name]: value }));
    };

    const handleClose = () => navigate('/profile');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await api.put('/profile/update/', formData);

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
            setDirty(false);
            navigate('/profile');
        } catch (err) {
            toast.error(parseApiError(err, t('edit_profile.error.save')));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open
            onClose={handleClose}
            title={t('edit_profile.title')}
            size="lg"
            dirty={dirty}
            footer={
                <>
                    <button type="button" onClick={handleClose} className="cancel-button" disabled={loading}>
                        {t('edit_profile.cancel')}
                    </button>
                    <button type="submit" form="edit-profile-form" disabled={loading || initialLoading}>
                        {loading ? t('edit_profile.saving') : t('edit_profile.save')}
                    </button>
                </>
            }
        >
            {initialLoading ? (
                <div>{t('edit_profile.loading')}</div>
            ) : !profile ? (
                <div>{t('edit_profile.error.load')}</div>
            ) : (
                <form id="edit-profile-form" onSubmit={handleSubmit} className="form">
                    <div className="form-group">
                        <label htmlFor="first_name">{t('edit_profile.labels.first_name')}</label>
                        <input type="text" id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="last_name">{t('edit_profile.labels.last_name')}</label>
                        <input type="text" id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">{t('edit_profile.labels.email')}</label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="specialty">{t('edit_profile.labels.specialty')}</label>
                        <input type="text" id="specialty" name="specialty" value={formData.specialty} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="license_number">{t('edit_profile.labels.license')}</label>
                        <input type="text" id="license_number" name="license_number" value={formData.license_number} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone_number">{t('edit_profile.labels.phone')}</label>
                        <input type="text" id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="address">{t('edit_profile.labels.address')}</label>
                        <textarea id="address" name="address" value={formData.address} onChange={handleChange}></textarea>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default EditProfile;
