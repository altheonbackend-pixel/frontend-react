import { useNavigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { type PatientWithHistory, type Consultation } from '../../../../shared/types';
import { TabSkeleton } from '../../../../shared/components/SectionCard';
import { toast, parseApiError } from '../../../../shared/components/ui';
import api from '../../../../shared/services/api';
import { useQueryClient } from '@tanstack/react-query';

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
    setExpandedConsultIds: (v: Set<number>) => void;
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
    setExpandedConsultIds,
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
}: ConsultationsTabProps) => {
    const navigate = useNavigate();

    const draftConsultations = (patient.consultations || []).filter(
        (c: any) => c.consultation_status === 'draft' || c.consultation_status === 'in_progress'
    );

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
                                return (
                                    <li key={c.id} id={`consult-entry-${c.id}`} className="consultation-entry detail-list-item">
                                        <button className="consult-summary-row" onClick={() => toggleConsult(c.id)} aria-expanded={isExpanded}>
                                            <span className="consult-summary-date">{new Date(c.consultation_date).toLocaleDateString()}</span>
                                            <span className="consult-type-badge">{c.consultation_type_display || c.consultation_type}</span>
                                            {c.consultation_status && c.consultation_status !== 'signed' && (
                                                <span className="consult-type-badge" style={{
                                                    background: (c.consultation_status === 'draft' || c.consultation_status === 'in_progress') ? 'var(--color-warning-light)' : 'var(--bg-subtle)',
                                                    color: (c.consultation_status === 'draft' || c.consultation_status === 'in_progress') ? 'var(--color-warning-dark)' : 'var(--text-muted)',
                                                    border: '1px solid currentColor',
                                                }}>
                                                    {c.consultation_status === 'draft' ? 'Draft' : c.consultation_status === 'in_progress' ? 'In Progress' : c.consultation_status}
                                                </span>
                                            )}
                                            <span className="consult-summary-reason">{c.reason_for_consultation}</span>
                                            {!isOwnConsultation && c.doctor_name && (
                                                <span className="consult-type-badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                                                    Dr. {c.doctor_name}
                                                </span>
                                            )}
                                            {c.follow_up_date && <span className="follow-up-chip" style={{ flexShrink: 0 }}>↩ {new Date(c.follow_up_date + 'T00:00:00').toLocaleDateString()}</span>}
                                            {c.has_vital_alerts && <span className="vital-alert-dot" title="Vital alert">⚠</span>}
                                            <span className="consult-expand-icon">{isExpanded ? '▲' : '▼'}</span>
                                        </button>
                                        {isExpanded && (
                                            <div className="consult-expanded">
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
                                                </div>

                                                {(c.weight || c.height || c.temperature || c.sp2 || c.bp_systolic || c.bp_diastolic) && (
                                                    <div className="consult-section">
                                                        <div className="consult-section-title">Vitals</div>
                                                        <div className="vitals-row">
                                                            {c.weight && <span className="vital-chip">Weight: {c.weight} kg</span>}
                                                            {c.height && <span className="vital-chip">Height: {c.height}{c.height_unit === 'ft' ? ' ft' : ' m'}</span>}
                                                            {c.temperature && <span className="vital-chip">Temp: {c.temperature}°C</span>}
                                                            {c.sp2 && <span className="vital-chip">SpO2: {c.sp2}%</span>}
                                                            {(c.bp_systolic || c.bp_diastolic) && <span className="vital-chip">BP: {c.blood_pressure_display ?? `${c.bp_systolic ?? '?'}/${c.bp_diastolic ?? '?'}`} mmHg</span>}
                                                        </div>
                                                        {c.has_vital_alerts && c.vital_alert_reasons && c.vital_alert_reasons.length > 0 && (
                                                            <div className="consult-vital-alerts">
                                                                {c.vital_alert_reasons.map(r => <span key={r} className="vital-alert-chip">⚠ {r}</span>)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

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

                                                {(c.follow_up_date || c.patient_summary || c.patient_instructions) && (
                                                    <div className="consult-section">
                                                        {c.follow_up_date && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                                <div className="follow-up-chip" style={{ display: 'inline-flex' }}>
                                                                    Follow-up: {new Date(c.follow_up_date + 'T00:00:00').toLocaleDateString()}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-ghost btn-sm"
                                                                    style={{ fontSize: '0.78rem', padding: '2px 8px' }}
                                                                    onClick={() => navigate(`/appointments?patient_id=${id}`)}
                                                                >
                                                                    Book appointment →
                                                                </button>
                                                            </div>
                                                        )}
                                                        {c.patient_summary && <div className="info-item"><strong>Patient Summary:</strong> {c.patient_summary}</div>}
                                                        {c.patient_instructions && <div className="info-item"><strong>Instructions:</strong> {c.patient_instructions}</div>}
                                                    </div>
                                                )}

                                                <div className="entry-actions">
                                                    {isOwnConsultation && (<>
                                                        <button
                                                            onClick={() => {
                                                                if (c.consultation_status === 'signed') {
                                                                    setViewingConsultation(c);
                                                                } else {
                                                                    setConsultationToEdit(c);
                                                                    setShowConsultationForm(true);
                                                                }
                                                            }}
                                                            className="edit-button action-button"
                                                        >
                                                            {c.consultation_status === 'signed' ? 'View' : 'Edit'}
                                                        </button>
                                                        <button onClick={() => setConfirmDeleteConsultationId(c.id)} className="delete-button action-button">Delete</button>
                                                        <button
                                                            onClick={() => { setShareConsultationId(c.id); setShareConsultationSummary(c.patient_summary || ''); }}
                                                            className="action-button"
                                                            style={{ color: c.visible_to_patient ? 'var(--success)' : 'var(--accent)' }}
                                                        >
                                                            {c.visible_to_patient ? '✓ Shared' : 'Share with patient'}
                                                        </button>
                                                    </>)}
                                                </div>
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
