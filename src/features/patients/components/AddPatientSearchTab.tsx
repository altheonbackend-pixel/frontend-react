import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { toast, parseApiError } from '../../../shared/components/ui';
import {
    createAccessRequest,
    globalPatientSearch,
    verifyAccessOtp,
    type AccessRequest,
    type MaskedPatientCard,
} from '../services/patientService';

interface Props {
    onAccessGranted: (patientUniqueId: string) => void;
    /**
     * Pre-fill the email field and auto-run the search — used when the doctor
     * is handed off here from the Register-new form after it detected that the
     * entered email already belongs to an existing Altheon account.
     */
    initialEmail?: string;
}

type DeliveryMethod = 'push' | 'in_person';

/**
 * Workflow B-search + B2 — find a patient across all clinics and request
 * access. The doctor enters one of (email | phone | last_name+DOB);
 * backend returns masked identity cards (no medical data). Picking a card
 * opens the access-request flow:
 *   - delivery_method='push'  → patient gets a notification with the OTP,
 *     reads it back to the doctor who enters it here.
 *   - delivery_method='in_person' → backend returns the OTP to the doctor
 *     for them to read aloud; patient enters it on their phone.
 *
 * On successful OTP verify, backend mints CareTeamMembership(role=
 * one_time_visit, 24h) and we navigate to the patient detail page.
 */
export default function AddPatientSearchTab({ onAccessGranted, initialEmail }: Props) {
    const { t } = useTranslation();
    const [email, setEmail] = useState(initialEmail ?? '');
    const [phone, setPhone] = useState('');
    const [lastName, setLastName] = useState('');
    const [dob, setDob] = useState('');
    const [results, setResults] = useState<MaskedPatientCard[] | null>(null);
    const [selectedCard, setSelectedCard] = useState<MaskedPatientCard | null>(null);

    const [request, setRequest] = useState<AccessRequest | null>(null);
    const [otpInput, setOtpInput] = useState('');
    const [reason, setReason] = useState('');
    const [delivery, setDelivery] = useState<DeliveryMethod>('push');

    const search = useMutation({
        mutationFn: () =>
            globalPatientSearch({
                email: email.trim() || undefined,
                phone: phone.trim() || undefined,
                last_name: lastName.trim() || undefined,
                date_of_birth: dob || undefined,
            }).then(r => r.data),
        onSuccess: data => {
            setResults(data.results);
            setSelectedCard(null);
            setRequest(null);
            if (data.results.length === 0) {
                toast.info(t(
                    'add_patient.search.no_results',
                    'No matching patient found. Try a different field or use Register new.',
                ));
            }
        },
        onError: err => {
            toast.error(parseApiError(err, t(
                'add_patient.search.error',
                'Search failed.',
            )));
        },
    });

    const startRequest = useMutation({
        mutationFn: () =>
            createAccessRequest({
                patient_unique_id: selectedCard!.unique_id,
                delivery_method: delivery,
                reason: reason.trim() || undefined,
            }).then(r => r.data),
        onSuccess: data => {
            setRequest(data);
            if (data.otp) {
                toast.success(t(
                    'add_patient.search.otp_for_patient',
                    'Tell the patient this code so they can read it back to confirm.',
                ));
            } else {
                toast.success(t(
                    'add_patient.search.notification_sent',
                    'Code sent to the patient. Ask them to read it to you.',
                ));
            }
        },
        onError: err => {
            toast.error(parseApiError(err, t(
                'add_patient.search.request_error',
                'Could not create access request.',
            )));
        },
    });

    const verifyOtp = useMutation({
        mutationFn: () =>
            verifyAccessOtp(request!.id, otpInput.trim()).then(r => r.data),
        onSuccess: () => {
            toast.success(t(
                'add_patient.search.access_granted',
                'Access granted for 24 hours.',
            ));
            onAccessGranted(selectedCard!.unique_id);
        },
        onError: err => {
            toast.error(parseApiError(err, t(
                'add_patient.search.otp_error',
                'OTP did not match. Try again.',
            )));
        },
    });

    // Auto-run the search once when handed an email from the Register-new form.
    const autoSearchedRef = useRef(false);
    useEffect(() => {
        if (autoSearchedRef.current) return;
        if (initialEmail && initialEmail.trim()) {
            autoSearchedRef.current = true;
            search.mutate();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialEmail]);

    const canSearch = email.trim() || phone.trim() || (lastName.trim() && dob);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 640 }}>
            {/* Search form */}
            <div
                style={{
                    background: 'var(--bg-card, white)',
                    border: '1px solid var(--border-muted, #e5e7eb)',
                    borderRadius: 8,
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <label>
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                            {t('add_patient.search.email', 'Email')}
                        </div>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 4 }}
                        />
                    </label>
                    <label>
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                            {t('add_patient.search.phone', 'Phone')}
                        </div>
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 4 }}
                        />
                    </label>
                    <label>
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                            {t('add_patient.search.last_name', 'Last name')}
                        </div>
                        <input
                            type="text"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 4 }}
                        />
                    </label>
                    <label>
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                            {t('add_patient.search.dob', 'Date of birth')}
                        </div>
                        <input
                            type="date"
                            value={dob}
                            onChange={e => setDob(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 4 }}
                        />
                    </label>
                </div>
                <small style={{ color: 'var(--text-muted)' }}>
                    {t(
                        'add_patient.search.criteria_hint',
                        'Provide email OR phone OR (last name AND date of birth). Search matches are exact.',
                    )}
                </small>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => search.mutate()}
                    disabled={!canSearch || search.isPending}
                    style={{ alignSelf: 'flex-start' }}
                >
                    {search.isPending
                        ? t('add_patient.search.searching', 'Searching…')
                        : t('add_patient.search.button', 'Search')}
                </button>
            </div>

            {/* Results */}
            {results !== null && (
                <div>
                    <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>
                        {t('add_patient.search.results', 'Results ({{n}})', { n: results.length })}
                    </h2>
                    {results.length === 0 && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            {t('add_patient.search.empty', 'No matching patient found.')}
                        </div>
                    )}
                    {results.map(card => (
                        <button
                            key={card.unique_id}
                            type="button"
                            onClick={() => { setSelectedCard(card); setRequest(null); }}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.75rem 1rem',
                                marginBottom: 8,
                                background: selectedCard?.unique_id === card.unique_id
                                    ? 'var(--bg-accent, #e0f2fe)'
                                    : 'var(--bg-card, white)',
                                border: '1px solid var(--border-muted, #e5e7eb)',
                                borderRadius: 8,
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong>{card.initials}</strong>
                                {card.has_access && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--ok, #059669)' }}>
                                        {t('add_patient.search.already_have_access', '✓ already on your care team')}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                {card.masked_dob_year && (
                                    <>{t('add_patient.search.born', 'Born')} {card.masked_dob_year} · </>
                                )}
                                {card.masked_phone || card.masked_email || '—'}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Request access for selected card */}
            {selectedCard && !selectedCard.has_access && !request && (
                <div
                    style={{
                        background: 'var(--bg-card, white)',
                        border: '1px solid var(--border-muted, #e5e7eb)',
                        borderRadius: 8,
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: '1rem' }}>
                        {t('add_patient.search.request_access', 'Request access')}
                    </h2>
                    <label>
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                            {t('add_patient.search.delivery', 'How will the patient receive the code?')}
                        </div>
                        <select
                            value={delivery}
                            onChange={e => setDelivery(e.target.value as DeliveryMethod)}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 4 }}
                        >
                            <option value="push">{t('add_patient.search.delivery.push', 'Push to patient app')}</option>
                            <option value="in_person">{t('add_patient.search.delivery.in_person', 'In person — give code to patient')}</option>
                        </select>
                    </label>
                    <label>
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                            {t('add_patient.search.reason', 'Reason (optional)')}
                        </div>
                        <input
                            type="text"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder={t('add_patient.search.reason_placeholder', 'Walk-in cough assessment…')}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 4 }}
                        />
                    </label>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => startRequest.mutate()}
                        disabled={startRequest.isPending}
                        style={{ alignSelf: 'flex-start' }}
                    >
                        {startRequest.isPending
                            ? t('add_patient.search.sending', 'Sending…')
                            : t('add_patient.search.send_request', 'Send request')}
                    </button>
                </div>
            )}

            {/* OTP verification panel */}
            {request && (
                <div
                    style={{
                        background: 'var(--bg-accent, #ecfdf5)',
                        border: '1px solid var(--border-accent, #a7f3d0)',
                        borderRadius: 8,
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: '1rem' }}>
                        {t('add_patient.search.verify_title', 'Verify code')}
                    </h2>
                    {request.otp ? (
                        <p style={{ margin: 0, fontSize: '0.875rem' }}>
                            {t(
                                'add_patient.search.in_person_hint',
                                'Read this code to the patient — they\'ll enter it on their phone to approve.',
                            )}
                            <br />
                            <strong style={{ fontFamily: 'monospace', fontSize: '1.5rem', letterSpacing: '0.25em' }}>
                                {request.otp}
                            </strong>
                        </p>
                    ) : (
                        <p style={{ margin: 0, fontSize: '0.875rem' }}>
                            {t(
                                'add_patient.search.push_hint',
                                'The patient should see a notification with a 6-digit code. Enter it here.',
                            )}
                        </p>
                    )}
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        style={{
                            fontFamily: 'monospace',
                            fontSize: '1.25rem',
                            letterSpacing: '0.5em',
                            textAlign: 'center',
                            padding: '0.625rem',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            maxWidth: 220,
                        }}
                    />
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => verifyOtp.mutate()}
                        disabled={otpInput.length !== 6 || verifyOtp.isPending}
                        style={{ alignSelf: 'flex-start' }}
                    >
                        {verifyOtp.isPending
                            ? t('add_patient.search.verifying', 'Verifying…')
                            : t('add_patient.search.verify_button', 'Verify and open chart')}
                    </button>
                </div>
            )}
        </div>
    );
}
