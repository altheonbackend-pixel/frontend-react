import { useState } from 'react';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import { amendConsultation } from '../services/consultationService';
import type { Consultation } from '../../../shared/types';

interface ConsultationViewProps {
    consultation: Consultation;
    onClose: () => void;
    /** Called with the amended consultation after a successful amend — caller should open edit form */
    onAmend: (amended: Consultation) => void;
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

function fmtDate(iso: string | null | undefined) {
    if (!iso) return '—';
    return new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
    });
}

function fmtDateTime(iso: string | null | undefined) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

const ConsultationView = ({ consultation: c, onClose, onAmend }: ConsultationViewProps) => {
    const [amendOpen, setAmendOpen] = useState(false);
    const [amendReason, setAmendReason] = useState('');
    const [amendLoading, setAmendLoading] = useState(false);

    const isSigned = c.consultation_status === 'signed';

    const handleAmendConfirm = async () => {
        if (!amendReason.trim()) return;
        setAmendLoading(true);
        try {
            const res = await amendConsultation(c.id, amendReason.trim());
            toast.success('Consultation unlocked for amendment.');
            setAmendOpen(false);
            setAmendReason('');
            onAmend(res.data as Consultation);
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to amend consultation.'));
        } finally {
            setAmendLoading(false);
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
                        {isSigned && c.record_status === 'active' && (
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
                                {c.follow_up_date && <ViewField label="Follow-up Date" value={fmtDate(c.follow_up_date)} />}
                                {c.patient_summary && <ViewField label="Patient Summary" value={c.patient_summary} block />}
                                {c.patient_instructions && <ViewField label="Patient Instructions" value={c.patient_instructions} block />}
                            </div>
                        </section>
                    )}

                </div>
            </Drawer>

            {/* Amendment dialog */}
            {amendOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Amend consultation"
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.45)',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) setAmendOpen(false); }}
                >
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '28px 32px',
                        width: '440px',
                        maxWidth: 'calc(100vw - 32px)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                        display: 'flex', flexDirection: 'column', gap: '16px',
                    }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Amend Consultation</h2>
                        <p style={{ margin: 0, fontSize: '0.87rem', color: 'var(--text-secondary)' }}>
                            Amending will unlock this consultation for editing. Provide a reason for the amendment — it will be stored permanently.
                        </p>
                        <div>
                            <label htmlFor="amend-reason" style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, marginBottom: '6px' }}>
                                Amendment reason <span style={{ color: 'var(--color-danger)' }}>*</span>
                            </label>
                            <textarea
                                id="amend-reason"
                                rows={3}
                                className="input"
                                style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
                                placeholder="e.g. Incorrect diagnosis code entered"
                                value={amendReason}
                                onChange={e => setAmendReason(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="cancel-button"
                                onClick={() => { setAmendOpen(false); setAmendReason(''); }}
                                disabled={amendLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleAmendConfirm}
                                disabled={!amendReason.trim() || amendLoading}
                            >
                                {amendLoading ? 'Saving…' : 'Confirm Amendment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
