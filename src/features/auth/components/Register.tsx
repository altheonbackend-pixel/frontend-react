import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import HomescreenHeader from '../../../shared/components/HomescreenHeader';
import '../styles/Auth.css';

import api from '../../../shared/services/api';

const Register = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        license_number: '',
        specialty: '',
        registration_code: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                        <input
                            type="text"
                            id="specialty"
                            name="specialty"
                            value={formData.specialty}
                            onChange={handleChange}
                        />
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
                            {t('register.code_label')} <span style={{ color: '#999', fontSize: '0.9em' }}>(Optional)</span>
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

                    <button type="submit" disabled={loading}>
                        {loading ? t('register.loading') : t('register.submit')}
                    </button>

                    <p className="link-back">
                        Already have an account? <a href="/login" style={{ color: '#3498db', textDecoration: 'none' }}>Login here</a>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Register;
