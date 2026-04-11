import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { useNavigate, useParams } from 'react-router-dom';
import { type Workplace } from '../../../shared/types';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';

const ClinicForm = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [formData, setFormData] = useState<Partial<Workplace>>({
        name: '',
        address: '',
        is_public: false,
    });
    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (id) {
            const fetchClinic = async () => {
                if (!token) {
                    toast.error(t('clinics.error.auth'));
                    return;
                }
                try {
                    const response = await api.get(`/workplaces/${id}/`);
                    setFormData(response.data);
                } catch {
                    toast.error(t('clinics.error.not_found'));
                }
            };
            fetchClinic();
        }
    }, [id, token, t]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        setDirty(true);
        setFormData(prevData => ({
            ...prevData,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleClose = () => navigate('/clinics');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!token) {
            toast.error(t('clinics.error.auth'));
            setLoading(false);
            return;
        }

        try {
            if (id) {
                await api.put(`/workplaces/${id}/`, formData);
                toast.success(t('clinics.update_success', { defaultValue: 'Clinic updated.' }));
                setDirty(false);
                navigate(`/clinics/${id}`);
            } else {
                const response = await api.post('/workplaces/', formData);
                toast.success(t('clinics.create_success', { defaultValue: 'Clinic created.' }));
                setDirty(false);
                navigate(`/clinics/${response.data.id}`);
            }
        } catch (err) {
            toast.error(parseApiError(err, t('clinics.error.general')));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open
            onClose={handleClose}
            title={id ? t('clinics.title_edit') : t('clinics.title_add')}
            size="md"
            dirty={dirty}
            footer={
                <>
                    <button type="button" onClick={handleClose} className="cancel-button" disabled={loading}>
                        {t('clinics.cancel')}
                    </button>
                    <button type="submit" form="clinic-form" disabled={loading}>
                        {loading ? t('clinics.submit.processing') : t('clinics.submit.save')}
                    </button>
                </>
            }
        >
            <form id="clinic-form" onSubmit={handleSubmit} className="form">
                <div className="form-group">
                    <label htmlFor="name">{t('clinics.label.name')}</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name || ''}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="address">{t('clinics.label.address')}</label>
                    <textarea
                        id="address"
                        name="address"
                        value={formData.address || ''}
                        onChange={handleChange}
                        required
                    ></textarea>
                </div>

                <div className="form-group checkbox-group">
                    <input
                        type="checkbox"
                        id="is_public"
                        name="is_public"
                        checked={formData.is_public || false}
                        onChange={handleChange}
                    />
                    <label htmlFor="is_public">{t('clinics.label.is_public')}</label>
                </div>
            </form>
        </Modal>
    );
};

export default ClinicForm;
