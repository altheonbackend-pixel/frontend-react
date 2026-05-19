import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast } from '../../../shared/components/ui';
import { patientPortalService } from '../services/patientPortalService';

/**
 * Workflow B1 — patient generates a 60-second signed token (token contains
 * the patient_id; backend's `TimestampSigner` enforces expiry). The patient
 * shows the QR (or types the token aloud) to a doctor who scans/types it
 * into the doctor portal; the backend mints a `CareTeamMembership(role=
 * one_time_visit)` good for 24 hours.
 *
 * Code is single-use in practice (the doctor's redeem creates a membership
 * the moment they submit). The 60-second clock is a defence-in-depth in case
 * someone screen-captures and re-uses the QR.
 */
export default function PatientClinicCode() {
    const { t } = useTranslation();
    usePageTitle(t('patient_portal.clinic_code.document_title', 'Clinic code'));

    const [token, setToken] = useState<string | null>(null);
    const [expiresIn, setExpiresIn] = useState<number>(0);
    const [issuing, setIssuing] = useState(false);
    const [copied, setCopied] = useState(false);

    const issueCode = useCallback(async () => {
        setIssuing(true);
        setCopied(false);
        try {
            const res = await patientPortalService.issueClinicCode();
            setToken(res.token);
            setExpiresIn(res.expires_in);
        } catch {
            toast.error(t(
                'patient_portal.clinic_code.error.issue_failed',
                'Could not generate a clinic code. Please try again.',
            ));
        } finally {
            setIssuing(false);
        }
    }, [t]);

    // Auto-issue on first mount.
    useEffect(() => {
        issueCode();
    }, [issueCode]);

    // Countdown.
    useEffect(() => {
        if (expiresIn <= 0) return;
        const tick = setInterval(() => {
            setExpiresIn(prev => {
                if (prev <= 1) {
                    setToken(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [expiresIn]);

    const handleCopy = async () => {
        if (!token) return;
        try {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error(t('patient_portal.clinic_code.error.copy_failed', 'Copy failed.'));
        }
    };

    const expired = !token || expiresIn <= 0;

    return (
        <>
            <PageHeader
                title={t('patient_portal.clinic_code.title', 'Clinic code')}
                subtitle={t(
                    'patient_portal.clinic_code.subtitle',
                    'Show this code to your doctor at the start of a visit. It expires in 60 seconds and grants 24 hours of access to your records.',
                )}
            />
            <SectionCard>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1rem',
                    }}
                >
                    {expired ? (
                        <div
                            style={{
                                width: 200, height: 200,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'var(--bg-muted, #f3f4f6)',
                                border: '1px dashed var(--border-muted, #d1d5db)',
                                borderRadius: 8,
                                color: 'var(--text-muted, #6b7280)',
                                fontSize: '0.875rem',
                                textAlign: 'center',
                                padding: '1rem',
                            }}
                        >
                            {t('patient_portal.clinic_code.expired', 'Code expired. Generate a new one.')}
                        </div>
                    ) : (
                        <div style={{ background: 'white', padding: 16, borderRadius: 8 }}>
                            <QRCodeSVG value={token!} size={200} level="M" />
                        </div>
                    )}

                    {!expired && (
                        <>
                            <div
                                aria-live="polite"
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    maxWidth: 320,
                                    overflowWrap: 'break-word',
                                    textAlign: 'center',
                                }}
                            >
                                {token}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                {t('patient_portal.clinic_code.expires_in', 'Expires in {{n}}s', { n: expiresIn })}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
                                    {copied
                                        ? t('patient_portal.clinic_code.copied', 'Copied')
                                        : t('patient_portal.clinic_code.copy', 'Copy code')}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={issueCode}
                                    disabled={issuing}
                                >
                                    {issuing
                                        ? t('common.loading', 'Loading…')
                                        : t('patient_portal.clinic_code.refresh', 'Refresh')}
                                </button>
                            </div>
                        </>
                    )}

                    {expired && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={issueCode}
                            disabled={issuing}
                        >
                            {issuing
                                ? t('common.loading', 'Loading…')
                                : t('patient_portal.clinic_code.generate', 'Generate clinic code')}
                        </button>
                    )}
                </div>

                <div
                    style={{
                        marginTop: '1rem',
                        padding: '0.75rem 1rem',
                        background: 'var(--bg-muted, #f9fafb)',
                        borderRadius: 6,
                        fontSize: '0.875rem',
                        color: 'var(--text-muted, #4b5563)',
                        lineHeight: 1.5,
                    }}
                >
                    {t(
                        'patient_portal.clinic_code.help',
                        'Only show this code to a doctor you trust. Once scanned, the doctor gains read access to your medical records for 24 hours. You can review and revoke access at any time from the Privacy tab.',
                    )}
                </div>
            </SectionCard>
        </>
    );
}
