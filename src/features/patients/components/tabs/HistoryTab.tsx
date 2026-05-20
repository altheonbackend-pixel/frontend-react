import { type PatientWithHistory } from '../../../../shared/types';
import { useFormatDateTime } from '../../../../shared/hooks/useUserTimezone';

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
    canWrite: boolean;
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
}

const HistoryTab = ({
    patient,
    canWrite,
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
}: HistoryTabProps) => {
    const { formatDate } = useFormatDateTime();
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
                                        {c.onset_date && <div className="condition-meta">Since: {formatDate(c.onset_date)}</div>}
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
        </div>
    );
};

export default HistoryTab;
