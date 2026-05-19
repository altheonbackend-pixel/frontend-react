import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import Dialog from '../../../shared/components/ui/Dialog';
import { amendConsultation, dismissFollowUp } from '../services/consultationService';
import type { Consultation } from '../../../shared/types';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';

interface ConsultationViewProps {
    consultation: Consultation;
    onClose: () => void;
    /** Called with the amended consultation after a successful amend — caller should open edit form */
    onAmend: (amended: Consultation) => void;
    /** Called after a follow-up is dismissed — caller should invalidate the consultations query */
    onFollowUpDismissed?: () => void;
}

const FREQ_LABEL_KEYS: Record<string, string> = {
    once_daily: 'rx.freq.qd',
    twice_daily: 'rx.freq.bid',
    three_times_daily: 'rx.freq.tid',
    four_times_daily: 'rx.freq.qid',
    every_8_hours: 'rx.freq.q8h',
    every_6_hours: 'rx.freq.q6h',
    as_needed: 'rx.freq.prn',
    weekly: 'rx.freq.weekly',
};

const ConsultationView = ({ consultation: c, onClose, onAmend, onFollowUpDismissed }: ConsultationViewProps) => {
    const { t } = useTranslation();
    const { formatDate, formatDateTime } = useFormatDateTime();
    const fmtDate = (iso: string | null | undefined) => iso ? formatDate(iso) : '—';
    const fmtDateTime = (iso: string | null | undefined) => iso ? formatDateTime(iso) : '—';

    const [amendOpen, setAmendOpen] = useState(false);
    const [dismissOpen, setDismissOpen] = useState(false);
    const [dismissed, setDismissed] = useState(c.follow_up_dismissed ?? false);

    const isSigned = c.consultation_status === 'signed';

    const handleDismissConfirm = async (reason?: string) => {
        try {
            await dismissFollowUp(c.id, reason!);
            setDismissed(true);
            setDismissOpen(false);
            toast.success(t('consultation.view.toast.follow_up_dismissed'));
            onFollowUpDismissed?.();
        } catch (err) {
            toast.error(parseApiError(err, t('consultation.view.toast.follow_up_dismiss_failed')));
            throw err;
        }
    };

    const handleAmendConfirm = async (reason?: string) => {
        try {
            const res = await amendConsultation(c.id, reason!);
            toast.success(t('consultation.view.toast.amend_unlocked'));
            setAmendOpen(false);
            onAmend(res.data as Consultation);
        } catch (err) {
            toast.error(parseApiError(err, t('consultation.view.toast.amend_failed')));
            throw err; // re-throw so Dialog keeps its submitting state reset
        }
    };

    const bmi =
        c.weight && c.height && c.height > 0
            ? c.height_unit === 'cm'
                ? (c.weight / ((c.height / 100) ** 2)).toFixed(1)
                : (c.weight / (c.height ** 2) * 703).toFixed(1)
            : null;

    return (
        <>
            <Drawer
                open
                onClose={onClose}
                title={
                    <span>
                        {t('consultation.view.title', { date: fmtDate(c.consultation_date) })}
                        {isSigned && (
                            <span style={{
                                marginLeft: '10px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'var(--color-success-light, #d1fae5)',
                                color: 'var(--color-success-dark, #065f46)',
                                verticalAlign: 'middle',
                            }}>
                                {t('consultation.view.signed')}
                            </span>
                        )}
                        {c.consultation_status === 'amended' && (
                            <span style={{
                                marginLeft: '10px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'var(--bg-subtle)',
                                color: 'var(--text-muted)',
                                verticalAlign: 'middle',
                            }}>
                                {t('patient_record.consultations.amendment')}
                            </span>
                        )}
                    </span>
                }
                size="lg"
                footer={
                    <>
                        {isSigned && c.record_status !== 'voided' && c.record_status !== 'entered_in_error' && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setAmendOpen(true)}
                            >
                                {t('consultation.view.amend_note')}
                            </button>
                        )}
                        <button type="button" className="cancel-button" onClick={onClose}>
                            {t('common.close')}
                        </button>
                    </>
                }
            >
                <div className="form" style={{ gap: '24px' }}>

                    {/* Signed / amendment meta */}
                    {(c.signed_at || c.amendment_reason) && (
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'var(--bg-subtle)',
                            fontSize: '0.83rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                        }}>
                            {c.signed_at && (
                                <span>{t('consultation.view.signed_at', { date: fmtDateTime(c.signed_at) })}</span>
                            )}
                            {c.amendment_reason && (
                                <span>{t('consultation.view.amendment_reason')}: <em>{c.amendment_reason}</em></span>
                            )}
                            {c.amended_at && (
                                <span>{t('consultation.view.amended_at', { date: fmtDateTime(c.amended_at) })}</span>
                            )}
                        </div>
                    )}

                    {/* Clinical section */}
                    <section>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            {t('consultation.view.clinical_details')}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                            <ViewField label={t('common.date')} value={fmtDate(c.consultation_date)} />
                            <ViewField label={t('consultation.type')} value={c.consultation_type_display ?? c.consultation_type} />
                            <ViewField label={t('common.doctor')} value={c.doctor_name ?? `#${c.doctor}`} />
                        </div>
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <ViewField label={t('consultation.reason')} value={c.reason_for_consultation} block />
                            {c.symptoms && c.symptoms.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('patient_record.consultations.symptoms')}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {c.symptoms.map(s => (
                                            <span key={s} style={{
                                                padding: '2px 10px',
                                                borderRadius: '999px',
                                                background: 'var(--bg-subtle)',
                                                fontSize: '0.82rem',
                                                color: 'var(--text-primary)',
                                            }}>{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <ViewField label={t('consultation.diagnosis')} value={c.diagnosis} block />
                            {c.icd_code && <ViewField label={t('consultation.icd_code')} value={c.icd_code} />}
                            <ViewField label={t('consultation.view.medical_report_notes')} value={c.medical_report} block />
                        </div>
                    </section>

                    {/* Vitals section */}
                    {(c.weight || c.height || c.sp2 || c.temperature || c.bp_systolic) && (
                        <section>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                {t('patient_record.consultations.vitals')}
                            </h3>
                            {c.has_vital_alerts && c.vital_alert_reasons && c.vital_alert_reasons.length > 0 && (
                                <div style={{
                                    marginBottom: '12px', padding: '8px 12px', borderRadius: '6px',
                                    background: 'var(--color-warning-light)', color: 'var(--color-warning-dark)',
                                    fontSize: '0.83rem',
                                }}>
                                    {t('consultation.view.vital_alerts', { reasons: c.vital_alert_reasons.join(', ') })}
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 24px' }}>
                                {c.weight && <ViewField label={t('patient_record.vitals.weight')} value={`${c.weight} kg`} />}
                                {c.height && <ViewField label={t('patient_record.vitals.height')} value={`${c.height} ${c.height_unit}`} />}
                                {bmi && <ViewField label="BMI" value={bmi} />}
                                {c.sp2 && <ViewField label="SpO₂" value={`${c.sp2}%`} />}
                                {c.temperature && <ViewField label={t('patient_record.vitals.temperature')} value={`${c.temperature} °C`} />}
                                {(c.bp_systolic || c.blood_pressure_display) && (
                                    <ViewField label={t('patient_record.vitals.blood_pressure')} value={c.blood_pressure_display ?? `${c.bp_systolic}/${c.bp_diastolic}`} />
                                )}
                            </div>
                        </section>
                    )}

                    {/* Prescriptions */}
                    {c.prescriptions && c.prescriptions.length > 0 && (
                        <section>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                {t('consultation.view.prescriptions')}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {c.prescriptions.map(rx => (
                                    <div key={rx.id} style={{
                                        padding: '10px 14px', borderRadius: '8px',
                                        background: rx.is_active ? 'var(--bg-card)' : 'var(--bg-subtle)',
                                        border: '1px solid var(--border-subtle)',
                                        opacity: rx.is_active ? 1 : 0.6,
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rx.medication_name}</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                            {rx.dosage} · {t(FREQ_LABEL_KEYS[rx.frequency] ?? 'rx.freq.unknown', { defaultValue: rx.frequency })}
                                            {rx.duration_days ? ` · ${t('consultation.view.duration_days', { count: rx.duration_days })}` : ''}
                                        </div>
                                        {rx.instructions && (
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>{rx.instructions}</div>
                                        )}
                                        {!rx.is_active && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{t('consultation.view.stopped')}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Lab Tests */}
                    {c.lab_results && c.lab_results.length > 0 && (
                        <section>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                {t('consultation.view.lab_tests')}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {c.lab_results.map(lr => (
                                    <div key={lr.id} style={{
                                        padding: '10px 14px', borderRadius: '8px',
                                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{lr.test_name}</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                            {fmtDate(lr.test_date)} · {lr.status}
                                        </div>
                                        {(lr.result_value || lr.result_value_text) && (
                                            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                                                {t('consultation.view.result')}: {lr.result_value || lr.result_value_text}
                                                {lr.unit ? ` ${lr.unit}` : ''}
                                                {lr.reference_range ? ` (ref: ${lr.reference_range})` : ''}
                                            </div>
                                        )}
                                        {lr.notes && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>{lr.notes}</div>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Procedures */}
                    {c.procedures && c.procedures.length > 0 && (
                        <section>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                {t('patient_record.consultations.procedures_performed')}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {c.procedures.map(p => (
                                    <div key={p.id} style={{
                                        padding: '10px 14px', borderRadius: '8px',
                                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.procedure_type}</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                            {fmtDate(p.procedure_date)}
                                            {p.procedure_category ? ` · ${p.procedure_category}` : ''}
                                        </div>
                                        {p.result && <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>{t('consultation.view.result')}: {p.result}</div>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Follow-up / Patient-facing */}
                    {(c.follow_up_date || c.patient_summary || c.patient_instructions) && (
                        <section>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                {t('consultation.view.follow_up_patient_notes')}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {c.follow_up_date && (
                                    <div>
                                        <ViewField label={t('consultation.follow_up_date')} value={fmtDate(c.follow_up_date)} />
                                        {dismissed ? (
                                            <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                {t('consultation.view.dismissed')}{c.follow_up_dismissal_reason ? `: ${c.follow_up_dismissal_reason}` : ''}
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setDismissOpen(true)}
                                                style={{
                                                    marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)',
                                                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                }}
                                            >
                                                {t('consultation.view.dismiss_follow_up')}
                                            </button>
                                        )}
                                    </div>
                                )}
                                {c.patient_summary && <ViewField label={t('patient_record.consultations.patient_summary')} value={c.patient_summary} block />}
                                {c.patient_instructions && <ViewField label={t('consultation.view.patient_instructions')} value={c.patient_instructions} block />}
                            </div>
                        </section>
                    )}

                </div>
            </Drawer>

            <Dialog
                open={amendOpen}
                onClose={() => setAmendOpen(false)}
                onConfirm={handleAmendConfirm}
                title={t('consultation.view.amend_title')}
                message={t('consultation.view.amend_message')}
                confirmLabel={t('consultation.view.amend_confirm')}
                reasonLabel={t('consultation.view.amendment_reason')}
                reasonPlaceholder={t('consultation.view.amend_reason_placeholder')}
                requireReason
            />

            <Dialog
                open={dismissOpen}
                onClose={() => setDismissOpen(false)}
                onConfirm={handleDismissConfirm}
                title={t('consultation.view.dismiss_title')}
                message={t('consultation.view.dismiss_message')}
                confirmLabel={t('consultation.view.dismiss_follow_up')}
                reasonLabel={t('consultation.view.dismiss_reason')}
                reasonPlaceholder={t('consultation.view.dismiss_reason_placeholder')}
                requireReason
            />
        </>
    );
};

interface ViewFieldProps {
    label: string;
    value: string | null | undefined;
    block?: boolean;
}

const ViewField = ({ label, value, block }: ViewFieldProps) => (
    <div style={block ? { display: 'flex', flexDirection: 'column', gap: '4px' } : undefined}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: '0.9rem', color: value ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: block ? 'pre-wrap' : undefined }}>
            {value || '—'}
        </div>
    </div>
);

export default ConsultationView;
