// src/features/auth/components/PendingApproval.tsx
// Status screen for doctors who are authenticated but not yet admin-approved.
// Covers both 'pending_admin' (awaiting review) and 'rejected' (with reason) states.

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import api from '../../../shared/services/api';
import '../styles/Auth.css';

type Status = 'pending_admin' | 'active' | 'rejected';

export default function PendingApproval() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { logout, isAuthenticated, authIsLoading } = useAuth();

    const [status, setStatus] = useState<Status | null>(null);
    const [reason, setReason] = useState<string>('');
    const [name, setName] = useState<string>('');
    const [checking, setChecking] = useState(false);
    const [checkedOnce, setCheckedOnce] = useState(false);

    const refresh = useCallback(async () => {
        setChecking(true);
        try {
            const res = await api.get('/me/');
            if (res.data?.user_type !== 'doctor') {
                // Not a doctor session — bounce to the right place.
                navigate('/login', { replace: true });
                return;
            }
            const profile = res.data.profile ?? {};
            const vs: Status = profile.verification_status ?? 'active';
            setStatus(vs);
            setReason(profile.rejection_reason ?? '');
            setName(res.data.user?.full_name ?? '');
            if (vs === 'active') {
                // Approved while waiting — reload the session so AuthContext hydrates
                // the full profile, then land on the dashboard.
                window.location.assign('/dashboard');
            }
        } catch {
            navigate('/login', { replace: true });
        } finally {
            setChecking(false);
            setCheckedOnce(true);
        }
    }, [navigate]);

    useEffect(() => {
        if (authIsLoading) return;
        if (!isAuthenticated) {
            navigate('/login', { replace: true });
            return;
        }
        refresh();
    }, [authIsLoading, isAuthenticated, refresh, navigate]);

    const isRejected = status === 'rejected';
    const icon = isRejected ? '⛔' : '⏳';

    return (
        <div className="auth-split">
            <div className="auth-split-left">
                <div className="auth-split-monogram">A</div>
                <div className="auth-split-brand">
                    <div className="auth-split-title">{t('brand.full')}</div>
                    <div className="auth-split-subtitle">{t('pending_approval.left_subtitle')}</div>
                </div>
            </div>

            <div className="auth-split-right">
                <div className="auth-card-v2" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{icon}</div>

                    <h2 className="auth-card-v2-title">
                        {isRejected ? t('pending_approval.title_rejected') : t('pending_approval.title_pending')}
                    </h2>
                    <p className="auth-card-v2-subtitle">
                        {name ? t('pending_approval.greeting', { name }) + ' ' : ''}
                        {isRejected ? t('pending_approval.subtitle_rejected') : t('pending_approval.subtitle_pending')}
                    </p>

                    {isRejected && reason && (
                        <div
                            className="error-message"
                            style={{ textAlign: 'left', marginTop: '0.5rem' }}
                        >
                            <strong>{t('pending_approval.reason_label')}:</strong> {reason}
                        </div>
                    )}

                    {!isRejected && checkedOnce && (
                        <div
                            style={{
                                marginTop: '0.5rem',
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                background: 'var(--surface-2, #f4f6f8)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.85rem',
                            }}
                        >
                            {t('pending_approval.email_notice')}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1.25rem' }}>
                        {!isRejected && (
                            <button
                                type="button"
                                className="btn btn-primary btn-lg btn-full"
                                onClick={refresh}
                                disabled={checking}
                            >
                                {checking ? t('pending_approval.checking') : t('pending_approval.check_status')}
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn btn-secondary btn-lg btn-full"
                            onClick={() => { logout(); navigate('/login', { replace: true }); }}
                        >
                            {t('pending_approval.logout')}
                        </button>
                    </div>

                    <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {t('pending_approval.contact')}
                    </p>
                </div>
            </div>
        </div>
    );
}
