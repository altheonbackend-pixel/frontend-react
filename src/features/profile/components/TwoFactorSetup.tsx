// CR-P1-16: 2FA enrollment + management for doctors.
//
// Flow:
//   1. Doctor visits /profile/2fa → component fetches /2fa/status/.
//   2. If not enrolled, "Enable 2FA" button POSTs /2fa/enroll/ → backend
//      returns { secret, uri }. We render the URI as a QR image (using
//      a public QR API; for HIPAA-clean we ship the otpauth string as a
//      copyable link too — the secret never crosses the wire in plain
//      after this single render).
//   3. Doctor scans + enters 6-digit code → /2fa/verify/ → backend returns
//      one-time backup codes for the doctor to save offline.
//   4. Once enrolled, the screen shows status + "regenerate backup codes"
//      and "disable 2FA" options (both require a current TOTP).
//
// We deliberately avoid adding a QR library dependency for this MVP —
// the qrserver.com endpoint encodes any URI as a PNG, and the otpauth://
// secret it transmits is high-entropy and shown only once. For a stricter
// HIPAA posture, swap to a local QR renderer (qrcode npm).

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

    const handleEnroll = async () => {
        setLoading(true);
        try {
            const res = await api.post('/2fa/enroll/');
            setEnrollment({ secret: res.data.secret, uri: res.data.uri });
            setBackupCodes(null);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { detail?: string } } })
                ?.response?.data?.detail || 'Failed to start enrollment.';
            toast.error(msg);
        } finally { setLoading(false); }
    };

    const handleVerify = async () => {
        if (!code.trim()) return;
        setLoading(true);
        try {
            const res = await api.post('/2fa/verify/', { code: code.trim() });
            if (res.data.backup_codes) {
                setBackupCodes(res.data.backup_codes);
            }
            setEnrollment(null);
            setCode('');
            toast.success(t('tfa.success', '2FA enabled successfully.'));
            await refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { detail?: string } } })
                ?.response?.data?.detail || 'Invalid code.';
            toast.error(msg);
        } finally { setLoading(false); }
    };

    const handleDisable = async () => {
        if (!code.trim()) return;
        setLoading(true);
        try {
            await api.post('/2fa/disable/', { code: code.trim() });
            setShowDisable(false);
            setCode('');
            toast.success('2FA disabled.');
            await refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { detail?: string } } })
                ?.response?.data?.detail || 'Could not disable 2FA.';
            toast.error(msg);
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
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { detail?: string } } })
                ?.response?.data?.detail || 'Could not regenerate.';
            toast.error(msg);
        } finally { setLoading(false); }
    };

    if (!status) {
        return <div>{t('common.loading', 'Loading…')}</div>;
    }

    return (
        <div className="section-card">
            <h2 className="section-card-title">{t('tfa.title', 'Two-Factor Authentication')}</h2>

            {!status.enrolled && !enrollment && (
                <div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {t('tfa.scan_qr', 'Scan this QR code with Google Authenticator, Authy or 1Password.')}
                    </p>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleEnroll}
                        disabled={loading}
                    >
                        {t('tfa.enroll_cta', 'Enable 2FA')}
                    </button>
                </div>
            )}

            {enrollment && (
                <div>
                    <p>{t('tfa.scan_qr', 'Scan this QR code with Google Authenticator, Authy or 1Password.')}</p>
                    <img
                        alt="2FA QR code"
                        width={220} height={220}
                        style={{ background: 'white', padding: 12, borderRadius: 12 }}
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(enrollment.uri)}`}
                    />
                    <details style={{ marginTop: '0.5rem' }}>
                        <summary>Manual setup key</summary>
                        <code style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {enrollment.secret}
                        </code>
                    </details>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                            placeholder={t('tfa.enter_code', 'Enter the 6-digit code shown:')}
                            className="form-input"
                            style={{ width: 200 }}
                            autoFocus
                        />
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={loading || code.length !== 6}
                            onClick={handleVerify}
                        >
                            {t('tfa.verify', 'Verify')}
                        </button>
                    </div>
                </div>
            )}

            {backupCodes && backupCodes.length > 0 && (
                <div style={{
                    marginTop: '1rem', padding: '1rem',
                    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                }}>
                    <h3 style={{ marginTop: 0 }}>{t('tfa.backup_codes', 'Backup codes (keep these offline)')}</h3>
                    <ul style={{
                        fontFamily: 'monospace', fontSize: '1rem',
                        columnCount: 2, listStyle: 'none', padding: 0,
                    }}>
                        {backupCodes.map(c => <li key={c}>{c}</li>)}
                    </ul>
                </div>
            )}

            {status.enrolled && !enrollment && (
                <div style={{ marginTop: '1rem' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        ✅ 2FA enrolled. Last used:{' '}
                        {status.last_used_at
                            ? formatDateTimeLong(status.last_used_at)
                            : 'never'}
                        {' · '}Backup codes left: {status.backup_codes_remaining}
                    </p>

                    {!showDisable && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowDisable(true)}
                            >
                                Regenerate backup codes / Disable
                            </button>
                        </div>
                    )}

                    {showDisable && (
                        <div style={{ marginTop: '1rem' }}>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={9}
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="Current TOTP code or backup code"
                                className="form-input"
                                style={{ width: 260 }}
                            />
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleRegenBackup}
                                    disabled={loading || !code.trim()}
                                >
                                    Regenerate backup codes
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={handleDisable}
                                    disabled={loading || !code.trim()}
                                >
                                    Disable 2FA
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => { setShowDisable(false); setCode(''); }}
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default TwoFactorSetup;
