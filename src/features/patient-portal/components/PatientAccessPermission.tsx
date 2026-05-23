import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast } from '../../../shared/components/ui';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';
import { patientPortalService } from '../services/patientPortalService';

const ACCESS_REQUESTS_KEY = ['patient-portal', 'access-requests'] as const;

/**
 * Unified "Access permission" page (Workflow B, patient side).
 *
 * Section 1 — Clinic code (B1): the patient generates a single-use 6-digit
 * code and reads it to the doctor (or shows the QR that encodes it). The
 * doctor types it into their portal to open the chart for 24 hours.
 *
 * Section 2 — Access requests (B2): the inbox of doctors who searched for the
 * patient and requested access; each can be approved or declined here.
 */
function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PatientAccessPermission() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const { formatDateTime } = useFormatDateTime();
    usePageTitle(t('patient_portal.access.document_title'));

    // ── Section 1: clinic code ──────────────────────────────────────────────
    const [code, setCode] = useState<string | null>(null);
    const [expiresIn, setExpiresIn] = useState(0);
    const [issuing, setIssuing] = useState(false);
    const [copied, setCopied] = useState(false);

    const issueCode = useCallback(async () => {
        setIssuing(true);
        setCopied(false);
        try {
            const res = await patientPortalService.issueClinicCode();
            setCode(res.code);
            setExpiresIn(res.expires_in);
        } catch {
            toast.error(t('patient_portal.access.code.error_issue'));
        } finally {
            setIssuing(false);
        }
    }, [t]);

    useEffect(() => { issueCode(); }, [issueCode]);

    useEffect(() => {
        if (expiresIn <= 0) return;
        const tick = setInterval(() => {
            setExpiresIn(prev => {
                if (prev <= 1) {
                    setCode(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [expiresIn]);

    const handleCopy = async () => {
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error(t('patient_portal.access.code.error_copy'));
        }
    };

    const expired = !code || expiresIn <= 0;
    const grouped = code ? `${code.slice(0, 3)} ${code.slice(3)}` : '';

    // ── Section 2: access requests ──────────────────────────────────────────
    const { data, isLoading, isError } = useQuery({
        queryKey: ACCESS_REQUESTS_KEY,
        queryFn: patientPortalService.listAccessRequests,
        staleTime: 30_000,
        refetchInterval: 30_000,
    });

    const approve = useMutation({
        mutationFn: patientPortalService.approveAccessRequest,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ACCESS_REQUESTS_KEY });
            toast.success(t('patient_portal.access.requests.approved_toast'));
        },
        onError: () => toast.error(t('patient_portal.access.requests.error_generic')),
    });

    const reject = useMutation({
        mutationFn: patientPortalService.rejectAccessRequest,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ACCESS_REQUESTS_KEY });
            toast.success(t('patient_portal.access.requests.declined_toast'));
        },
        onError: () => toast.error(t('patient_portal.access.requests.error_generic')),
    });

    const results = data?.results ?? [];

    return (
        <>
            <PageHeader
                title={t('patient_portal.access.title')}
                subtitle={t('patient_portal.access.subtitle')}
            />

            {/* ── Clinic code ─────────────────────────────────────────────── */}
            <SectionCard title={t('patient_portal.access.code.heading')}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
                    {t('patient_portal.access.code.instruction')}
                </div>

                <div
                    style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: '1rem', padding: '0.5rem',
                    }}
                >
                    {expired ? (
                        <div
                            style={{
                                width: '100%', maxWidth: 360, padding: '2rem 1rem',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                                background: 'var(--bg-subtle, #f9fafb)',
                                border: '1px dashed var(--border-muted, #d1d5db)',
                                borderRadius: 12, textAlign: 'center',
                            }}
                        >
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {t('patient_portal.access.code.expired')}
                            </span>
                            <button type="button" className="btn btn-primary" onClick={issueCode} disabled={issuing}>
                                {issuing ? t('patient_portal.common.loading') : t('patient_portal.access.code.generate')}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* The 6-digit code — the primary thing the doctor needs */}
                            <div
                                aria-live="polite"
                                aria-label={code ?? ''}
                                style={{
                                    fontFamily: 'var(--font-mono, monospace)',
                                    fontSize: 'clamp(2.25rem, 8vw, 3.25rem)',
                                    fontWeight: 700,
                                    letterSpacing: '0.18em',
                                    color: 'var(--text-primary)',
                                    lineHeight: 1.1,
                                }}
                            >
                                {grouped}
                            </div>

                            <div style={{ fontSize: '0.875rem', color: expiresIn <= 30 ? 'var(--danger, #dc2626)' : 'var(--text-muted)' }}>
                                {t('patient_portal.access.code.expires_in', { time: formatCountdown(expiresIn) })}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
                                    {copied ? t('patient_portal.access.code.copied') : t('patient_portal.access.code.copy')}
                                </button>
                                <button type="button" className="btn btn-primary btn-sm" onClick={issueCode} disabled={issuing}>
                                    {issuing ? t('patient_portal.common.loading') : t('patient_portal.access.code.refresh')}
                                </button>
                            </div>

                            {/* QR is secondary — for reference only */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <div style={{ background: 'white', padding: 12, borderRadius: 8, border: '1px solid var(--border-muted, #e5e7eb)' }}>
                                    <QRCodeSVG value={code!} size={132} level="M" />
                                </div>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    {t('patient_portal.access.code.qr_hint')}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                <div
                    style={{
                        marginTop: '1rem', padding: '0.75rem 1rem',
                        background: 'var(--bg-subtle, #f9fafb)', borderRadius: 8,
                        fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5,
                    }}
                >
                    {t('patient_portal.access.code.help')}
                </div>
            </SectionCard>

            {/* ── Access requests ─────────────────────────────────────────── */}
            <SectionCard title={t('patient_portal.access.requests.heading')}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                    {t('patient_portal.access.requests.subtitle')}
                </div>

                {isLoading && (
                    <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>{t('patient_portal.common.loading')}</div>
                )}
                {isError && (
                    <div className="error-message" style={{ padding: '1rem' }}>
                        {t('patient_portal.access.requests.error_load')}
                    </div>
                )}
                {!isLoading && !isError && results.length === 0 && (
                    <div style={{ padding: '1.5rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        {t('patient_portal.access.requests.empty')}
                    </div>
                )}
                {results.map(req => {
                    const pending = req.status === 'pending';
                    const isExpired = new Date(req.expires_at).getTime() < Date.now();
                    const showActions = pending && !isExpired;
                    return (
                        <div
                            key={req.id}
                            style={{
                                padding: '1rem 0',
                                borderBottom: '1px solid var(--border-muted, #e5e7eb)',
                                display: 'flex', flexDirection: 'column', gap: '0.5rem',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                                <strong>{t('patient_portal.access.requests.doctor_prefix')} {req.doctor_name}</strong>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    {t(`patient_portal.access.requests.status.${req.status}`, req.status)}
                                    {isExpired && pending ? ` · ${t('patient_portal.access.requests.status.expired')}` : ''}
                                </span>
                            </div>
                            {req.doctor_specialty && (
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{req.doctor_specialty}</div>
                            )}
                            {req.reason && <div style={{ fontSize: '0.875rem' }}>{req.reason}</div>}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {t('patient_portal.access.requests.requested')} {formatDateTime(req.created_at)}
                                {pending && !isExpired && (
                                    <> · {t('patient_portal.access.requests.expires')} {formatDateTime(req.expires_at)}</>
                                )}
                            </div>
                            {showActions && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    <button
                                        type="button" className="btn btn-primary btn-sm"
                                        onClick={() => approve.mutate(req.id)} disabled={approve.isPending}
                                    >
                                        {t('patient_portal.access.requests.approve')}
                                    </button>
                                    <button
                                        type="button" className="btn btn-secondary btn-sm"
                                        onClick={() => reject.mutate(req.id)} disabled={reject.isPending}
                                    >
                                        {t('patient_portal.access.requests.decline')}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </SectionCard>
        </>
    );
}
