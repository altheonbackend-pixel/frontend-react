import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const STEP_LABEL_KEYS = [
    'patient_portal.claim.steps.request',
    'patient_portal.claim.steps.verify',
    'patient_portal.claim.steps.password',
] as const;

function extractClaimToken(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
        const url = new URL(trimmed);
        return url.searchParams.get('token')?.trim() || trimmed;
    } catch {
        const tokenMatch = trimmed.match(/[?&]token=([^&]+)/);
        return tokenMatch?.[1] ? decodeURIComponent(tokenMatch[1]).trim() : trimmed;
    }
}

function Stepper({ step }: { step: Step }) {
    const { t } = useTranslation();
    const idx = step === 'request' || step === 'sent' ? 0 : step === 'verify' ? 1 : 2;
    return (
        <div className="claim-stepper" aria-label={t('patient_portal.claim.progress')}>
            {STEP_LABEL_KEYS.map((labelKey, i) => (
                <div key={labelKey} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABEL_KEYS.length - 1 ? 1 : undefined }}>
                    <div className={`claim-step ${i < idx ? 'done' : i === idx ? 'active' : ''}`}>
                        <div className="claim-step-dot">
                            {i < idx ? '✓' : i + 1}
                        </div>
                        <span>{t(labelKey)}</span>
                    </div>
                    {i < STEP_LABEL_KEYS.length - 1 && <div className="claim-step-connector" />}
                </div>
            ))}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PatientClaim() {
    const { t } = useTranslation();
    usePageTitle(t('patient_portal.claim.document_title'));
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
        if (!email.trim()) return;
        clearError();
        setLoading(true);
        try {
            await api.post('/patient/claim/request/', {
                email: email.trim().toLowerCase(),
                ...(dob ? { date_of_birth: dob } : {}),
                ...(last4Phone.trim() ? { last_4_phone: last4Phone.trim() } : {}),
            });
            setStep('sent');
        } catch (err) {
            // Backend returns 200 for anti-enumeration; only validation errors reach here
            setError(parseApiError(err, t('patient_portal.common.error.generic_retry')));
        } finally {
            setLoading(false);
        }
    };

    // ── Step 2: Verify token ───────────────────────────────────────────────────

    const handleVerify = async (rawToken: string) => {
        const cleanToken = extractClaimToken(rawToken);
        if (!cleanToken) {
            setError(t('patient_portal.claim.error.enter_verification_code'));
            return;
        }
        clearError();
        setLoading(true);
        try {
            const res = await api.post('/patient/claim/verify/', { token: cleanToken });
            setPreview(res.data.patient_preview);
            setToken(cleanToken);
            setStep('complete');
        } catch (err) {
            setError(parseApiError(err, t('patient_portal.claim.error.invalid_or_expired')));
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
            setError(t('patient_portal.auth.error.password_too_short'));
            return;
        }
        if (password !== confirmPassword) {
            setError(t('patient_portal.auth.error.passwords_mismatch'));
            return;
        }
        if (!termsAccepted || !privacyAccepted) {
            setError(t('patient_portal.claim.error.accept_terms_privacy'));
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/patient/claim/complete/', {
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
                    toast.success(t('patient_portal.claim.toast.account_created_sign_in'));
                    navigate('/patient/login', { replace: true });
                    return;
                }
            }
            toast.success(t('patient_portal.claim.toast.welcome'));
            const missingFields: string[] = res.data.missing_fields || [];
            if (missingFields.length > 0) {
                navigate(`/patient/complete-profile?fields=${missingFields.join(',')}`, { replace: true });
            } else {
                navigate('/patient/dashboard', { replace: true });
            }
        } catch (err) {
            setError(parseApiError(err, t('patient_portal.claim.error.complete_failed')));
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
                    <div className="patient-auth-brand-name">{t('patient_portal.brand.full')}</div>
                </div>
                <div className="patient-auth-left-body">
                    <div className="patient-auth-headline">{t('patient_portal.claim.headline')}</div>
                    <div className="patient-auth-sub">
                        {t('patient_portal.claim.subtitle')}
                    </div>
                    <ul className="patient-auth-features">
                        <li><span className="feature-dot feature-dot--green" />{t('patient_portal.claim.features.records_on_file')}</li>
                        <li><span className="feature-dot feature-dot--blue" />{t('patient_portal.claim.features.verify_identity')}</li>
                        <li><span className="feature-dot feature-dot--purple" />{t('patient_portal.claim.features.set_password')}</li>
                        <li><span className="feature-dot feature-dot--orange" />{t('patient_portal.claim.features.instant_access')}</li>
                    </ul>
                </div>
                <div className="patient-auth-left-footer">
                    {t('patient_portal.auth.have_account')}{' '}
                    <Link to="/patient/login" className="patient-auth-link">{t('patient_portal.auth.sign_in_arrow')}</Link>
                </div>
            </div>

            <div className="patient-auth-right">
                <div className="patient-auth-card">

                    {/* ── Step: Request ── */}
                    {(step === 'request') && (
                        <>
                            <div className="patient-auth-card-header">
                                <div className="patient-auth-card-title">{t('patient_portal.claim.request.title')}</div>
                                <div className="patient-auth-card-sub">
                                    {t('patient_portal.claim.request.subtitle')}
                                </div>
                            </div>
                            <Stepper step="request" />
                            <form onSubmit={handleRequest} className="patient-auth-form" noValidate>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}
                                <div className="form-group">
                                    <label htmlFor="email">{t('patient_portal.claim.request.email_on_file')}</label>
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
                                    <label htmlFor="dob">
                                        {t('patient_portal.profile.date_of_birth')}{' '}
                                        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{t('patient_portal.claim.request.if_doctor_has_on_file')}</span>
                                    </label>
                                    <input
                                        id="dob"
                                        type="date"
                                        value={dob}
                                        onChange={e => setDob(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="last4phone">
                                        {t('patient_portal.claim.request.last_4_phone')}{' '}
                                        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{t('patient_portal.claim.request.if_on_file')}</span>
                                    </label>
                                    <input
                                        id="last4phone"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={4}
                                        value={last4Phone}
                                        onChange={e => setLast4Phone(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder={t('patient_portal.claim.request.phone_placeholder')}
                                        disabled={loading}
                                        autoComplete="off"
                                    />
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                        {t('patient_portal.claim.request.phone_hint')}
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                                    {loading ? t('patient_portal.claim.request.sending') : t('patient_portal.claim.request.send_link')}
                                </button>
                                <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    {t('patient_portal.claim.request.already_have_link')}{' '}
                                    <button type="button" className="patient-auth-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', fontSize: '0.82rem' }} onClick={() => { clearError(); setStep('verify'); }}>
                                        {t('patient_portal.claim.request.enter_it_here')}
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
                                <div className="patient-auth-card-title">{t('patient_portal.claim.sent.title')}</div>
                                <div className="patient-auth-card-sub">
                                    {t('patient_portal.claim.sent.subtitle_prefix')}{' '}
                                    <strong>{email || t('patient_portal.claim.sent.your_email_address')}</strong>. {t('patient_portal.claim.sent.expires')}
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', margin: '1rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                <strong>{t('patient_portal.claim.sent.didnt_receive')}</strong><br />
                                {t('patient_portal.claim.sent.check_spam')}
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={() => { clearError(); setStep('request'); }}
                            >
                                {t('patient_portal.common.try_again')}
                            </button>
                            <div className="patient-auth-divider"><span>{t('patient_portal.common.or')}</span></div>
                            <div style={{ textAlign: 'center' }}>
                                <button type="button" className="patient-auth-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', fontSize: '0.875rem' }} onClick={() => { clearError(); setStep('verify'); }}>
                                    {t('patient_portal.claim.sent.enter_manually')}
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Step: Verify (manual token entry) ── */}
                    {step === 'verify' && !preview && (
                        <>
                            <div className="patient-auth-card-header">
                                <div className="patient-auth-card-title">{t('patient_portal.claim.verify.title')}</div>
                                <div className="patient-auth-card-sub">{t('patient_portal.claim.verify.subtitle')}</div>
                            </div>
                            <Stepper step="verify" />
                            <form onSubmit={handleVerifyForm} className="patient-auth-form" noValidate>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}
                                <div className="form-group">
                                    <label htmlFor="token">{t('patient_portal.claim.verify.token')}</label>
                                    <input
                                        id="token"
                                        type="text"
                                        value={token}
                                        onChange={e => setToken(e.target.value)}
                                        placeholder={t('patient_portal.claim.verify.token_placeholder')}
                                        disabled={loading}
                                        autoComplete="off"
                                        required
                                    />
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                        {t('patient_portal.claim.verify.token_hint')} <code>?token=</code>
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading || !token.trim()}>
                                    {loading ? t('patient_portal.claim.verify.verifying') : t('patient_portal.claim.verify.continue')}
                                </button>
                                <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { clearError(); setStep('request'); }}>
                                    {t('patient_portal.claim.verify.back_to_request')}
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Step: Complete ── */}
                    {step === 'complete' && preview && (
                        <>
                            <div className="patient-auth-card-header">
                                <div className="patient-auth-card-title">{t('patient_portal.claim.complete.title')}</div>
                                <div className="patient-auth-card-sub">{t('patient_portal.claim.complete.subtitle')}</div>
                            </div>
                            <Stepper step="complete" />

                            <div className="patient-preview-card">
                                <div className="patient-preview-name">{preview.first_name} {preview.last_name}</div>
                                <div className="patient-preview-email">{preview.email}</div>
                            </div>

                            <form onSubmit={handleComplete} className="patient-auth-form" noValidate>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}

                                <div className="form-group">
                                    <label htmlFor="password">{t('patient_portal.auth.create_password')}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder={t('patient_portal.auth.minimum_8_characters')}
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
                                            {showPassword ? t('patient_portal.common.hide') : t('patient_portal.common.show')}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="confirmPassword">{t('patient_portal.auth.confirm_password')}</label>
                                    <input
                                        id="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder={t('patient_portal.auth.repeat_password')}
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
                                        {t('patient_portal.claim.complete.accept_terms')}{' '}
                                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('patient_portal.auth.register.terms')}</span>
                                    </label>
                                    <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={privacyAccepted}
                                            onChange={e => setPrivacyAccepted(e.target.checked)}
                                            style={{ marginTop: '0.1rem', flexShrink: 0 }}
                                        />
                                        {t('patient_portal.claim.complete.accept_privacy')}{' '}
                                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('patient_portal.auth.register.privacy')}</span>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    disabled={loading || !termsAccepted || !privacyAccepted}
                                >
                                    {loading ? t('patient_portal.auth.register.creating_account') : t('patient_portal.claim.complete.create_and_sign_in')}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Bottom link */}
                    {step !== 'done' && (
                        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {t('patient_portal.auth.have_account')}{' '}
                            <Link to="/patient/login" className="patient-auth-link">{t('patient_portal.auth.sign_in')}</Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
