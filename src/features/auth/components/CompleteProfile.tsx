import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { useAuth } from '../hooks/useAuth';
import type { SpecialtyChoice } from '../../../shared/types';
import '../styles/Auth.css';

const CompleteProfile = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { profile, updateProfileData, logout } = useAuth();
    const [specialties, setSpecialties] = useState<SpecialtyChoice[]>([]);
    const [formData, setFormData] = useState({
        specialty: profile?.specialty || 'general_practice',
        phone_number: profile?.phone_number || '',
        address: profile?.address || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get('/auth/specialties/')
            .then(r => setSpecialties(r.data))
            .catch(() => setSpecialties([{ value: 'general_practice', label: t('specialties.general_practice') }]));
    }, [t]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.phone_number.trim() || !formData.address.trim()) {
            setError(t('auth.complete_profile.error.required'));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await api.patch('/profile/update/', formData);
            updateProfileData(response.data);
            navigate('/dashboard', { replace: true });
        } catch (err) {
            const axiosErr = err as { response?: { data?: Record<string, unknown> } };
            const data = axiosErr?.response?.data;
            const msg = data && typeof data === 'object'
                ? Object.values(data).flat().join(' ')
                : t('auth.complete_profile.error.save');
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page-wrapper">
            <div className="auth-container">
                <form onSubmit={handleSubmit} className="auth-form">
                    <h2>{t('auth.complete_profile.title')}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                        {t('auth.complete_profile.subtitle')}
                    </p>

                    {error && <p className="error-message">{error}</p>}

                    <div className="form-group">
                        <label htmlFor="specialty">{t('register.specialty')}</label>
                        <select
                            id="specialty"
                            name="specialty"
                            value={formData.specialty}
                            onChange={handleChange}
                            required
                        >
                            {specialties.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="phone_number">{t('auth.complete_profile.phone_number')}</label>
                        <input
                            type="tel"
                            id="phone_number"
                            name="phone_number"
                            value={formData.phone_number}
                            onChange={handleChange}
                            placeholder="+213 555 123 456"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="address">{t('auth.complete_profile.address_city')}</label>
                        <textarea
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="123 Main St, Algiers"
                            rows={3}
                            required
                        />
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? t('common.saving') : t('auth.complete_profile.save_continue')}
                    </button>

                    <button
                        type="button"
                        className="auth-button"
                        style={{ background: 'var(--bg-muted)', marginTop: '8px' }}
                        onClick={logout}
                    >
                        {t('nav.logout')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CompleteProfile;
