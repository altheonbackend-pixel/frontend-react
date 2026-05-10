import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { parseApiError } from '../../../shared/components/ui/toast';
import { toast } from '../../../shared/components/ui';
import api from '../../../shared/services/api';

export default function PatientResetPassword() {
    const { t } = useTranslation();
    usePageTitle(t('patient_portal.auth.reset.document_title'));
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
            setError(t('patient_portal.auth.reset.error.no_token'));
        }
    }, [t, tokenFromUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!token.trim()) {
            setError(t('patient_portal.auth.reset.error.missing_token'));
            return;
        }
        if (newPassword.length < 8) {
            setError(t('patient_portal.auth.error.password_too_short'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError(t('patient_portal.auth.error.passwords_mismatch'));
            return;
        }

        setLoading(true);
        try {
            await api.post('/patient/reset-password/', {
                token: token.trim(),
                new_password: newPassword,
            });
            setDone(true);
            toast.success(t('patient_portal.auth.reset.toast.success'));
            setTimeout(() => navigate('/patient/login', { replace: true }), 2000);
        } catch (err) {
            setError(parseApiError(err, t('patient_portal.auth.reset.error.invalid_link')));
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
                    <div className="patient-auth-headline">{t('patient_portal.auth.reset.headline')}</div>
                    <div className="patient-auth-sub">
                        {t('patient_portal.auth.reset.left_subtitle')}
                    </div>
                </div>
                <div className="patient-auth-left-footer">
                    <Link to="/patient/login" className="patient-auth-link">{t('patient_portal.auth.back_to_sign_in')}</Link>
                </div>
            </div>

            <div className="patient-auth-right">
                <div className="patient-auth-card">
                    {done ? (
                        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-bg)', display: 'grid', placeItems: 'center', margin: '0 auto 1rem' }}>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <div className="patient-auth-card-title">{t('patient_portal.auth.reset.updated_title')}</div>
                            <div className="patient-auth-card-sub" style={{ marginBottom: '1.5rem' }}>
                                {t('patient_portal.auth.reset.updated_subtitle')}
                            </div>
                            <Link to="/patient/login" className="btn btn-primary" style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
                                {t('patient_portal.auth.reset.sign_in_now')}
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="patient-auth-card-header">
                                <div className="patient-auth-card-title">{t('patient_portal.auth.reset.title')}</div>
                                <div className="patient-auth-card-sub">
                                    {t('patient_portal.auth.reset.subtitle')}
                                </div>
                            </div>
                            <form onSubmit={handleSubmit} className="patient-auth-form" noValidate>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}

                                {!tokenFromUrl && (
                                    <div className="form-group">
                                        <label htmlFor="token">{t('patient_portal.auth.reset.token')}</label>
                                        <input
                                            id="token"
                                            type="text"
                                            value={token}
                                            onChange={e => setToken(e.target.value)}
                                            placeholder={t('patient_portal.auth.reset.token_placeholder')}
                                            autoComplete="off"
                                            disabled={loading}
                                        />
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                            {t('patient_portal.auth.reset.token_hint')}
                                        </div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label htmlFor="newPassword">{t('patient_portal.settings.new_password')}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="newPassword"
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder={t('patient_portal.auth.password_min_placeholder')}
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
                                    <label htmlFor="confirmPassword">{t('patient_portal.settings.confirm_new_password')}</label>
                                    <input
                                        id="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder={t('patient_portal.auth.repeat_password_placeholder')}
                                        autoComplete="new-password"
                                        disabled={loading}
                                        required
                                    />
                                </div>

                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                                    {loading ? t('patient_portal.auth.reset.resetting') : t('patient_portal.auth.reset.submit')}
                                </button>

                                <div style={{ textAlign: 'center' }}>
                                    <Link to="/patient/forgot-password" className="patient-auth-link" style={{ fontSize: '0.875rem' }}>
                                        {t('patient_portal.auth.reset.request_new_link')}
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
