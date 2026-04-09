import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import HomescreenHeader from '../../../shared/components/HomescreenHeader';
import '../styles/Auth.css';

import api from '../../../shared/services/api';
import type { SpecialtyChoice } from '../../../shared/types';

const Register = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        license_number: '',
        specialty: 'general_practice',
        registration_code: '',
    });

    const [specialties, setSpecialties] = useState<SpecialtyChoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/auth/specialties/').then(r => setSpecialties(r.data)).catch(() => {});
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        try {
            const response = await api.post('/register/doctor/', formData);

            if (response.status === 201) {
                setSuccess(t('register.success.register'));
                setTimeout(() => {
                    navigate('/login', { replace: true });
                }, 2000);
            }
        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const errorData = err.response.data;

                // Handle errors by field
                let errorMessage = t('register.error.generic');
                if (typeof errorData === 'object' && errorData !== null) {
                    const errorMessages = Object.values(errorData).flat().join(' ');
                    errorMessage = `Erreur: ${errorMessages}`;
                }

                setError(errorMessage);
            } else {
                setError(t('register.error.network'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page-wrapper">
            <HomescreenHeader />
            <div className="auth-container">
                <form onSubmit={handleSubmit} className="auth-form">
                    <h2>{t('register.title')}</h2>
                    {success && <p className="success-message">{success}</p>}
                    {error && <p className="error-message">{error}</p>}

                    <div className="form-group">
                        <label htmlFor="first_name">{t('register.first_name')}</label>
                        <input
                            type="text"
                            id="first_name"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="last_name">{t('register.last_name')}</label>
                        <input
                            type="text"
                            id="last_name"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">{t('register.email')}</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="license_number">{t('register.license')}</label>
                        <input
                            type="text"
                            id="license_number"
                            name="license_number"
                            value={formData.license_number}
                            onChange={handleChange}
                            required
                        />
                    </div>

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
                            {specialties.length === 0 && (
                                <option value="general_practice">General Practice</option>
                            )}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">{t('register.password')}</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="registration_code">
                            {t('register.code_label')} <span className="optional-label">(Optional)</span>
                        </label>
                        <input
                            type="text"
                            id="registration_code"
                            name="registration_code"
                            value={formData.registration_code}
                            onChange={handleChange}
                            placeholder="Leave blank if you don't have a code"
                        />
                    </div>

                    <button type="submit" disabled={loading} className="login-button">
                        {loading ? t('register.loading') : t('register.submit')}
                    </button>

                    <p className="register-link-text">
                        Already have an account? <a href="/login">Login here</a>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Register;
