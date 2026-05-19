import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast, parseApiError } from '../../../shared/components/ui';
import { redeemClinicCode } from '../services/patientService';

interface Props {
    onAccessGranted: (patientUniqueId: string) => void;
}

/**
 * Workflow B1 — accept the patient's clinic-code token and redeem it for
 * a one-time-visit CareTeamMembership. Camera-based QR scanning is left
 * for a follow-up slice; for now the doctor pastes the token from the
 * patient's screen (or reads it manually) into the input below.
 */
export default function AddPatientScanTab({ onAccessGranted }: Props) {
    const { t } = useTranslation();
    const [token, setToken] = useState('');

    const redeem = useMutation({
        mutationFn: (raw: string) => redeemClinicCode(raw.trim()).then(r => r.data),
        onSuccess: data => {
            toast.success(t(
                'add_patient.scan.success',
                'Access granted for 24 hours.',
            ));
            onAccessGranted(data.patient_unique_id);
        },
        onError: err => {
            toast.error(parseApiError(err, t(
                'add_patient.scan.error.invalid',
                'Clinic code is invalid or has expired. Ask the patient to refresh.',
            )));
        },
    });

    return (
        <div
            style={{
                background: 'var(--bg-card, white)',
                border: '1px solid var(--border-muted, #e5e7eb)',
                borderRadius: 8,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                maxWidth: 540,
            }}
        >
            <label style={{ fontWeight: 500 }}>
                {t('add_patient.scan.token_label', 'Clinic code (from patient\'s app)')}
            </label>
            <textarea
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder={t(
                    'add_patient.scan.token_placeholder',
                    'Paste the patient\'s clinic-code token here…',
                )}
                rows={3}
                style={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    padding: '0.625rem',
                    border: '1px solid var(--border, #d1d5db)',
                    borderRadius: 4,
                    resize: 'vertical',
                }}
            />
            <small style={{ color: 'var(--text-muted)' }}>
                {t(
                    'add_patient.scan.hint_token',
                    'The code expires 60 seconds after the patient generates it. If it has expired, ask them to refresh in Patient → Clinic code.',
                )}
            </small>
            <button
                type="button"
                className="btn btn-primary"
                onClick={() => redeem.mutate(token)}
                disabled={!token.trim() || redeem.isPending}
                style={{ alignSelf: 'flex-start' }}
            >
                {redeem.isPending
                    ? t('add_patient.scan.redeeming', 'Verifying…')
                    : t('add_patient.scan.redeem', 'Verify and open chart')}
            </button>
        </div>
    );
}
