import { useState } from 'react';
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

const FREQ_LABELS: Record<string, string> = {
    once_daily: 'Once daily',
    twice_daily: 'Twice daily',
    three_times_daily: 'Three times daily',
    four_times_daily: 'Four times daily',
    every_8_hours: 'Every 8 hours',
    every_6_hours: 'Every 6 hours',
    as_needed: 'As needed',
    weekly: 'Weekly',
};

const ConsultationView = ({ consultation: c, onClose, onAmend, onFollowUpDismissed }: ConsultationViewProps) => {
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
            toast.success('Follow-up dismissed. No further reminders will be sent.');
            onFollowUpDismissed?.();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to dismiss follow-up.'));
            throw err;
        }
    };

    const handleAmendConfirm = async (reason?: string) => {
        try {
            const res = await amendConsultation(c.id, reason!);
            toast.success('Consultation unlocked for amendment.');
            setAmendOpen(false);
            onAmend(res.data as Consultation);
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to amend consultation.'));
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
                        Consultation — {fmtDate(c.consultation_date)}
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
                                Signed
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
                                Amended
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
                                Amend Note
                            </button>
                        )}
                        <button type="button" className="cancel-button" onClick={onClose}>
                            Close
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
                                <span>Signed {fmtDateTime(c.signed_at)}</span>
                            )}
                            {c.amendment_reason && (
                                <span>Amendment reason: <em>{c.amendment_reason}</em></span>
                            )}
                            {c.amended_at && (
                                <span>Amended {fmtDateTime(c.amended_at)}</span>
                            )}
                        </div>
                    )}

                    {/* Clinical section */}
                    <section>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            Clinical Details
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                            <ViewField label="Date" value={fmtDate(c.consultation_date)} />
                            <ViewField label="Type" value={c.consultation_type_display ?? c.consultation_type} />
                            <ViewField label="Doctor" value={c.doctor_name ?? `#${c.doctor}`} />
                        </div>
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <ViewField label="Reason for Consultation" value={c.reason_for_consultation} block />
                            {c.symptoms && c.symptoms.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Symptoms</div>
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
                            <ViewField label="Diagnosis" value={c.diagnosis} block />
                            {c.icd_code && <ViewField label="ICD-10 Code" value={c.icd_code} />}
                            <ViewField label="Medical Report / Notes" value={c.medical_report} block />
                        </div>
                    </section>

                    {/* Vitals section */}
                    {(c.weight || c.height || c.sp2 || c.temperature || c.bp_systolic) && (
                        <section>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                Vitals
                            </h3>
                            {c.has_vital_alerts && c.vital_alert_reasons && c.vital_alert_reasons.length > 0 && (
                                <div style={{
                                    marginBottom: '12px', padding: '8px 12px', borderRadius: '6px',
                                    background: 'var(--color-warning-light)', color: 'var(--color-warning-dark)',
                                    fontSize: '0.83rem',
                                }}>
                                    ⚠ Vital alerts: {c.vital_alert_reasons.join(', ')}
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 24px' }}>
                                {c.weight && <ViewField label="Weight" value={`${c.weight} kg`} />}
                                {c.height && <ViewField label="Height" value={`${c.height} ${c.height_unit}`} />}
                                {bmi && <ViewField label="BMI" value={bmi} />}
                                {c.sp2 && <ViewField label="SpO₂" value={`${c.sp2}%`} />}
                                {c.temperature && <ViewField label="Temperature" value={`${c.temperature} °C`} />}
                                {(c.bp_systolic || c.blood_pressure_display) && (
                                    <ViewField label="Blood Pressure" value={c.blood_pressure_display ?? `${c.bp_systolic}/${c.bp_diastolic}`} />
                                )}
                            </div>
                        </section>
                    )}

                    {/* Prescriptions */}
                    {c.prescriptions && c.prescriptions.length > 0 && (
                        <section>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                Prescriptions
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
                                            {rx.dosage} · {FREQ_LABELS[rx.frequency] ?? rx.frequency}
                                            {rx.duration_days ? ` · ${rx.duration_days} days` : ''}
                                        </div>
                                        {rx.instructions && (
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>{rx.instructions}</div>
                                        )}
                                        {!rx.is_active && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Stopped</div>
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
                                Lab Tests
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
                                                Result: {lr.result_value || lr.result_value_text}
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
                                Procedures
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
                                        {p.result && <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Result: {p.result}</div>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Follow-up / Patient-facing */}
                    {(c.follow_up_date || c.patient_summary || c.patient_instructions) && (
                        <section>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                Follow-up &amp; Patient Notes
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {c.follow_up_date && (
                                    <div>
                                        <ViewField label="Follow-up Date" value={fmtDate(c.follow_up_date)} />
                                        {dismissed ? (
                                            <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                Dismissed{c.follow_up_dismissal_reason ? `: ${c.follow_up_dismissal_reason}` : ''}
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
                                                Dismiss follow-up
                                            </button>
                                        )}
                                    </div>
                                )}
                                {c.patient_summary && <ViewField label="Patient Summary" value={c.patient_summary} block />}
                                {c.patient_instructions && <ViewField label="Patient Instructions" value={c.patient_instructions} block />}
                            </div>
                        </section>
                    )}

                </div>
            </Drawer>

            <Dialog
                open={amendOpen}
                onClose={() => setAmendOpen(false)}
                onConfirm={handleAmendConfirm}
                title="Amend Consultation"
                message="Amending will unlock this consultation for editing. The reason will be stored permanently on the record."
                confirmLabel="Confirm Amendment"
                reasonLabel="Amendment reason"
                reasonPlaceholder="e.g. Incorrect diagnosis code entered"
                requireReason
            />

            <Dialog
                open={dismissOpen}
                onClose={() => setDismissOpen(false)}
                onConfirm={handleDismissConfirm}
                title="Dismiss Follow-up"
                message="This will stop all further reminder emails for this follow-up. Use when the follow-up is no longer needed (e.g. patient recovered, transferred care)."
                confirmLabel="Dismiss Follow-up"
                reasonLabel="Reason for dismissal"
                reasonPlaceholder="e.g. Patient recovered, no longer required"
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
