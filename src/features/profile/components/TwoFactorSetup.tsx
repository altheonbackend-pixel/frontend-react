// CR-P1-16: 2FA enrollment + management for doctors, rendered inside the
// Security section of the Settings page.
//
// Flow:
//   1. Component fetches /2fa/status/.
//   2. If not enrolled, "Enable 2FA" POSTs /2fa/enroll/ → { secret, uri }.
//      We render the otpauth URI as a QR (qrserver.com) plus a copyable key.
//   3. Doctor enters the 6-digit code → /2fa/verify/ → backend returns
//      one-time backup codes to store offline.
//   4. Once enrolled: status + regenerate backup codes / disable (both
//      require a current TOTP or backup code).

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { toast } from '../../../shared/components/ui';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';

type Status = {
    enrolled: boolean;
    last_used_at: string | null;
    backup_codes_remaining: number;
};

export function TwoFactorSetup() {
    const { t } = useTranslation();
    const { formatDateTimeLong } = useFormatDateTime();
    const [status, setStatus] = useState<Status | null>(null);
    const [loading, setLoading] = useState(false);
    const [enrollment, setEnrollment] = useState<{ secret: string; uri: string } | null>(null);
    const [code, setCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
    const [showDisable, setShowDisable] = useState(false);

    const refresh = async () => {
        const res = await api.get('/2fa/status/');
        setStatus(res.data);
    };

    useEffect(() => { refresh().catch(() => undefined); }, []);

    const errMsg = (err: unknown, fallback: string) =>
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;

    const handleEnroll = async () => {
        setLoading(true);
        try {
            const res = await api.post('/2fa/enroll/');
            setEnrollment({ secret: res.data.secret, uri: res.data.uri });
            setBackupCodes(null);
        } catch (err) {
            toast.error(errMsg(err, t('tfa.error.enroll')));
        } finally { setLoading(false); }
    };

    const handleVerify = async () => {
        if (!code.trim()) return;
        setLoading(true);
        try {
            const res = await api.post('/2fa/verify/', { code: code.trim() });
            if (res.data.backup_codes) setBackupCodes(res.data.backup_codes);
            setEnrollment(null);
            setCode('');
            toast.success(t('tfa.success'));
            await refresh();
        } catch (err) {
            toast.error(errMsg(err, t('tfa.error.invalid_code')));
        } finally { setLoading(false); }
    };

    const handleDisable = async () => {
        if (!code.trim()) return;
        setLoading(true);
        try {
            await api.post('/2fa/disable/', { code: code.trim() });
            setShowDisable(false);
            setCode('');
            toast.success(t('tfa.disabled'));
            await refresh();
        } catch (err) {
            toast.error(errMsg(err, t('tfa.error.disable')));
        } finally { setLoading(false); }
    };

    const handleRegenBackup = async () => {
        if (!code.trim()) return;
        setLoading(true);
        try {
            const res = await api.post('/2fa/backup-codes/', { code: code.trim() });
            setBackupCodes(res.data.backup_codes);
            setCode('');
            await refresh();
        } catch (err) {
            toast.error(errMsg(err, t('tfa.error.regenerate')));
        } finally { setLoading(false); }
    };

    return (
        <div className="settings-card">
            <div className="settings-card-head">
                <h2 className="settings-card-title">{t('tfa.title')}</h2>
                <p className="settings-card-subtitle">{t('tfa.intro')}</p>
            </div>

            <div className="settings-card-body">
                {status && (
                    <div className="tfa-status-line">
                        <span className={`tfa-badge ${status.enrolled ? 'on' : 'off'}`}>
                            {status.enrolled ? t('tfa.status_on') : t('tfa.status_off')}
                        </span>
                        {status.enrolled && (
                            <span>
                                {t('tfa.last_used')}: {status.last_used_at ? formatDateTimeLong(status.last_used_at) : t('tfa.never')}
                                {' · '}
                                {t('tfa.backup_remaining', { count: status.backup_codes_remaining })}
                            </span>
                        )}
                    </div>
                )}

                {!status && <div>{t('common.loading')}</div>}

                {/* Not enrolled — offer to start */}
                {status && !status.enrolled && !enrollment && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleEnroll} disabled={loading}>
                        {t('tfa.enroll_cta')}
                    </button>
                )}

                {/* Enrollment in progress — show QR + verify */}
                {enrollment && (
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t('tfa.scan_qr')}</p>
                        <img
                            alt={t('tfa.qr_alt')}
                            width={200} height={200}
                            style={{ background: 'white', padding: 12, borderRadius: 12 }}
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(enrollment.uri)}`}
                        />
                        <details style={{ marginTop: '0.5rem' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '0.85rem' }}>{t('tfa.manual_key')}</summary>
                            <code style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                                {enrollment.secret}
                            </code>
                        </details>
                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={code}
                                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                                placeholder={t('tfa.enter_code')}
                                className="input"
                                style={{ width: 200 }}
                                autoFocus
                            />
                            <button type="button" className="btn btn-primary btn-sm" disabled={loading || code.length !== 6} onClick={handleVerify}>
                                {t('tfa.verify')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Freshly generated backup codes */}
                {backupCodes && backupCodes.length > 0 && (
                    <div className="tfa-backup-codes">
                        <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>{t('tfa.backup_codes')}</h3>
                        <ul>{backupCodes.map(c => <li key={c}>{c}</li>)}</ul>
                    </div>
                )}

                {/* Enrolled — manage */}
                {status && status.enrolled && !enrollment && (
                    <div style={{ marginTop: backupCodes ? '1rem' : 0 }}>
                        {!showDisable ? (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowDisable(true)}>
                                {t('tfa.manage_cta')}
                            </button>
                        ) : (
                            <div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={9}
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                    placeholder={t('tfa.code_or_backup')}
                                    className="input"
                                    style={{ width: 260, maxWidth: '100%' }}
                                />
                                <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleRegenBackup} disabled={loading || !code.trim()}>
                                        {t('tfa.regenerate_backup')}
                                    </button>
                                    <button type="button" className="btn btn-danger btn-sm" onClick={handleDisable} disabled={loading || !code.trim()}>
                                        {t('tfa.disable')}
                                    </button>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowDisable(false); setCode(''); }}>
                                        {t('common.cancel')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default TwoFactorSetup;
