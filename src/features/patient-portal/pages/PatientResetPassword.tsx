import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { parseApiError } from '../../../shared/components/ui/toast';
import { toast } from '../../../shared/components/ui';
import api from '../../../shared/services/api';

export default function PatientResetPassword() {
    usePageTitle('Reset Password — Patient Portal');
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const tokenFromUrl = searchParams.get('token') ?? '';

    const [token, setToken] = useState(tokenFromUrl);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!tokenFromUrl) {
            setError('No reset token found in the URL. Please use the link from your email.');
        }
    }, [tokenFromUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!token.trim()) {
            setError('Reset token is missing. Please use the link from your email.');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/patient/reset-password/', {
                token: token.trim(),
                new_password: newPassword,
            });
            setDone(true);
            toast.success('Password reset successfully.');
            setTimeout(() => navigate('/patient/login', { replace: true }), 2000);
        } catch (err) {
            setError(parseApiError(err, 'Invalid or expired reset link. Please request a new one.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="patient-auth-shell">
            <div className="patient-auth-left">
                <div className="patient-auth-brand">
                    <div className="patient-auth-logo">
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                            <circle cx="18" cy="18" r="18" fill="var(--accent)" />
                            <path d="M18 10v16M10 18h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div className="patient-auth-brand-name">Altheon Patient Portal</div>
                </div>
                <div className="patient-auth-left-body">
                    <div className="patient-auth-headline">Set a new password.</div>
                    <div className="patient-auth-sub">
                        Choose a strong password of at least 8 characters. Your session will remain secure after reset.
                    </div>
                </div>
                <div className="patient-auth-left-footer">
                    <Link to="/patient/login" className="patient-auth-link">← Back to sign in</Link>
                </div>
            </div>

            <div className="patient-auth-right">
                <div className="patient-auth-card">
                    {done ? (
                        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-bg)', display: 'grid', placeItems: 'center', margin: '0 auto 1rem' }}>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <div className="patient-auth-card-title">Password updated</div>
                            <div className="patient-auth-card-sub" style={{ marginBottom: '1.5rem' }}>
                                Your password has been reset. Redirecting you to sign in…
                            </div>
                            <Link to="/patient/login" className="btn btn-primary" style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
                                Sign in now
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="patient-auth-card-header">
                                <div className="patient-auth-card-title">Set a new password</div>
                                <div className="patient-auth-card-sub">
                                    Your reset link is valid. Enter a new password for your patient portal account.
                                </div>
                            </div>
                            <form onSubmit={handleSubmit} className="patient-auth-form" noValidate>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}

                                {!tokenFromUrl && (
                                    <div className="form-group">
                                        <label htmlFor="token">Reset token</label>
                                        <input
                                            id="token"
                                            type="text"
                                            value={token}
                                            onChange={e => setToken(e.target.value)}
                                            placeholder="Paste your reset token"
                                            autoComplete="off"
                                            disabled={loading}
                                        />
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                            Use the link from your reset email, or paste just the token portion.
                                        </div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label htmlFor="newPassword">New password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="newPassword"
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="Minimum 8 characters"
                                            autoComplete="new-password"
                                            disabled={loading}
                                            required
                                            style={{ paddingRight: '2.75rem' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(v => !v)}
                                            className="btn-ghost"
                                            style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-muted)' }}
                                            tabIndex={-1}
                                        >
                                            {showPassword ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="confirmPassword">Confirm new password</label>
                                    <input
                                        id="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Repeat your password"
                                        autoComplete="new-password"
                                        disabled={loading}
                                        required
                                    />
                                </div>

                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                                    {loading ? 'Resetting…' : 'Reset password'}
                                </button>

                                <div style={{ textAlign: 'center' }}>
                                    <Link to="/patient/forgot-password" className="patient-auth-link" style={{ fontSize: '0.875rem' }}>
                                        Request a new reset link
                                    </Link>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
