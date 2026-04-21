import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../../shared/services/api';
import { useAuth } from '../hooks/useAuth';
import '../styles/Auth.css';

const VerifyEmail = () => {
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
                    const detail = err?.response?.data?.detail || 'Invalid or expired verification link.';
                    setMessage(detail);
                    setStatus('error');
                });
        }
    }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleResend = async () => {
        setResending(true);
        setResendMsg('');
        try {
            await api.post('/auth/resend-verification/');
            setResendMsg('Verification email sent. Check your inbox.');
        } catch {
            setResendMsg('Could not resend email. Please try again.');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="auth-page-wrapper">
            <div className="auth-container">
                <div className="auth-form">
                    <h2>Email Verification</h2>

                    {status === 'verifying' && (
                        <p className="info-message">Verifying your email…</p>
                    )}

                    {status === 'success' && (
                        <p className="success-message">
                            Your email has been verified. Redirecting to your dashboard…
                        </p>
                    )}

                    {status === 'error' && (
                        <p className="error-message">{message}</p>
                    )}

                    {status === 'idle' && !token && profile?.email_verified && (
                        <>
                            <p className="success-message">
                                Your email is already verified.
                            </p>
                            <button
                                className="auth-button"
                                onClick={() => navigate('/dashboard', { replace: true })}
                            >
                                Go to Dashboard
                            </button>
                        </>
                    )}

                    {status === 'idle' && !token && !profile?.email_verified && (
                        <>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                A verification email has been sent to <strong>{profile?.email}</strong>.
                                Please check your inbox and click the link to verify your account.
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                                You must verify your email before accessing the platform.
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
                                {resending ? 'Sending…' : 'Resend Verification Email'}
                            </button>

                            {isAuthenticated && (
                                <button
                                    className="auth-button"
                                    style={{ background: 'var(--bg-muted)' }}
                                    onClick={logout}
                                >
                                    Log Out
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
