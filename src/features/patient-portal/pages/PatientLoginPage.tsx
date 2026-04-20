import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { parseApiError } from '../../../shared/components/ui/toast';
import { toast } from '../../../shared/components/ui';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

export default function PatientLoginPage() {
    usePageTitle('Patient Portal — Sign In');
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) return;
        setError(null);
        setLoading(true);
        try {
            await login({ email: email.trim().toLowerCase(), password });
            // AuthContext.login navigates to /patient/dashboard on success
        } catch (err) {
            const msg = parseApiError(err, 'Invalid email or password.');
            setError(msg);
            toast.error(msg);
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
                    <div className="patient-auth-headline">Your health, clear and connected.</div>
                    <div className="patient-auth-sub">
                        Access your appointments, visit summaries, medications, and lab results — all in one place.
                    </div>
                    <ul className="patient-auth-features">
                        <li>
                            <span className="feature-dot feature-dot--green" />
                            View visit summaries from your doctor
                        </li>
                        <li>
                            <span className="feature-dot feature-dot--blue" />
                            Request and track appointments
                        </li>
                        <li>
                            <span className="feature-dot feature-dot--purple" />
                            Review medications and lab results
                        </li>
                        <li>
                            <span className="feature-dot feature-dot--orange" />
                            Stay notified about your care
                        </li>
                    </ul>
                </div>
                <div className="patient-auth-left-footer">
                    Not a patient? <Link to="/login" className="patient-auth-link">Doctor / Staff sign in →</Link>
                </div>
            </div>

            <div className="patient-auth-right">
                <div className="patient-auth-card">
                    <div className="patient-auth-card-header">
                        <div className="patient-auth-card-title">Sign in to your portal</div>
                        <div className="patient-auth-card-sub">
                            Don't have an account?{' '}
                            <Link to="/patient/claim" className="patient-auth-link">
                                Claim your patient record
                            </Link>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="patient-auth-form" noValidate>
                        {error && (
                            <div className="patient-auth-error" role="alert">
                                {error}
                            </div>
                        )}

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

                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <label htmlFor="password">Password</label>
                                <Link to="/patient/forgot-password" className="patient-auth-link" style={{ fontSize: '0.8rem' }}>
                                    Forgot password?
                                </Link>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
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
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                            {loading ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>

                    <div className="patient-auth-divider">
                        <span>New to the portal?</span>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <Link to="/patient/claim" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', display: 'flex' }}>
                            Claim your patient record
                        </Link>
                    </div>

                    <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        This portal is for patients of Altheon Connect healthcare providers.<br />
                        Your session is secured and your data is protected.
                    </div>
                </div>
            </div>
        </div>
    );
}
