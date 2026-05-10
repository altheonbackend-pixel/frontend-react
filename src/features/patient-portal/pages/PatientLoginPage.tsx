import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { parseApiError } from '../../../shared/components/ui/toast';
import { toast } from '../../../shared/components/ui';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

export default function PatientLoginPage() {
    const { t } = useTranslation();
    usePageTitle(t('patient_portal.auth.login.document_title'));
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
            const msg = parseApiError(err, t('patient_portal.auth.error.invalid_credentials'));
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
                    <div className="patient-auth-brand-name">{t('patient_portal.brand.full')}</div>
                </div>
                <div className="patient-auth-left-body">
                    <div className="patient-auth-headline">{t('patient_portal.auth.headline')}</div>
                    <div className="patient-auth-sub">
                        {t('patient_portal.auth.login.left_subtitle')}
                    </div>
                    <ul className="patient-auth-features">
                        <li>
                            <span className="feature-dot feature-dot--green" />
                            {t('patient_portal.auth.features.visit_summaries')}
                        </li>
                        <li>
                            <span className="feature-dot feature-dot--blue" />
                            {t('patient_portal.auth.features.appointments')}
                        </li>
                        <li>
                            <span className="feature-dot feature-dot--purple" />
                            {t('patient_portal.auth.features.medications_labs')}
                        </li>
                        <li>
                            <span className="feature-dot feature-dot--orange" />
                            {t('patient_portal.auth.features.notifications')}
                        </li>
                    </ul>
                </div>
                <div className="patient-auth-left-footer">
                    {t('patient_portal.auth.login.not_patient')} <Link to="/login" className="patient-auth-link">{t('patient_portal.auth.login.doctor_staff_sign_in')}</Link>
                </div>
            </div>

            <div className="patient-auth-right">
                <div className="patient-auth-card">
                    <div className="patient-auth-card-header">
                        <div className="patient-auth-card-title">{t('patient_portal.auth.login.title')}</div>
                        <div className="patient-auth-card-sub">
                            {t('patient_portal.auth.login.new_patient')}{' '}
                            <Link to="/patient/register" className="patient-auth-link">
                                {t('patient_portal.auth.create_account')}
                            </Link>
                            {' '}{t('patient_portal.common.or')}{' '}
                            <Link to="/patient/claim" className="patient-auth-link">
                                {t('patient_portal.auth.claim_existing_record')}
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
                            <label htmlFor="email">{t('patient_portal.auth.email_address')}</label>
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
                                <label htmlFor="password">{t('patient_portal.auth.password')}</label>
                                <Link to="/patient/forgot-password" className="patient-auth-link" style={{ fontSize: '0.8rem' }}>
                                    {t('patient_portal.auth.login.forgot_password')}
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
                                    aria-label={showPassword ? t('patient_portal.auth.hide_password') : t('patient_portal.auth.show_password')}
                                >
                                    {showPassword ? t('patient_portal.common.hide') : t('patient_portal.common.show')}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                            {loading ? t('patient_portal.auth.login.signing_in') : t('patient_portal.auth.sign_in')}
                        </button>
                    </form>

                    <div className="patient-auth-divider">
                        <span>{t('patient_portal.auth.login.new_to_portal')}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <Link to="/patient/register" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                            {t('patient_portal.auth.create_account_short')}
                        </Link>
                        <Link to="/patient/claim" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                            {t('patient_portal.auth.claim_record')}
                        </Link>
                    </div>

                    <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        {t('patient_portal.auth.footer_line1')}<br />
                        {t('patient_portal.auth.footer_line2')}
                    </div>
                </div>
            </div>
        </div>
    );
}
