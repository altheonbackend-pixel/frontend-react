import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast, parseApiError } from '../../../shared/components/ui';
import { redeemClinicCode } from '../services/patientService';

interface Props {
    onAccessGranted: (patientUniqueId: string) => void;
}

/**
 * Workflow B1 — the patient shows a single-use 6-digit code in their portal
 * (Account → Access permission). The doctor types it here to redeem a 24-hour
 * one-time-visit CareTeamMembership and open the chart.
 */
export default function AddPatientScanTab({ onAccessGranted }: Props) {
    const { t } = useTranslation();
    const [code, setCode] = useState('');

    const redeem = useMutation({
        mutationFn: (raw: string) => redeemClinicCode(raw).then(r => r.data),
        onSuccess: data => {
            toast.success(t('add_patient.scan.success', 'Access granted for 24 hours.'));
            onAccessGranted(data.patient_unique_id);
        },
        onError: err => {
            toast.error(parseApiError(err, t(
                'add_patient.scan.error.invalid',
                'That code is invalid or has expired. Ask the patient to refresh and read you the new one.',
            )));
        },
    });

    const submit = () => {
        if (code.length === 6) redeem.mutate(code);
    };

    return (
        <div
            style={{
                background: 'var(--bg-card, white)',
                border: '1px solid var(--border-muted, #e5e7eb)',
                borderRadius: 8,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                maxWidth: 540,
            }}
        >
            {/* How-to guidance for the doctor */}
            <ol
                style={{
                    margin: 0,
                    paddingLeft: '1.25rem',
                    color: 'var(--text-secondary, #4b5563)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                }}
            >
                <li>{t('add_patient.scan.step1', 'Ask the patient to open the Altheon app and go to Account → Access permission.')}</li>
                <li>{t('add_patient.scan.step2', 'They will see a 6-digit code (and a QR). Ask them to read you the 6 digits.')}</li>
                <li>{t('add_patient.scan.step3', 'Enter the code below within 5 minutes to open their chart.')}</li>
            </ol>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="clinic-code-input" style={{ fontWeight: 500 }}>
                    {t('add_patient.scan.code_label', "Patient's 6-digit code")}
                </label>
                <input
                    id="clinic-code-input"
                    value={code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="123 456"
                    aria-label={t('add_patient.scan.code_label', "Patient's 6-digit code")}
                    style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.3em',
                        textAlign: 'center',
                        padding: '0.75rem',
                        border: '1px solid var(--border, #d1d5db)',
                        borderRadius: 8,
                        maxWidth: 260,
                    }}
                />
                <small style={{ color: 'var(--text-muted)' }}>
                    {t(
                        'add_patient.scan.hint_code',
                        'The code expires 5 minutes after the patient generates it. If it has expired, ask them to tap Refresh.',
                    )}
                </small>
            </div>

            <button
                type="button"
                className="btn btn-primary"
                onClick={submit}
                disabled={code.length !== 6 || redeem.isPending}
                style={{ alignSelf: 'flex-start' }}
            >
                {redeem.isPending
                    ? t('add_patient.scan.redeeming', 'Verifying…')
                    : t('add_patient.scan.redeem', 'Verify and open chart')}
            </button>
        </div>
    );
}
