import { type PatientWithHistory, type MedicalProcedure, type Referral } from '../../../../shared/types';
import { TabSkeleton } from '../../../../shared/components/SectionCard';
import { toast, parseApiError } from '../../../../shared/components/ui';
import api from '../../../../shared/services/api';
import { useQueryClient } from '@tanstack/react-query';
import ReferralMessageThread from '../../../referrals/components/ReferralMessageThread';
import ReferralSnapshotView from '../../../referrals/components/ReferralSnapshotView';
import ReferralEventTimeline from '../../../referrals/components/ReferralEventTimeline';
import ReferralSLABadge from '../../../referrals/components/ReferralSLABadge';

const COMMON_ALLERGENS = [
    'Penicillin', 'Amoxicillin', 'Amoxicillin-Clavulanate', 'Ampicillin', 'Cephalexin',
    'Sulfonamides', 'Trimethoprim-Sulfamethoxazole', 'Aspirin', 'Ibuprofen', 'Naproxen',
    'Diclofenac', 'Codeine', 'Morphine', 'Tramadol', 'Latex',
    'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish',
    'Sesame', 'Bee Venom', 'Wasp Venom', 'Pollen', 'Dust Mites', 'Mold',
    'Cat Dander', 'Dog Dander', 'Nickel', 'Contrast Dye', 'Tetanus Toxoid',
];

const SEVERITY_COLORS: Record<string, string> = {
    mild: '#38a169',
    moderate: '#d69e2e',
    severe: '#e53e3e',
    life_threatening: '#742a2a',
};

const CONDITION_STATUS_COLORS: Record<string, string> = {
    active: '#e53e3e',
    chronic: '#d69e2e',
    in_remission: '#3182ce',
    resolved: '#38a169',
};

interface HistoryTabProps {
    patient: PatientWithHistory;
    id: string;
    canWrite: boolean;
    profile: any;
    proceduresData: MedicalProcedure[];
    proceduresLoading: boolean;
    referralsData: Referral[];
    referralsLoading: boolean;
    showConditionForm: boolean;
    setShowConditionForm: (v: boolean) => void;
    showAllergyForm: boolean;
    setShowAllergyForm: (v: boolean) => void;
    conditionForm: { name: string; icd_code: string; status: string; onset_date: string; notes: string; visible_to_patient: boolean };
    setConditionForm: (f: any) => void;
    editingConditionId: number | null;
    setEditingConditionId: (id: number | null) => void;
    allergyForm: { allergen: string; reaction_type: string; severity: string; reaction_description: string; is_active: boolean; visible_to_patient: boolean };
    setAllergyForm: (f: any) => void;
    allergenSuggestions: string[];
    setAllergenSuggestions: (s: string[]) => void;
    showAllergenSuggestions: boolean;
    setShowAllergenSuggestions: (v: boolean) => void;
    formLoading: boolean;
    handleConditionSubmit: (e: React.FormEvent) => void;
    handleAllergySubmit: (e: React.FormEvent) => void;
    handleToggleAllergy: (id: number, current: boolean) => void;
    handleToggleVisibleToPatient: (resource: 'conditions' | 'allergies' | 'prescriptions', itemId: number, current: boolean) => void;
    setConfirmDeleteConditionId: (id: number | null) => void;
    setConfirmDeleteAllergyId: (id: number | null) => void;
    setConfirmDeleteProcedureId: (id: number | null) => void;
    setConfirmDeleteReferralId: (id: number | null) => void;
    setProcedureToEdit: (p: MedicalProcedure | null) => void;
    setShowProcedureForm: (v: boolean) => void;
    setReferralToEdit: (r: Referral | null) => void;
    setShowReferralForm: (v: boolean) => void;
    downloadFile: (url: string | null | undefined, name?: string) => void;
    resultFormReferralId: number | null;
    setResultFormReferralId: (id: number | null) => void;
    resultText: string;
    setResultText: (t: string) => void;
    resultSubmitting: boolean;
    setResultSubmitting: (v: boolean) => void;
    cancelFormReferralId: number | null;
    setCancelFormReferralId: (id: number | null) => void;
    cancelReason: string;
    setCancelReason: (r: string) => void;
    cancelSubmitting: boolean;
    setCancelSubmitting: (v: boolean) => void;
    recallFormReferralId: number | null;
    setRecallFormReferralId: (id: number | null) => void;
    recallReason: string;
    setRecallReason: (r: string) => void;
    recallSubmitting: boolean;
    setRecallSubmitting: (v: boolean) => void;
    openThreadReferralId: number | null;
    setOpenThreadReferralId: (id: number | null) => void;
}

const HistoryTab = ({
    patient,
    id,
    canWrite,
    profile,
    proceduresData,
    proceduresLoading,
    referralsData,
    referralsLoading,
    showConditionForm,
    setShowConditionForm,
    showAllergyForm,
    setShowAllergyForm,
    conditionForm,
    setConditionForm,
    editingConditionId,
    setEditingConditionId,
    allergyForm,
    setAllergyForm,
    allergenSuggestions,
    setAllergenSuggestions,
    showAllergenSuggestions,
    setShowAllergenSuggestions,
    formLoading,
    handleConditionSubmit,
    handleAllergySubmit,
    handleToggleAllergy,
    handleToggleVisibleToPatient,
    setConfirmDeleteConditionId,
    setConfirmDeleteAllergyId,
    setConfirmDeleteProcedureId,
    setConfirmDeleteReferralId,
    setProcedureToEdit,
    setShowProcedureForm,
    setReferralToEdit,
    setShowReferralForm,
    downloadFile,
    resultFormReferralId,
    setResultFormReferralId,
    resultText,
    setResultText,
    resultSubmitting,
    setResultSubmitting,
    cancelFormReferralId,
    setCancelFormReferralId,
    cancelReason,
    setCancelReason,
    cancelSubmitting,
    setCancelSubmitting,
    recallFormReferralId,
    setRecallFormReferralId,
    recallReason,
    setRecallReason,
    recallSubmitting,
    setRecallSubmitting,
    openThreadReferralId,
    setOpenThreadReferralId,
}: HistoryTabProps) => {
    const queryClient = useQueryClient();
    const activeAllergies = patient.allergy_records?.filter(a => a.is_active) || [];

    return (
        <div className="tab-panel">
            {/* ── Conditions section ── */}
            <div className="tab-section">
                <div className="tab-panel-header">
                    <h3>Conditions <span className="section-count">({patient.conditions?.length || 0})</span></h3>
                    <button
                        className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                        disabled={!canWrite}
                        title={!canWrite ? 'Patient record is read-only' : undefined}
                        onClick={() => { if (canWrite) setShowConditionForm(!showConditionForm); }}
                    >+ Add Condition</button>
                </div>
                {showConditionForm && (
                    <form onSubmit={handleConditionSubmit} className="inline-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Condition Name *</label>
                                <input required value={conditionForm.name} onChange={e => setConditionForm((p: any) => ({ ...p, name: e.target.value }))} placeholder="e.g. Type 2 Diabetes" />
                            </div>
                            <div className="form-group">
                                <label>ICD Code</label>
                                <input value={conditionForm.icd_code} onChange={e => setConditionForm((p: any) => ({ ...p, icd_code: e.target.value }))} placeholder="e.g. E11" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Status</label>
                                <select value={conditionForm.status} onChange={e => setConditionForm((p: any) => ({ ...p, status: e.target.value }))}>
                                    <option value="active">Active</option>
                                    <option value="chronic">Chronic</option>
                                    <option value="in_remission">In Remission</option>
                                    <option value="resolved">Resolved</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Onset Date</label>
                                <input type="date" value={conditionForm.onset_date} onChange={e => setConditionForm((p: any) => ({ ...p, onset_date: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Notes</label>
                            <textarea rows={2} value={conditionForm.notes} onChange={e => setConditionForm((p: any) => ({ ...p, notes: e.target.value }))} />
                        </div>
                        <div className="form-group form-checkbox">
                            <label>
                                <input type="checkbox" checked={conditionForm.visible_to_patient} onChange={e => setConditionForm((p: any) => ({ ...p, visible_to_patient: e.target.checked }))} />
                                {' '}Visible to patient on portal
                            </label>
                        </div>
                        <div className="form-actions">
                            <button type="submit" disabled={formLoading}>{formLoading ? 'Saving...' : 'Save Condition'}</button>
                            <button type="button" onClick={() => setShowConditionForm(false)} className="cancel-button">Cancel</button>
                        </div>
                    </form>
                )}
                {patient.conditions?.length ? (
                    <div className="conditions-grid">
                        {patient.conditions.map(c => (
                            <div key={c.id} className="condition-card">
                                {editingConditionId === c.id ? (
                                    <form onSubmit={handleConditionSubmit} className="inline-form">
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Name *</label>
                                                <input required value={conditionForm.name} onChange={e => setConditionForm((p: any) => ({ ...p, name: e.target.value }))} />
                                            </div>
                                            <div className="form-group">
                                                <label>ICD Code</label>
                                                <input value={conditionForm.icd_code} onChange={e => setConditionForm((p: any) => ({ ...p, icd_code: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Status</label>
                                                <select value={conditionForm.status} onChange={e => setConditionForm((p: any) => ({ ...p, status: e.target.value }))}>
                                                    <option value="active">Active</option>
                                                    <option value="chronic">Chronic</option>
                                                    <option value="resolved">Resolved</option>
                                                    <option value="in_remission">In Remission</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Onset Date</label>
                                                <input type="date" value={conditionForm.onset_date} onChange={e => setConditionForm((p: any) => ({ ...p, onset_date: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label>Notes</label>
                                            <textarea rows={2} value={conditionForm.notes} onChange={e => setConditionForm((p: any) => ({ ...p, notes: e.target.value }))} />
                                        </div>
                                        <div className="form-group form-checkbox">
                                            <label>
                                                <input type="checkbox" checked={conditionForm.visible_to_patient} onChange={e => setConditionForm((p: any) => ({ ...p, visible_to_patient: e.target.checked }))} />
                                                {' '}Visible to patient on portal
                                            </label>
                                        </div>
                                        <div className="form-actions">
                                            <button type="submit" disabled={formLoading}>{formLoading ? 'Saving...' : 'Update'}</button>
                                            <button type="button" onClick={() => { setEditingConditionId(null); setConditionForm({ name: '', icd_code: '', status: 'active', onset_date: '', notes: '', visible_to_patient: false }); }} className="cancel-button">Cancel</button>
                                        </div>
                                    </form>
                                ) : (
                                    <>
                                        <div className="condition-card-header">
                                            <div>
                                                <span className="condition-name">{c.name}</span>
                                                {c.icd_code && <span className="icd-code">{c.icd_code}</span>}
                                            </div>
                                            <span className="condition-status" style={{ background: CONDITION_STATUS_COLORS[c.status] + '22', color: CONDITION_STATUS_COLORS[c.status], border: `1px solid ${CONDITION_STATUS_COLORS[c.status]}` }}>
                                                {c.status_display || c.status}
                                            </span>
                                        </div>
                                        {c.onset_date && <div className="condition-meta">Since: {new Date(c.onset_date).toLocaleDateString()}</div>}
                                        {c.notes && <p className="condition-notes">{c.notes}</p>}
                                        <div className="entry-actions">
                                            <button onClick={() => { setEditingConditionId(c.id); setConditionForm({ name: c.name, icd_code: c.icd_code || '', status: c.status, onset_date: c.onset_date || '', notes: c.notes || '', visible_to_patient: c.visible_to_patient ?? false }); }} className="action-button">Edit</button>
                                            <button
                                                onClick={() => handleToggleVisibleToPatient('conditions', c.id, c.visible_to_patient ?? false)}
                                                className="action-button"
                                                style={{ color: c.visible_to_patient ? 'var(--success)' : 'var(--accent)' }}
                                            >
                                                {c.visible_to_patient ? '✓ Patient can see' : 'Show to patient'}
                                            </button>
                                            <button onClick={() => setConfirmDeleteConditionId(c.id)} className="delete-button action-button">Delete</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ) : <p className="muted">No conditions recorded.</p>}
            </div>

            {/* ── Allergies section ── */}
            <div className="pt-section tab-section tab-section--divider">
                <div className="tab-panel-header">
                    <h3>Allergies <span className="section-count">({activeAllergies.length} active)</span></h3>
                    <button
                        className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                        disabled={!canWrite}
                        title={!canWrite ? 'Patient record is read-only' : undefined}
                        onClick={() => { if (canWrite) setShowAllergyForm(!showAllergyForm); }}
                    >+ Add Allergy</button>
                </div>
                {showAllergyForm && (
                    <form onSubmit={handleAllergySubmit} className="inline-form">
                        <div className="form-row">
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label>Allergen *</label>
                                <input
                                    required
                                    value={allergyForm.allergen}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setAllergyForm((p: any) => ({ ...p, allergen: val }));
                                        if (val.length >= 2) {
                                            setAllergenSuggestions(
                                                COMMON_ALLERGENS.filter(a => a.toLowerCase().includes(val.toLowerCase())).slice(0, 8)
                                            );
                                            setShowAllergenSuggestions(true);
                                        } else {
                                            setAllergenSuggestions([]);
                                            setShowAllergenSuggestions(false);
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => setShowAllergenSuggestions(false), 150)}
                                    autoComplete="off"
                                    placeholder="e.g. Penicillin"
                                />
                                {showAllergenSuggestions && allergenSuggestions.length > 0 && (
                                    <ul className="allergen-suggestions-dropdown">
                                        {allergenSuggestions.map(a => (
                                            <li key={a}>
                                                <button type="button" onMouseDown={() => {
                                                    setAllergyForm((p: any) => ({ ...p, allergen: a }));
                                                    setShowAllergenSuggestions(false);
                                                    setAllergenSuggestions([]);
                                                }}>
                                                    {a}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Type</label>
                                <select value={allergyForm.reaction_type} onChange={e => setAllergyForm((p: any) => ({ ...p, reaction_type: e.target.value }))}>
                                    <option value="drug">Drug</option>
                                    <option value="food">Food</option>
                                    <option value="environmental">Environmental</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Severity</label>
                            <select value={allergyForm.severity} onChange={e => setAllergyForm((p: any) => ({ ...p, severity: e.target.value }))}>
                                <option value="mild">Mild</option>
                                <option value="moderate">Moderate</option>
                                <option value="severe">Severe</option>
                                <option value="life_threatening">Life Threatening</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Reaction Description</label>
                            <textarea rows={2} value={allergyForm.reaction_description} onChange={e => setAllergyForm((p: any) => ({ ...p, reaction_description: e.target.value }))} />
                        </div>
                        <div className="form-group form-checkbox">
                            <label>
                                <input type="checkbox" checked={allergyForm.visible_to_patient} onChange={e => setAllergyForm((p: any) => ({ ...p, visible_to_patient: e.target.checked }))} />
                                {' '}Visible to patient on portal
                            </label>
                        </div>
                        <div className="form-actions">
                            <button type="submit" disabled={formLoading}>{formLoading ? 'Saving...' : 'Save Allergy'}</button>
                            <button type="button" onClick={() => setShowAllergyForm(false)} className="cancel-button">Cancel</button>
                        </div>
                    </form>
                )}
                {patient.allergy_records?.length ? (
                    <div className="allergies-list">
                        {patient.allergy_records.map(a => (
                            <div key={a.id} className={`allergy-card${!a.is_active ? ' inactive' : ''}`}>
                                <div className="allergy-card-header">
                                    <div>
                                        <span className="allergen-name">{a.allergen}</span>
                                        <span className="allergy-type">{a.reaction_type_display || a.reaction_type}</span>
                                    </div>
                                    <span className="severity-badge" style={{ background: SEVERITY_COLORS[a.severity] + '22', color: SEVERITY_COLORS[a.severity], border: `1px solid ${SEVERITY_COLORS[a.severity]}` }}>
                                        {a.severity_display || a.severity}
                                    </span>
                                </div>
                                {a.reaction_description && <p className="allergy-desc">{a.reaction_description}</p>}
                                {!a.is_active && <span className="inactive-label">Inactive</span>}
                                <div className="entry-actions">
                                    <button onClick={() => handleToggleAllergy(a.id, a.is_active)} className="action-button">
                                        {a.is_active ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button
                                        onClick={() => handleToggleVisibleToPatient('allergies', a.id, a.visible_to_patient ?? true)}
                                        className="action-button"
                                        style={{ color: a.visible_to_patient !== false ? 'var(--success)' : 'var(--accent)' }}
                                    >
                                        {a.visible_to_patient !== false ? '✓ Patient can see' : 'Show to patient'}
                                    </button>
                                    <button onClick={() => setConfirmDeleteAllergyId(a.id)} className="delete-button action-button">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <p className="muted">No allergies recorded.</p>}
            </div>

            {/* ── Procedures section ── */}
            <div className="pt-section tab-section tab-section--divider">
                <div className="tab-panel-header">
                    <h3>Procedures <span className="section-count">({patient.medical_procedures?.length || 0})</span></h3>
                    {(profile?.access_level ?? 1) >= 2 && (
                        <button
                            className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                            disabled={!canWrite}
                            title={!canWrite ? 'Patient record is read-only' : undefined}
                            onClick={() => { if (canWrite) { setProcedureToEdit(null); setShowProcedureForm(true); } }}
                        >+ Add Procedure</button>
                    )}
                </div>
                {proceduresLoading ? (
                    <TabSkeleton rows={4} />
                ) : proceduresData.length > 0 ? (
                    <ul className="detail-list">
                        {proceduresData.map(p => (
                            <li key={p.id} className="procedure-entry detail-list-item">
                                <h4>{p.procedure_type} — {new Date(p.procedure_date).toLocaleDateString()}</h4>
                                {p.result && <div className="info-item"><strong>Result:</strong> {p.result}</div>}
                                {p.attachments && (
                                    <button onClick={() => downloadFile(p.attachments, `procedure_${p.id}`)} className="download-link">Download attachment</button>
                                )}
                                <div className="entry-actions">
                                    <button onClick={() => { setProcedureToEdit(p); setShowProcedureForm(true); }} className="edit-button action-button">Edit</button>
                                    <button onClick={() => setConfirmDeleteProcedureId(p.id)} className="delete-button action-button">Delete</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : <p className="muted">No procedures recorded.</p>}
            </div>

            {/* ── Referrals section ── */}
            <div className="pt-section tab-section tab-section--divider">
                <div className="tab-panel-header">
                    <h3>Referrals <span className="section-count">({patient.referrals?.length || 0})</span></h3>
                    <button
                        className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                        disabled={!canWrite}
                        title={!canWrite ? 'Patient record is read-only' : undefined}
                        onClick={() => { if (canWrite) { setReferralToEdit(null); setShowReferralForm(true); } }}
                    >+ Add Referral</button>
                </div>
                {referralsLoading ? (
                    <TabSkeleton rows={4} />
                ) : referralsData.length > 0 ? (
                    <ul className="detail-list">
                        {referralsData.map(r => {
                            const isReferringDoctor = profile?.id === r.referred_by;
                            const isReceivingDoctor = profile?.id === r.referred_to;
                            const canSubmitResult = isReceivingDoctor && ['accepted', 'in_progress'].includes(r.status);
                            const canCancel = isReferringDoctor && ['pending', 'accepted'].includes(r.status);
                            const canRecall = isReferringDoctor && ['pending', 'accepted', 'in_progress', 'returned'].includes(r.status);
                            const canEdit = isReferringDoctor && ['draft', 'pending', 'returned'].includes(r.status);
                            const canDelete = isReferringDoctor && ['draft', 'pending', 'rejected', 'cancelled', 'recalled', 'expired'].includes(r.status);
                            const isReturnedToMe = isReferringDoctor && r.status === 'returned';
                            const showResultForm = resultFormReferralId === r.id;
                            const showCancelForm = cancelFormReferralId === r.id;
                            const showRecallForm = recallFormReferralId === r.id;
                            return (
                                <li key={r.id} className="referral-entry detail-list-item">
                                    {r.sla_breached && (
                                        <div style={{ background: 'var(--color-danger-bg, #fef2f2)', color: 'var(--color-danger, #dc2626)', fontSize: '0.78rem', fontWeight: 600, padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                                            ⚠ SLA breached — response overdue
                                        </div>
                                    )}
                                    {isReturnedToMe && (
                                        <div style={{ background: 'var(--color-warning-bg, #fffbeb)', border: '1px solid var(--color-warning, #f59e0b)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.65rem', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                                            <strong>Specialist returned for more information.</strong>
                                            {r.return_reason && <span> "{r.return_reason}"</span>}
                                            {r.return_requested_info && (
                                                <div style={{ marginTop: '0.25rem' }}><strong>Needs:</strong> {r.return_requested_info}</div>
                                            )}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <h4 style={{ margin: 0 }}>{new Date(r.date_of_referral).toLocaleDateString()}</h4>
                                            {r.is_draft && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Draft</span>}
                                            {r.referral_type_display && (
                                                <span style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.1rem 0.4rem' }}>
                                                    {r.referral_type_display}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {r.sla_due_at && !r.sla_breached && r.urgency !== 'routine' && (
                                                <ReferralSLABadge sla_due_at={r.sla_due_at} sla_breached={false} urgency={r.urgency} />
                                            )}
                                            <span className={`status-badge status-${r.status}`}>{r.status_display || r.status}</span>
                                        </div>
                                    </div>

                                    <div className="info-item"><strong>Referred by:</strong> {r.referred_by_details?.full_name || '—'}</div>
                                    <div className="info-item"><strong>Referred to:</strong> {r.referred_to_details?.full_name || (r.is_external ? `${r.external_doctor_name || 'External'} · ${r.external_hospital}` : '—')}</div>
                                    <div className="info-item"><strong>Specialty:</strong> {r.specialty_display || r.specialty_requested}</div>
                                    <div className="info-item"><strong>Urgency:</strong> {r.urgency_display || r.urgency}</div>
                                    <div className="info-item"><strong>Reason:</strong> {r.reason_for_referral}</div>
                                    {r.comments && <div className="info-item"><strong>Referral note:</strong> {r.comments}</div>}

                                    <div className="info-item" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                                        {r.accepted_at && <span>Accepted {new Date(r.accepted_at).toLocaleDateString()}</span>}
                                        {r.in_progress_at && <span>In Progress {new Date(r.in_progress_at).toLocaleDateString()}</span>}
                                        {r.returned_at && <span>Returned {new Date(r.returned_at).toLocaleDateString()}</span>}
                                        {r.completed_at && <span>Completed {new Date(r.completed_at).toLocaleDateString()}</span>}
                                        {r.rejected_at && <span>Rejected {new Date(r.rejected_at).toLocaleDateString()}</span>}
                                        {r.cancelled_at && <span>Cancelled {new Date(r.cancelled_at).toLocaleDateString()}</span>}
                                        {r.recalled_at && <span>Recalled {new Date(r.recalled_at).toLocaleDateString()}</span>}
                                        {r.expired_at && <span>Expired {new Date(r.expired_at).toLocaleDateString()}</span>}
                                    </div>

                                    {r.response_notes && <div className="info-item"><strong>Response note:</strong> {r.response_notes}</div>}
                                    {r.cancellation_reason && <div className="info-item" style={{ color: 'var(--text-muted)' }}><strong>Cancellation reason:</strong> {r.cancellation_reason}</div>}
                                    {r.recall_reason && <div className="info-item" style={{ color: 'var(--text-muted)' }}><strong>Recall reason:</strong> {r.recall_reason}</div>}

                                    {r.result ? (
                                        <div className="info-item" style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.875rem', marginTop: '0.5rem' }}>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                                Specialist Result
                                                {r.result_submitted_at && <span style={{ fontWeight: 400, marginLeft: 6 }}>· {new Date(r.result_submitted_at).toLocaleDateString()}</span>}
                                            </div>
                                            <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{r.result}</div>
                                        </div>
                                    ) : (
                                        canSubmitResult && !showResultForm && (
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>No result submitted yet.</p>
                                        )
                                    )}

                                    {canSubmitResult && (
                                        <div style={{ marginTop: '0.75rem' }}>
                                            {showResultForm ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    <textarea
                                                        className="textarea"
                                                        rows={4}
                                                        placeholder="Clinical findings, diagnosis, recommendations…"
                                                        value={resultText}
                                                        onChange={e => setResultText(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                                                        Submitting a result marks this referral as completed.
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            disabled={!resultText.trim() || resultSubmitting}
                                                            onClick={async () => {
                                                                setResultSubmitting(true);
                                                                try {
                                                                    await api.post(`/referrals/${r.id}/result/`, { result: resultText.trim() });
                                                                    toast.success('Result submitted. Referral marked as completed.');
                                                                    setResultFormReferralId(null);
                                                                    setResultText('');
                                                                    queryClient.invalidateQueries({ queryKey: ['patients', id, 'referrals'] });
                                                                } catch (err) {
                                                                    toast.error(parseApiError(err, 'Could not submit result.'));
                                                                } finally {
                                                                    setResultSubmitting(false);
                                                                }
                                                            }}
                                                        >
                                                            {resultSubmitting ? 'Saving…' : 'Submit & Complete'}
                                                        </button>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => { setResultFormReferralId(null); setResultText(''); }}>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => { setResultText(r.result || ''); setResultFormReferralId(r.id); }}
                                                >
                                                    {r.result ? '✎ Update Result' : '+ Submit Result'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {canCancel && (
                                        <div style={{ marginTop: '0.75rem' }}>
                                            {showCancelForm ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    <textarea
                                                        className="textarea"
                                                        rows={2}
                                                        placeholder="Cancellation reason (optional)…"
                                                        value={cancelReason}
                                                        onChange={e => setCancelReason(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            className="btn btn-sm"
                                                            style={{ background: 'var(--error)', color: '#fff', border: 'none' }}
                                                            disabled={cancelSubmitting}
                                                            onClick={async () => {
                                                                setCancelSubmitting(true);
                                                                try {
                                                                    await api.post(`/referrals/${r.id}/cancel/`, { reason: cancelReason.trim() });
                                                                    toast.success('Referral cancelled.');
                                                                    setCancelFormReferralId(null);
                                                                    setCancelReason('');
                                                                    queryClient.invalidateQueries({ queryKey: ['patients', id, 'referrals'] });
                                                                } catch (err) {
                                                                    toast.error(parseApiError(err, 'Could not cancel referral.'));
                                                                } finally {
                                                                    setCancelSubmitting(false);
                                                                }
                                                            }}
                                                        >
                                                            {cancelSubmitting ? 'Cancelling…' : 'Confirm Cancel'}
                                                        </button>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => { setCancelFormReferralId(null); setCancelReason(''); }}>
                                                            Keep Referral
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: 'var(--error)' }}
                                                    onClick={() => setCancelFormReferralId(r.id)}
                                                >
                                                    Cancel Referral
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {canRecall && !showCancelForm && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            {showRecallForm ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    <textarea
                                                        className="textarea"
                                                        rows={2}
                                                        placeholder="Recall reason (optional)…"
                                                        value={recallReason}
                                                        onChange={e => setRecallReason(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            className="btn btn-sm"
                                                            style={{ background: 'var(--color-warning, #f59e0b)', color: '#fff', border: 'none' }}
                                                            disabled={recallSubmitting}
                                                            onClick={async () => {
                                                                setRecallSubmitting(true);
                                                                try {
                                                                    const { recallReferral: doRecall } = await import('../../../referrals/services/referralService');
                                                                    await doRecall(r.id, recallReason.trim() || undefined);
                                                                    toast.success('Referral recalled.');
                                                                    setRecallFormReferralId(null);
                                                                    setRecallReason('');
                                                                    queryClient.invalidateQueries({ queryKey: ['patients', id, 'referrals'] });
                                                                } catch (err) {
                                                                    toast.error(parseApiError(err, 'Could not recall referral.'));
                                                                } finally {
                                                                    setRecallSubmitting(false);
                                                                }
                                                            }}
                                                        >
                                                            {recallSubmitting ? 'Recalling…' : 'Confirm Recall'}
                                                        </button>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => { setRecallFormReferralId(null); setRecallReason(''); }}>
                                                            Keep Referral
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: 'var(--color-warning, #b45309)' }}
                                                    onClick={() => setRecallFormReferralId(r.id)}
                                                >
                                                    Recall Referral
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {!r.is_draft && <ReferralSnapshotView referralId={r.id} />}
                                    <ReferralEventTimeline referralId={r.id} />

                                    {!r.is_draft && !r.is_external && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                                                onClick={() => setOpenThreadReferralId(openThreadReferralId === r.id ? null : r.id)}
                                            >
                                                {openThreadReferralId === r.id ? '▾ Hide Messages' : '▸ Messages'}
                                            </button>
                                            {openThreadReferralId === r.id && profile?.id !== undefined && (
                                                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                                                    <ReferralMessageThread referralId={r.id} currentDoctorId={profile.id} />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="entry-actions">
                                        {canEdit && (
                                            <button onClick={() => { setReferralToEdit(r); setShowReferralForm(true); }} className="edit-button action-button">Edit</button>
                                        )}
                                        {canDelete && (
                                            <button onClick={() => setConfirmDeleteReferralId(r.id)} className="delete-button action-button">Delete</button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : <p className="muted">No referrals recorded.</p>}
            </div>
        </div>
    );
};

export default HistoryTab;
