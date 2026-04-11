import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { type DoctorProfile, type Workplace } from '../../../shared/types';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';

const EditProfile = () => {
    const { t } = useTranslation();
    const { profile, updateProfileData, token } = useAuth();
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
    const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
    const [selectedWorkplaces, setSelectedWorkplaces] = useState<Workplace[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!token) {
                toast.error(t('edit_profile.error.auth'));
                setInitialLoading(false);
                return;
            }

            try {
                const workplacesResponse = await api.get('/workplaces/');
                const allWorkplaces: Workplace[] = workplacesResponse.data.results ?? workplacesResponse.data;
                setWorkplaces(allWorkplaces);

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

                    if (profile.workplaces) {
                        const preselected = allWorkplaces.filter(w =>
                            profile.workplaces?.some(pw => pw.id === w.id)
                        );
                        setSelectedWorkplaces(preselected);
                    }
                }
            } catch (err) {
                toast.error(parseApiError(err, t('edit_profile.error.load')));
            } finally {
                setInitialLoading(false);
            }
        };

        fetchData();
    }, [profile, token, t]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setDirty(true);
        setFormData(prevData => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleSelectChange = (newValue: readonly (Workplace & { value: number; label: string })[]) => {
        setDirty(true);
        setSelectedWorkplaces(newValue.map(({ value: _v, label: _l, ...rest }) => rest as Workplace));
    };

    const handleClose = () => navigate('/profile');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                workplaces: selectedWorkplaces.map(w => w.id),
            };

            const response = await api.put('/profile/update/', payload);

            const updatedProfile: DoctorProfile = {
                id: response.data.id,
                full_name: `${response.data.first_name} ${response.data.last_name}`,
                email: response.data.email,
                specialty: response.data.specialty,
                license_number: response.data.license_number,
                phone_number: response.data.phone_number,
                address: response.data.address,
                workplaces: response.data.workplaces,
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

    const options = workplaces.map(w => ({
        value: w.id,
        label: w.name,
        ...w
    }));

    const defaultValues = selectedWorkplaces.map(w => ({
        value: w.id,
        label: w.name,
        ...w
    }));

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

                    <div className="form-group">
                        <label>{t('edit_profile.labels.workplaces')}</label>
                        <Select
                            isMulti
                            options={options}
                            value={defaultValues}
                            onChange={handleSelectChange}
                            placeholder={t('edit_profile.placeholders.workplaces')}
                        />
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default EditProfile;
