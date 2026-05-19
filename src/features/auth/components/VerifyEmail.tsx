import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { useAuth } from '../hooks/useAuth';
import '../styles/Auth.css';

const VerifyEmail = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isAuthenticated, logout, profile, updateProfileData } = useAuth();
    const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState('');

    const token = searchParams.get('token');

    useEffect(() => {
        if (token) {
            setStatus('verifying');
            api.get(`/auth/verify-email/?token=${token}`)
                .then(() => {
                    setStatus('success');
                    // Update profile email_verified flag without full re-fetch
                    if (profile) {
                        updateProfileData({ ...profile, email_verified: true });
                    }
                    setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
                })
                .catch((err) => {
                    const detail = err?.response?.data?.detail || t('auth.verify.error.invalid_or_expired');
                    setMessage(detail);
                    setStatus('error');
                });
        }
    }, [navigate, profile, t, token, updateProfileData]);

    const handleResend = async () => {
        setResending(true);
        setResendMsg('');
        try {
            await api.post('/auth/resend-verification/');
            setResendMsg(t('auth.verify.resend_success'));
        } catch {
            setResendMsg(t('auth.verify.resend_error'));
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="auth-page-wrapper">
            <div className="auth-container">
                <div className="auth-form">
                    <h2>{t('auth.verify.title')}</h2>

                    {status === 'verifying' && (
                        <p className="info-message">{t('auth.verify.verifying')}</p>
                    )}

                    {status === 'success' && (
                        <p className="success-message">
                            {t('auth.verify.success')}
                        </p>
                    )}

                    {status === 'error' && (
                        <p className="error-message">{message}</p>
                    )}

                    {status === 'idle' && !token && profile?.email_verified && (
                        <>
                            <p className="success-message">
                                {t('auth.verify.already_verified')}
                            </p>
                            <button
                                className="auth-button"
                                onClick={() => navigate('/dashboard', { replace: true })}
                            >
                                {t('auth.verify.go_to_dashboard')}
                            </button>
                        </>
                    )}

                    {status === 'idle' && !token && !profile?.email_verified && (
                        <>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                {t('auth.verify.sent_to')} <strong>{profile?.email}</strong>.
                                {' '}{t('auth.verify.check_inbox')}
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                                {t('auth.verify.required')}
                            </p>

                            {resendMsg && (
                                <p className={resendMsg.includes('sent') ? 'success-message' : 'error-message'}>
                                    {resendMsg}
                                </p>
                            )}

                            <button
                                className="auth-button"
                                onClick={handleResend}
                                disabled={resending}
                                style={{ marginBottom: '12px' }}
                            >
                                {resending ? t('common.sending') : t('auth.verify.resend_button')}
                            </button>

                            {isAuthenticated && (
                                <button
                                    className="auth-button"
                                    style={{ background: 'var(--bg-muted)' }}
                                    onClick={logout}
                                >
                                    {t('nav.logout')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
