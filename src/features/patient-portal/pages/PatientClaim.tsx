import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast } from '../../../shared/components/ui';
import { parseApiError } from '../../../shared/components/ui/toast';
import api from '../../../shared/services/api';
import { useAuth } from '../../auth/hooks/useAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'request' | 'sent' | 'verify' | 'complete' | 'done';

interface PatientPreview {
    first_name: string;
    last_name: string;
    email: string;
}

// ── Stepper UI ────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Request access', 'Verify identity', 'Set password'];

function Stepper({ step }: { step: Step }) {
    const idx = step === 'request' || step === 'sent' ? 0 : step === 'verify' ? 1 : 2;
    return (
        <div className="claim-stepper" aria-label="Claim progress">
            {STEP_LABELS.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : undefined }}>
                    <div className={`claim-step ${i < idx ? 'done' : i === idx ? 'active' : ''}`}>
                        <div className="claim-step-dot">
                            {i < idx ? '✓' : i + 1}
                        </div>
                        <span>{label}</span>
                    </div>
                    {i < STEP_LABELS.length - 1 && <div className="claim-step-connector" />}
                </div>
            ))}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PatientClaim() {
    usePageTitle('Claim Your Patient Record');
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();

    const tokenFromUrl = searchParams.get('token') ?? '';

    // Determine initial step based on URL token
    const [step, setStep] = useState<Step>(tokenFromUrl ? 'verify' : 'request');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1 — request
    const [email, setEmail] = useState('');
    const [dob, setDob] = useState('');
    const [last4Phone, setLast4Phone] = useState('');

    // Step 2 — verify
    const [token, setToken] = useState(tokenFromUrl);
    const [preview, setPreview] = useState<PatientPreview | null>(null);

    // Step 3 — complete
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);

    // Auto-verify if token is in URL
    useEffect(() => {
        if (tokenFromUrl) {
            handleVerify(tokenFromUrl);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const clearError = () => setError(null);

    // ── Step 1: Request ────────────────────────────────────────────────────────

    const handleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !dob) return;
        clearError();
        setLoading(true);
        try {
            await api.post('/patient/claim/request/', {
                email: email.trim().toLowerCase(),
                date_of_birth: dob,
                ...(last4Phone.trim() ? { last_4_phone: last4Phone.trim() } : {}),
            });
            setStep('sent');
        } catch (err) {
            // Backend always returns 200 (anti-enumeration) — only real failures reach here
            setError(parseApiError(err, 'Something went wrong. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    // ── Step 2: Verify token ───────────────────────────────────────────────────

    const handleVerify = async (rawToken: string) => {
        if (!rawToken.trim()) {
            setError('Please enter the verification code from your email.');
            return;
        }
        clearError();
        setLoading(true);
        try {
            const res = await api.post('/patient/claim/verify/', { token: rawToken.trim() });
            setPreview(res.data.patient_preview);
            setToken(rawToken.trim());
            setStep('complete');
        } catch (err) {
            setError(parseApiError(err, 'Invalid or expired link. Please request a new one.'));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyForm = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleVerify(token);
    };

    // ── Step 3: Complete ───────────────────────────────────────────────────────

    const handleComplete = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (!termsAccepted || !privacyAccepted) {
            setError('You must accept the Terms of Service and Privacy Notice to continue.');
            return;
        }
        setLoading(true);
        try {
            await api.post('/patient/claim/complete/', {
                token,
                password,
                terms_accepted: true,
                privacy_accepted: true,
            });
            // Auto-login using the email from the preview
            if (preview?.email) {
                try {
                    await login({ email: preview.email, password });
                } catch {
                    // Login failed but account was created — send to login page
                    toast.success('Account created! Please sign in.');
                    navigate('/patient/login', { replace: true });
                    return;
                }
            }
            setStep('done');
            toast.success('Welcome to your patient portal!');
            navigate('/patient/dashboard', { replace: true });
        } catch (err) {
            setError(parseApiError(err, 'Failed to complete setup. Your link may have expired.'));
        } finally {
            setLoading(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

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
                    <div className="patient-auth-headline">Claim your health record.</div>
                    <div className="patient-auth-sub">
                        Your doctor has already created your health record. Claim it to get secure online access — no registration needed.
                    </div>
                    <ul className="patient-auth-features">
                        <li><span className="feature-dot feature-dot--green" />Your records are already on file</li>
                        <li><span className="feature-dot feature-dot--blue" />Verify your identity with your email and date of birth</li>
                        <li><span className="feature-dot feature-dot--purple" />Set your own password and accept the terms</li>
                        <li><span className="feature-dot feature-dot--orange" />Gain instant access to your portal</li>
                    </ul>
                </div>
                <div className="patient-auth-left-footer">
                    Already have an account?{' '}
                    <Link to="/patient/login" className="patient-auth-link">Sign in →</Link>
                </div>
            </div>

            <div className="patient-auth-right">
                <div className="patient-auth-card">

                    {/* ── Step: Request ── */}
                    {(step === 'request') && (
                        <>
                            <div className="patient-auth-card-header">
                                <div className="patient-auth-card-title">Request portal access</div>
                                <div className="patient-auth-card-sub">
                                    Enter the email address and date of birth your doctor has on file. We'll send you a verification link.
                                </div>
                            </div>
                            <Stepper step="request" />
                            <form onSubmit={handleRequest} className="patient-auth-form" noValidate>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}
                                <div className="form-group">
                                    <label htmlFor="email">Email on file with your doctor</label>
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
                                    <label htmlFor="dob">Date of birth</label>
                                    <input
                                        id="dob"
                                        type="date"
                                        value={dob}
                                        onChange={e => setDob(e.target.value)}
                                        disabled={loading}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="last4phone">
                                        Last 4 digits of your phone number{' '}
                                        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(if on file with your doctor)</span>
                                    </label>
                                    <input
                                        id="last4phone"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={4}
                                        value={last4Phone}
                                        onChange={e => setLast4Phone(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder="e.g. 4567"
                                        disabled={loading}
                                        autoComplete="off"
                                    />
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                        Required if your doctor recorded a phone number for you.
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                                    {loading ? 'Sending…' : 'Send verification link'}
                                </button>
                                <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Already have a link?{' '}
                                    <button type="button" className="patient-auth-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', fontSize: '0.82rem' }} onClick={() => { clearError(); setStep('verify'); }}>
                                        Enter it here
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Step: Sent ── */}
                    {step === 'sent' && (
                        <>
                            <div style={{ textAlign: 'center', padding: '1rem 0 0.5rem' }}>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-bg)', display: 'grid', placeItems: 'center', margin: '0 auto 1rem' }}>
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                </div>
                                <div className="patient-auth-card-title">Check your email</div>
                                <div className="patient-auth-card-sub">
                                    If a matching patient record was found, we've sent a verification link to{' '}
                                    <strong>{email || 'your email address'}</strong>. The link expires in 24 hours.
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', margin: '1rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                <strong>Didn't receive it?</strong><br />
                                Check your spam folder. If nothing arrives within a few minutes, confirm the email and date of birth are exactly as given to your doctor.
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={() => { clearError(); setStep('request'); }}
                            >
                                Try again
                            </button>
                            <div className="patient-auth-divider"><span>or</span></div>
                            <div style={{ textAlign: 'center' }}>
                                <button type="button" className="patient-auth-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', fontSize: '0.875rem' }} onClick={() => { clearError(); setStep('verify'); }}>
                                    I have a verification link — enter it manually
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Step: Verify (manual token entry) ── */}
                    {step === 'verify' && !preview && (
                        <>
                            <div className="patient-auth-card-header">
                                <div className="patient-auth-card-title">Enter your verification link</div>
                                <div className="patient-auth-card-sub">Paste the full link or the token from the email your clinic sent you.</div>
                            </div>
                            <Stepper step="verify" />
                            <form onSubmit={handleVerifyForm} className="patient-auth-form" noValidate>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}
                                <div className="form-group">
                                    <label htmlFor="token">Verification token</label>
                                    <input
                                        id="token"
                                        type="text"
                                        value={token}
                                        onChange={e => setToken(e.target.value)}
                                        placeholder="Paste your token here"
                                        disabled={loading}
                                        autoComplete="off"
                                        required
                                    />
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                        You can paste the full URL from the email or just the token portion after <code>?token=</code>
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading || !token.trim()}>
                                    {loading ? 'Verifying…' : 'Verify and continue'}
                                </button>
                                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { clearError(); setStep('request'); }}>
                                    ← Back to request
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Step: Complete ── */}
                    {step === 'complete' && preview && (
                        <>
                            <div className="patient-auth-card-header">
                                <div className="patient-auth-card-title">Set up your account</div>
                                <div className="patient-auth-card-sub">We found your patient record. Create a password to finish setting up your portal.</div>
                            </div>
                            <Stepper step="complete" />

                            <div className="patient-preview-card">
                                <div className="patient-preview-name">{preview.first_name} {preview.last_name}</div>
                                <div className="patient-preview-email">{preview.email}</div>
                            </div>

                            <form onSubmit={handleComplete} className="patient-auth-form" noValidate>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}

                                <div className="form-group">
                                    <label htmlFor="password">Create password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
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
                                    <label htmlFor="confirmPassword">Confirm password</label>
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

                                <div style={{ display: 'grid', gap: '0.75rem', padding: '0.875rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                                    <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={termsAccepted}
                                            onChange={e => setTermsAccepted(e.target.checked)}
                                            style={{ marginTop: '0.1rem', flexShrink: 0 }}
                                        />
                                        I accept the{' '}
                                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Terms of Service</span>
                                    </label>
                                    <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={privacyAccepted}
                                            onChange={e => setPrivacyAccepted(e.target.checked)}
                                            style={{ marginTop: '0.1rem', flexShrink: 0 }}
                                        />
                                        I have read and accept the{' '}
                                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Privacy Notice</span>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    disabled={loading || !termsAccepted || !privacyAccepted}
                                >
                                    {loading ? 'Creating account…' : 'Create account & sign in'}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Bottom link */}
                    {step !== 'done' && (
                        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Already have an account?{' '}
                            <Link to="/patient/login" className="patient-auth-link">Sign in</Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
