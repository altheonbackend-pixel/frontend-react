import React, { useState } from 'react';
//import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import '../styles/Auth.css';
import { useTranslation } from 'react-i18next';

function Login() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    //const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setLoading(true);

        try {
            await login({ email, password });
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                const data = error.response.data;
                let message = t('login.error.invalid_credentials');
                
                if (data.message) { message = data.message; } 
                else if (data.detail) { message = data.detail; } 
                else if (data.non_field_errors) { message = data.non_field_errors[0]; }
                
                setErrorMessage(message);
            }
            // IMPORTANT : setLoading(false) est ici en cas d'échec
            setLoading(false); 
        }
        // NOTE: Si la connexion réussit, le composant est démonté par la navigation dans useAuth, 
        // donc nous n'avons pas besoin d'un 'finally' général.
    };

    return (
        <div className="auth-container">
            
            <h2 className="login-title">{t('login.title')}</h2>
            
            <form onSubmit={handleSubmit} className="auth-form">
                {errorMessage && <p className="error-message">{errorMessage}</p>}
                
                <div className="form-group">
                    <label htmlFor="email">{t('login.email_label')}</label>
                    <input
                        type="email"
                        id="email"
                        className="input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        aria-label={t('login.email_placeholder')}
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">{t('login.password_label')}</label>
                    <input
                        type="password"
                        id="password"
                        className="input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        aria-label={t('login.password_placeholder')}
                        disabled={loading}
                    />
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? t('login.loading') : t('login.submit')}
                </button>
            </form>

            <p className="register-link-text">
                {t('login.no_account')} <a href="/register">{t('login.register_link')}</a>
            </p>
        </div>
    );
}

export default Login;