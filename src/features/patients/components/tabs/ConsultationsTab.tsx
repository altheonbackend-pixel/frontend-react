import { useNavigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { type PatientWithHistory, type Consultation } from '../../../../shared/types';
import { TabSkeleton } from '../../../../shared/components/SectionCard';

interface VitalsPoint {
    id: number;
    consultation_date: string;
    weight: number | null;
    height: number | null;
    height_unit: string;
    sp2: number | null;
    temperature: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    blood_pressure_display?: string | null;
}

const VITALS_TOOLTIP_STYLE = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
};

interface ConsultationsTabProps {
    patient: PatientWithHistory;
    id: string;
    consultationsData: Consultation[];
    consultationsLoading: boolean;
    vitalsTrend: VitalsPoint[];
    vitalsLoading: boolean;
    consultView: 'list' | 'charts';
    setConsultView: (v: 'list' | 'charts') => void;
    expandedConsultIds: Set<number>;
    toggleConsult: (id: number) => void;
    canWrite: boolean;
    profile: any;
    visibleVitals: { bp: boolean; spo2: boolean; temperature: boolean; weight: boolean };
    toggleVital: (key: 'bp' | 'spo2' | 'temperature' | 'weight') => void;
    setConsultationToEdit: (c: Consultation | null) => void;
    setShowConsultationForm: (v: boolean) => void;
    setViewingConsultation: (c: Consultation | null) => void;
    setConfirmDeleteConsultationId: (id: number | null) => void;
    setShareConsultationId: (id: number | null) => void;
    setShareConsultationSummary: (s: string) => void;
    handleSignConsultation: (id: number) => void;
    handleHideConsultation: (id: number) => void;
    handleShowConsultation: (id: number) => void;
}

const ConsultationsTab = ({
    patient,
    id,
    consultationsData,
    consultationsLoading,
    vitalsTrend,
    vitalsLoading,
    consultView,
    setConsultView,
    expandedConsultIds,
    toggleConsult,
    canWrite,
    profile,
    visibleVitals,
    toggleVital,
    setConsultationToEdit,
    setShowConsultationForm,
    setViewingConsultation,
    setConfirmDeleteConsultationId,
    setShareConsultationId,
    setShareConsultationSummary,
    handleSignConsultation,
    handleHideConsultation,
    handleShowConsultation,
}: ConsultationsTabProps) => {
    const navigate = useNavigate();

    const draftConsultations = (patient.consultations || []).filter(
        (c: any) => c.consultation_status === 'draft' || c.consultation_status === 'in_progress'
    );

    // First active (non-voided) consultation is the "latest" — only it gets follow-up actions
    const latestActiveId = consultationsData.find(
        c => c.record_status === 'active' || !c.record_status
    )?.id;

    const openEdit = (c: Consultation) => {
        setConsultationToEdit(c);
        setShowConsultationForm(true);
    };

    return (
        <div className="tab-panel">
            <div className="tab-panel-header">
                <h3>Consultations</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div className="view-toggle">
                        <button
                            type="button"
                            className={`view-toggle-btn${consultView === 'list' ? ' active' : ''}`}
                            onClick={() => setConsultView('list')}
                        >List</button>
                        <button
                            type="button"
                            className={`view-toggle-btn${consultView === 'charts' ? ' active' : ''}`}
                            onClick={() => setConsultView('charts')}
                        >Vitals Charts</button>
                    </div>
                    {consultView === 'list' && (
                        <button
                            className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                            disabled={!canWrite}
                            title={!canWrite ? 'Patient record is read-only' : undefined}
                            onClick={() => { if (canWrite) { setConsultationToEdit(null); setShowConsultationForm(true); } }}
                        >+ Add</button>
                    )}
                </div>
            </div>

            {consultView === 'list' ? (
                <>
                    {draftConsultations.length > 0 && (
                        <div className="pt-draft-notice">
                            <span>{draftConsultations.length} unsigned draft{draftConsultations.length > 1 ? 's' : ''} — open to complete and sign.</span>
                        </div>
                    )}
                    {consultationsLoading ? (
                        <TabSkeleton rows={4} />
                    ) : consultationsData.length > 0 ? (
                        <ul className="detail-list">
                            {consultationsData.map(c => {
                                const isExpanded = expandedConsultIds.has(c.id);
                                const isOwnConsultation = c.doctor === profile?.id;
                                const isVoided = c.record_status === 'voided' || c.record_status === 'entered_in_error';
                                const isLatest = c.id === latestActiveId;
                                const isDraft = c.consultation_status === 'draft' || c.consultation_status === 'in_progress' || c.consultation_status === 'amended';
                                const isSigned = c.consultation_status === 'signed';

                                return (
                                    <li
                                        key={c.id}
                                        id={`consult-entry-${c.id}`}
                                        className="consultation-entry detail-list-item"
                                        style={isVoided ? { opacity: 0.55 } : undefined}
                                    >
                                        {/* ── Collapsed row ── */}
                                        <div
                                            className="consult-summary-row"
                                            onClick={() => toggleConsult(c.id)}
                                            role="button"
                                            tabIndex={0}
                                            aria-expanded={isExpanded}
                                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleConsult(c.id); }}
                                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.625rem 0' }}
                                        >
                                            <span className="consult-summary-date">
                                                {new Date(c.consultation_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                            <span className="consult-type-badge">{c.consultation_type_display || c.consultation_type}</span>
                                            {c.consultation_status && c.consultation_status !== 'signed' && !isVoided && (
                                                <span className="consult-type-badge" style={{
                                                    background: isDraft ? 'var(--color-warning-light)' : 'var(--bg-subtle)',
                                                    color: isDraft ? 'var(--color-warning-dark)' : 'var(--text-muted)',
                                                    border: '1px solid currentColor',
                                                }}>
                                                    {c.consultation_status === 'draft' ? 'Draft'
                                                        : c.consultation_status === 'in_progress' ? 'In Progress'
                                                        : c.consultation_status === 'amended' ? 'Amended'
                                                        : c.consultation_status}
                                                </span>
                                            )}
                                            {isVoided && (
                                                <span className="consult-type-badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                                                    Voided
                                                </span>
                                            )}
                                            <span className="consult-summary-reason" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {c.reason_for_consultation}
                                            </span>
                                            {!isOwnConsultation && c.doctor_name && (
                                                <span className="consult-type-badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                                                    Dr. {c.doctor_name}
                                                </span>
                                            )}
                                            {c.has_vital_alerts && <span className="vital-alert-dot" title="Vital alert">⚠</span>}
                                            {/* Quick-action buttons for drafts — stop propagation so expand doesn't fire */}
                                            {isOwnConsultation && isDraft && !isExpanded && canWrite && (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    style={{ fontSize: '0.75rem', padding: '2px 10px', flexShrink: 0 }}
                                                    onClick={e => { e.stopPropagation(); openEdit(c); }}
                                                >
                                                    Open →
                                                </button>
                                            )}
                                            <span className="consult-expand-icon" style={{ marginLeft: 'auto', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                                        </div>

                                        {/* ── Expanded body ── */}
                                        {isExpanded && (
                                            <div className="consult-expanded">
                                                {/* Clinical details */}
                                                <div className="consult-section">
                                                    <div className="info-item"><strong>Reason:</strong> {c.reason_for_consultation}</div>
                                                    {c.symptoms?.length > 0 && (
                                                        <div className="info-item">
                                                            <strong>Symptoms:</strong>
                                                            <div className="symptoms-display">
                                                                {c.symptoms.map(s => <span key={s} className="symptom-tag">{s}</span>)}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {c.diagnosis && (
                                                        <div className="info-item">
                                                            <strong>Diagnosis:</strong> {c.diagnosis}
                                                            {c.icd_code && <span className="consult-icd-badge">{c.icd_code}</span>}
                                                        </div>
                                                    )}
                                                    {c.medical_report && <div className="info-item"><strong>Report:</strong> {c.medical_report}</div>}
                                                    {c.amendment_reason && (
                                                        <div className="info-item" style={{ background: 'var(--color-warning-light)', borderRadius: 'var(--radius-sm)', padding: '0.375rem 0.5rem', marginTop: '0.5rem' }}>
                                                            <strong style={{ color: 'var(--color-warning-dark)' }}>Amendment:</strong> {c.amendment_reason}
                                                            {c.amended_at && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({new Date(c.amended_at).toLocaleDateString()})</span>}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Vitals */}
                                                {(c.weight || c.height || c.temperature || c.sp2 || c.bp_systolic || c.bp_diastolic) && (
                                                    <div className="consult-section">
                                                        <div className="consult-section-title">Vitals</div>
                                                        <div className="vitals-row">
                                                            {c.weight && <span className="vital-chip">Weight: {c.weight} kg</span>}
                                                            {c.height && <span className="vital-chip">Height: {c.height}{c.height_unit === 'ft' ? ' ft' : ' m'}</span>}
                                                            {c.temperature && <span className="vital-chip">Temp: {c.temperature}°C</span>}
                                                            {c.sp2 && <span className="vital-chip">SpO₂: {c.sp2}%</span>}
                                                            {(c.bp_systolic || c.bp_diastolic) && <span className="vital-chip">BP: {c.blood_pressure_display ?? `${c.bp_systolic ?? '?'}/${c.bp_diastolic ?? '?'}`} mmHg</span>}
                                                        </div>
                                                        {c.has_vital_alerts && c.vital_alert_reasons && c.vital_alert_reasons.length > 0 && (
                                                            <div className="consult-vital-alerts">
                                                                {c.vital_alert_reasons.map(r => <span key={r} className="vital-alert-chip">⚠ {r}</span>)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Prescriptions */}
                                                {c.prescriptions && c.prescriptions.length > 0 && (
                                                    <div className="consult-section">
                                                        <div className="consult-section-title">Medications Prescribed</div>
                                                        <ul className="consult-rx-list">
                                                            {c.prescriptions.map(rx => (
                                                                <li key={rx.id} className="consult-rx-item">
                                                                    <div className="consult-rx-header">
                                                                        <span className="consult-rx-name">{rx.medication_name}</span>
                                                                        <span className={`consult-rx-status ${rx.is_active ? 'consult-rx-status--active' : 'consult-rx-status--inactive'}`}>
                                                                            {rx.is_active ? 'Active' : 'Inactive'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="consult-rx-detail">
                                                                        {rx.dosage} · {rx.frequency}
                                                                        {rx.duration_days ? ` · ${rx.duration_days} days` : ''}
                                                                    </div>
                                                                    {rx.instructions && <div className="consult-rx-instructions">{rx.instructions}</div>}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Lab results */}
                                                {c.lab_results && c.lab_results.length > 0 && (
                                                    <div className="consult-section">
                                                        <div className="consult-section-title">Lab Tests Ordered</div>
                                                        <ul className="consult-lab-list">
                                                            {c.lab_results.map(lab => (
                                                                <li key={lab.id} className="consult-lab-item">
                                                                    <div className="consult-lab-header">
                                                                        <span className="consult-lab-name">{lab.test_name}</span>
                                                                        <span className={`consult-lab-status consult-lab-status--${lab.status}`}>{lab.status}</span>
                                                                    </div>
                                                                    <div className="consult-lab-meta">
                                                                        {new Date(lab.test_date).toLocaleDateString()}
                                                                        {(lab.result_value || lab.result_value_text) && (
                                                                            <span className="consult-lab-result">
                                                                                {lab.result_value_text || lab.result_value}{lab.unit ? ` ${lab.unit}` : ''}
                                                                                {lab.reference_range ? ` (ref: ${lab.reference_range})` : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {lab.notes && <div className="consult-lab-notes">{lab.notes}</div>}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Procedures */}
                                                {c.procedures && c.procedures.length > 0 && (
                                                    <div className="consult-section">
                                                        <div className="consult-section-title">Procedures Performed</div>
                                                        <ul className="consult-proc-list">
                                                            {c.procedures.map(proc => (
                                                                <li key={proc.id} className="consult-proc-item">
                                                                    <div className="consult-proc-header">
                                                                        <span className="consult-proc-name">{proc.procedure_type}</span>
                                                                        {proc.procedure_category && <span className="consult-proc-category">{proc.procedure_category}</span>}
                                                                        <span className="consult-proc-date">{new Date(proc.procedure_date).toLocaleDateString()}</span>
                                                                    </div>
                                                                    {proc.result && <div className="consult-proc-result">{proc.result}</div>}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Patient summary / instructions */}
                                                {(c.patient_summary || c.patient_instructions) && (
                                                    <div className="consult-section">
                                                        {c.patient_summary && <div className="info-item"><strong>Patient Summary:</strong> {c.patient_summary}</div>}
                                                        {c.patient_instructions && <div className="info-item"><strong>Instructions:</strong> {c.patient_instructions}</div>}
                                                    </div>
                                                )}

                                                {/* Follow-up section */}
                                                {c.follow_up_date && (
                                                    <div className="consult-section">
                                                        <div className="consult-section-title">Follow-up</div>
                                                        {isLatest ? (
                                                            /* Latest consultation — show actionable follow-up controls */
                                                            c.follow_up_dismissed ? (
                                                                <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                                                                    Follow-up dismissed
                                                                    {c.follow_up_dismissal_reason ? ` — ${c.follow_up_dismissal_reason}` : ''}
                                                                </p>
                                                            ) : c.follow_up_appointment_info ? (
                                                                /* Appointment already booked */
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                    <span className="follow-up-chip">
                                                                        Follow-up: {new Date(c.follow_up_date + 'T00:00:00').toLocaleDateString()}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-ghost btn-sm"
                                                                        style={{ fontSize: '0.78rem', padding: '2px 8px' }}
                                                                        onClick={() => navigate(`/appointments?patient_id=${id}`)}
                                                                    >
                                                                        Appt booked ({c.follow_up_appointment_info.status}) →
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                /* No appointment yet — show "Book follow-up" */
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                    <span className="follow-up-chip">
                                                                        Follow-up: {new Date(c.follow_up_date + 'T00:00:00').toLocaleDateString()}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-ghost btn-sm"
                                                                        style={{ fontSize: '0.78rem', padding: '2px 8px' }}
                                                                        onClick={() => navigate(`/appointments?patient_id=${id}`)}
                                                                    >
                                                                        Book follow-up →
                                                                    </button>
                                                                </div>
                                                            )
                                                        ) : (
                                                            /* Older consultation — read-only chip only */
                                                            <span className="follow-up-chip" style={{ display: 'inline-flex' }}>
                                                                Follow-up: {new Date(c.follow_up_date + 'T00:00:00').toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ── Action bar ── */}
                                                {isOwnConsultation && !isVoided && (
                                                    <div className="entry-actions" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {isDraft && (<>
                                                            <button
                                                                type="button"
                                                                className="edit-button action-button"
                                                                onClick={() => openEdit(c)}
                                                            >Edit</button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary btn-sm"
                                                                onClick={() => handleSignConsultation(c.id)}
                                                            >Sign</button>
                                                        </>)}
                                                        {isSigned && (<>
                                                            <button
                                                                type="button"
                                                                className="edit-button action-button"
                                                                onClick={() => setViewingConsultation(c)}
                                                            >View</button>
                                                            <button
                                                                type="button"
                                                                className="action-button"
                                                                onClick={() => setViewingConsultation(c)}
                                                            >Amend</button>
                                                        </>)}
                                                        <button
                                                            type="button"
                                                            className="action-button"
                                                            style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 'auto' }}
                                                            onClick={() => setConfirmDeleteConsultationId(c.id)}
                                                        >Void</button>
                                                    </div>
                                                )}
                                                {isOwnConsultation && isVoided && (
                                                    <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                        Voided{c.void_reason ? ` — ${c.void_reason}` : ''}
                                                    </div>
                                                )}

                                                {/* ── Sharing status (signed only) ── */}
                                                {isOwnConsultation && isSigned && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.625rem', paddingTop: '0.625rem', borderTop: '1px solid var(--border-subtle)' }}>
                                                        {c.visible_to_patient ? (
                                                            c.share_with_patient_at ? (<>
                                                                <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
                                                                    ✓ Shared with patient
                                                                </span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                    {new Date(c.share_with_patient_at).toLocaleDateString()}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="action-button"
                                                                    style={{ fontSize: '0.78rem', color: 'var(--accent)' }}
                                                                    onClick={() => { setShareConsultationId(c.id); setShareConsultationSummary(c.patient_summary || ''); }}
                                                                >Edit summary</button>
                                                                <button
                                                                    type="button"
                                                                    className="action-button"
                                                                    style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                                                                    onClick={() => handleHideConsultation(c.id)}
                                                                >Hide</button>
                                                            </>) : (<>
                                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                                    Visible to patient
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="action-button"
                                                                    style={{ fontSize: '0.78rem', color: 'var(--accent)' }}
                                                                    onClick={() => { setShareConsultationId(c.id); setShareConsultationSummary(c.patient_summary || ''); }}
                                                                >Add patient summary</button>
                                                                <button
                                                                    type="button"
                                                                    className="action-button"
                                                                    style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                                                                    onClick={() => handleHideConsultation(c.id)}
                                                                >Hide from patient</button>
                                                            </>)
                                                        ) : (<>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600 }}>
                                                                Hidden from patient
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="action-button"
                                                                style={{ fontSize: '0.78rem', color: 'var(--accent)' }}
                                                                onClick={() => handleShowConsultation(c.id)}
                                                            >Make visible</button>
                                                        </>)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : <p className="muted">No consultations recorded.</p>}
                </>
            ) : (
                vitalsLoading ? (
                    <TabSkeleton rows={3} />
                ) : vitalsTrend.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📈</div>
                        <div className="empty-state-title">No vitals recorded yet</div>
                        <div className="empty-state-subtitle">Vitals are captured during consultations.</div>
                    </div>
                ) : (() => {
                    const chartData = vitalsTrend.map(v => ({
                        ...v,
                        label: new Date(v.consultation_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                    }));
                    const last = vitalsTrend[vitalsTrend.length - 1];
                    const bpData    = chartData.filter(v => v.bp_systolic !== null || v.bp_diastolic !== null);
                    const spo2Data  = chartData.filter(v => v.sp2 !== null);
                    const tempData  = chartData.filter(v => v.temperature !== null);
                    const weightData = chartData.filter(v => v.weight !== null);
                    return (
                        <div>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                                {([
                                    { key: 'bp' as const, label: 'Blood Pressure' },
                                    { key: 'spo2' as const, label: 'SpO₂' },
                                    { key: 'temperature' as const, label: 'Temperature' },
                                    { key: 'weight' as const, label: 'Weight' },
                                ]).map(({ key, label }) => (
                                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                        <input type="checkbox" checked={visibleVitals[key]} onChange={() => toggleVital(key)} />
                                        {label}
                                    </label>
                                ))}
                            </div>
                            {visibleVitals.bp && bpData.length > 0 && (
                                <div className="section-card" style={{ marginBottom: '1rem' }}>
                                    <div className="section-card-header">
                                        <span className="section-card-title">Blood Pressure (mmHg)</span>
                                        {(last.bp_systolic || last.bp_diastolic) && (
                                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Latest: {last.bp_systolic ?? '?'}/{last.bp_diastolic ?? '?'} mmHg</span>
                                        )}
                                    </div>
                                    <div className="section-card-body" style={{ height: 220 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={bpData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                <YAxis domain={[60, 200]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                <Tooltip contentStyle={VITALS_TOOLTIP_STYLE} />
                                                <ReferenceLine y={180} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'Crisis', fontSize: 10, fill: 'var(--danger)' }} />
                                                <ReferenceLine y={90} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Hypotension', fontSize: 10, fill: 'var(--warning)' }} />
                                                <Line type="monotone" dataKey="bp_systolic" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} name="Systolic" connectNulls />
                                                <Line type="monotone" dataKey="bp_diastolic" stroke="var(--accent-secondary)" strokeWidth={2} dot={{ r: 3 }} name="Diastolic" connectNulls />
                                                <Legend />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                            {visibleVitals.spo2 && spo2Data.length > 0 && (
                                <div className="section-card" style={{ marginBottom: '1rem' }}>
                                    <div className="section-card-header">
                                        <span className="section-card-title">SpO₂ (%)</span>
                                        {last.sp2 && (
                                            <span style={{ fontSize: '0.8125rem', color: Number(last.sp2) < 94 ? 'var(--danger)' : 'var(--text-secondary)' }}>Latest: {last.sp2}%</span>
                                        )}
                                    </div>
                                    <div className="section-card-body" style={{ height: 220 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={spo2Data}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                <Tooltip contentStyle={VITALS_TOOLTIP_STYLE} />
                                                <ReferenceLine y={94} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Low SpO₂', fontSize: 10, fill: 'var(--warning)' }} />
                                                <Line type="monotone" dataKey="sp2" stroke="var(--success)" strokeWidth={2} dot={{ r: 3 }} name="SpO₂ %" connectNulls />
                                                <Legend />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                            {visibleVitals.temperature && tempData.length > 0 && (
                                <div className="section-card" style={{ marginBottom: '1rem' }}>
                                    <div className="section-card-header">
                                        <span className="section-card-title">Temperature (°C)</span>
                                        {last.temperature && (
                                            <span style={{ fontSize: '0.8125rem', color: Number(last.temperature) > 38.5 ? 'var(--danger)' : 'var(--text-secondary)' }}>Latest: {last.temperature}°C</span>
                                        )}
                                    </div>
                                    <div className="section-card-body" style={{ height: 220 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={tempData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                <YAxis domain={[34, 42]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                <Tooltip contentStyle={VITALS_TOOLTIP_STYLE} />
                                                <ReferenceLine y={38.5} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: 'Fever', fontSize: 10, fill: 'var(--danger)' }} />
                                                <ReferenceLine y={35.5} stroke="var(--info)" strokeDasharray="4 4" label={{ value: 'Hypothermia', fontSize: 10, fill: 'var(--info)' }} />
                                                <Line type="monotone" dataKey="temperature" stroke="var(--warning)" strokeWidth={2} dot={{ r: 3 }} name="Temp °C" connectNulls />
                                                <Legend />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                            {visibleVitals.weight && weightData.length > 0 && (
                                <div className="section-card" style={{ marginBottom: '1rem' }}>
                                    <div className="section-card-header">
                                        <span className="section-card-title">Weight (kg)</span>
                                        {last.weight && (
                                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Latest: {last.weight} kg</span>
                                        )}
                                    </div>
                                    <div className="section-card-body" style={{ height: 220 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={weightData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                                <Tooltip contentStyle={VITALS_TOOLTIP_STYLE} />
                                                <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} name="Weight kg" connectNulls />
                                                <Legend />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()
            )}
        </div>
    );
};

export default ConsultationsTab;
