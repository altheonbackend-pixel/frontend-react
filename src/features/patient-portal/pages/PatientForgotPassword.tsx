import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { parseApiError } from '../../../shared/components/ui/toast';
import api from '../../../shared/services/api';

export default function PatientForgotPassword() {
    usePageTitle('Reset Password — Patient Portal');

    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setError(null);
        setLoading(true);
        try {
            await api.post('/patient/forgot-password/', { email: email.trim().toLowerCase() });
            setSubmitted(true);
        } catch (err) {
            setError(parseApiError(err, 'Something went wrong. Please try again.'));
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
                    <div className="patient-auth-headline">Forgot your password?</div>
                    <div className="patient-auth-sub">
                        Enter your email and we'll send you a secure link to reset your password. The link expires in 1 hour.
                    </div>
                </div>
                <div className="patient-auth-left-footer">
                    Remembered it?{' '}
                    <Link to="/patient/login" className="patient-auth-link">Sign in →</Link>
                </div>
            </div>

            <div className="patient-auth-right">
                <div className="patient-auth-card">
                    {submitted ? (
                        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-bg)', display: 'grid', placeItems: 'center', margin: '0 auto 1rem' }}>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            </div>
                            <div className="patient-auth-card-title">Check your email</div>
                            <div className="patient-auth-card-sub" style={{ marginBottom: '1.5rem' }}>
                                If an account exists for <strong>{email}</strong>, a reset link has been sent. It expires in 1 hour.
                            </div>
                            <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                Didn't receive it? Check your spam folder. Make sure you used the email address registered with your clinic.
                            </div>
                            <Link to="/patient/login" className="btn btn-primary" style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
                                Back to sign in
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="patient-auth-card-header">
                                <div className="patient-auth-card-title">Reset your password</div>
                                <div className="patient-auth-card-sub">
                                    We'll send a reset link to the email address associated with your patient account.
                                </div>
                            </div>
                            <form onSubmit={handleSubmit} className="patient-auth-form" noValidate>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}
                                <div className="form-group">
                                    <label htmlFor="email">Email address</label>
                                    <input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        disabled={loading}
                                        required
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading || !email.trim()}>
                                    {loading ? 'Sending…' : 'Send reset link'}
                                </button>
                                <div style={{ textAlign: 'center' }}>
                                    <Link to="/patient/login" className="btn btn-ghost" style={{ display: 'inline-flex' }}>
                                        ← Back to sign in
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
