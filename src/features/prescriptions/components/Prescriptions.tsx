import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../shared/services/api';
import { type Prescription } from '../../../shared/types';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import '../styles/Prescriptions.css';
import ConfirmModal from '../../../shared/components/ConfirmModal';

const COMMON_DRUGS = [
    'Amoxicillin', 'Amoxicillin-Clavulanate', 'Azithromycin', 'Ciprofloxacin', 'Doxycycline',
    'Metronidazole', 'Trimethoprim-Sulfamethoxazole', 'Cephalexin', 'Clindamycin', 'Erythromycin',
    'Metformin', 'Insulin Glargine', 'Insulin Regular', 'Glipizide', 'Gliclazide', 'Sitagliptin',
    'Lisinopril', 'Enalapril', 'Amlodipine', 'Losartan', 'Valsartan', 'Metoprolol',
    'Atenolol', 'Bisoprolol', 'Carvedilol', 'Furosemide', 'Hydrochlorothiazide', 'Spironolactone',
    'Atorvastatin', 'Simvastatin', 'Rosuvastatin', 'Omeprazole', 'Pantoprazole', 'Esomeprazole',
    'Ranitidine', 'Paracetamol', 'Ibuprofen', 'Aspirin', 'Naproxen', 'Diclofenac',
    'Tramadol', 'Codeine', 'Morphine', 'Prednisolone', 'Dexamethasone', 'Hydrocortisone',
    'Salbutamol', 'Budesonide', 'Fluticasone', 'Montelukast', 'Cetirizine', 'Loratadine',
    'Fexofenadine', 'Levothyroxine', 'Fluoxetine', 'Sertraline', 'Escitalopram', 'Amitriptyline',
    'Diazepam', 'Alprazolam', 'Lorazepam', 'Zolpidem', 'Melatonin', 'Warfarin',
    'Rivaroxaban', 'Apixaban', 'Clopidogrel', 'Allopurinol', 'Colchicine',
];

const FREQUENCY_LABELS: Record<string, string> = {
    once_daily: 'Once daily',
    twice_daily: 'Twice daily',
    three_times_daily: 'Three times daily',
    four_times_daily: 'Four times daily',
    every_8_hours: 'Every 8 hours',
    every_12_hours: 'Every 12 hours',
    as_needed: 'As needed',
    weekly: 'Weekly',
    monthly: 'Monthly',
};

interface PrescriptionFormData {
    patient: string;
    consultation: string;
    medication_name: string;
    dosage: string;
    frequency: string;
    duration_days: string;
    instructions: string;
    is_active: boolean;
}

interface PatientOption {
    unique_id: string;
    first_name: string;
    last_name: string;
}

const EMPTY_FORM: PrescriptionFormData = {
    patient: '',
    consultation: '',
    medication_name: '',
    dosage: '',
    frequency: 'once_daily',
    duration_days: '',
    instructions: '',
    is_active: true,
};

function Prescriptions() {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<PrescriptionFormData>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [editId, setEditId] = useState<number | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);

    // Patient search for form
    const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
    const [patientSearch, setPatientSearch] = useState('');
    const [patientSearchResults, setPatientSearchResults] = useState<PatientOption[]>([]);

    // Drug name autocomplete
    const [drugSuggestions, setDrugSuggestions] = useState<string[]>([]);
    const [showDrugSuggestions, setShowDrugSuggestions] = useState(false);

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    useEffect(() => {
        api.get('/doctors/me/patients/?page_size=200')
            .then(res => setPatientOptions(res.data.results ?? res.data))
            .catch(() => {});
    }, []);

    const fetchPrescriptions = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (filterActive === 'active') params.active = 'true';
            if (filterActive === 'inactive') params.active = 'false';
            const res = await api.get('/prescriptions/', { params });
            const data = res.data;
            setPrescriptions(Array.isArray(data) ? data : data.results || []);
        } catch {
            setError('Failed to load prescriptions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrescriptions();
    }, [filterActive]);

    const handlePatientSearch = (q: string) => {
        setPatientSearch(q);
        if (!q) { setPatientSearchResults([]); return; }
        const lower = q.toLowerCase();
        setPatientSearchResults(
            patientOptions.filter(p =>
                `${p.first_name} ${p.last_name}`.toLowerCase().includes(lower)
            ).slice(0, 6)
        );
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setDirty(true);
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
        if (name === 'medication_name') {
            const q = value.toLowerCase();
            if (q.length >= 2) {
                setDrugSuggestions(COMMON_DRUGS.filter(d => d.toLowerCase().includes(q)).slice(0, 8));
                setShowDrugSuggestions(true);
            } else {
                setDrugSuggestions([]);
                setShowDrugSuggestions(false);
            }
        }
    };

    const openCreateForm = () => {
        setFormData(EMPTY_FORM);
        setEditId(null);
        setPatientSearch('');
        setPatientSearchResults([]);
        setDirty(false);
        setShowForm(true);
    };

    const openEditForm = (p: Prescription) => {
        setFormData({
            patient: p.patient,
            consultation: p.consultation ? String(p.consultation) : '',
            medication_name: p.medication_name,
            dosage: p.dosage,
            frequency: p.frequency,
            duration_days: p.duration_days ? String(p.duration_days) : '',
            instructions: p.instructions,
            is_active: p.is_active,
        });
        setEditId(p.id);
        setPatientSearch(p.patient_name || '');
        setPatientSearchResults([]);
        setDirty(false);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setDirty(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.patient) {
            toast.error('Please select a patient.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...formData,
                duration_days: formData.duration_days ? parseInt(formData.duration_days) : null,
                consultation: formData.consultation ? parseInt(formData.consultation) : null,
            };
            if (editId) {
                await api.put(`/prescriptions/${editId}/`, payload);
                toast.success('Prescription updated.');
            } else {
                await api.post('/prescriptions/', payload);
                toast.success('Prescription created.');
            }
            setDirty(false);
            setShowForm(false);
            fetchPrescriptions();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to save prescription.'));
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (p: Prescription) => {
        try {
            await api.patch(`/prescriptions/${p.id}/`, { is_active: !p.is_active });
            toast.success(p.is_active ? 'Prescription deactivated.' : 'Prescription activated.');
            fetchPrescriptions();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to update prescription.'));
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/prescriptions/${id}/`);
            toast.success('Prescription deleted.');
            setConfirmDeleteId(null);
            fetchPrescriptions();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to delete prescription.'));
            setConfirmDeleteId(null);
        }
    };

    const filtered = prescriptions.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            p.medication_name.toLowerCase().includes(q) ||
            (p.patient_name || p.patient).toLowerCase().includes(q)
        );
    });

    return (
        <div className="prescriptions-page">
            <div className="prescriptions-header">
                <div>
                    <h2>Prescriptions</h2>
                    <p className="prescriptions-sub">Manage all medication prescriptions</p>
                </div>
                <button onClick={openCreateForm} className="btn-create-rx">+ New Prescription</button>
            </div>

            {error && <div className="rx-error">{error}</div>}

            {/* Filters */}
            <div className="rx-filters">
                <div className="rx-filter-tabs">
                    {(['all', 'active', 'inactive'] as const).map(f => (
                        <button
                            key={f}
                            className={`rx-filter-tab${filterActive === f ? ' active' : ''}`}
                            onClick={() => setFilterActive(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <input
                    className="rx-search"
                    type="text"
                    placeholder="Search by medication or patient..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Prescription list */}
            {loading ? (
                <p className="rx-loading">Loading prescriptions...</p>
            ) : filtered.length === 0 ? (
                <p className="rx-empty">No prescriptions found.</p>
            ) : (
                <div className="rx-grid">
                    {filtered.map(p => (
                        <div key={p.id} className={`rx-card${p.is_active ? '' : ' rx-card--inactive'}`}>
                            <div className="rx-card-header">
                                <div className="rx-med-name">{p.medication_name}</div>
                                <span className={`rx-status-badge${p.is_active ? ' active' : ' inactive'}`}>
                                    {p.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="rx-dosage">{p.dosage}</div>
                            <div className="rx-details">
                                <span>{p.frequency_display || FREQUENCY_LABELS[p.frequency] || p.frequency}</span>
                                {p.duration_days && <span> · {p.duration_days} days</span>}
                            </div>
                            {p.patient_name && (
                                <div className="rx-patient">
                                    Patient: <Link to={`/patients/${p.patient}`} className="rx-patient-link">{p.patient_name}</Link>
                                </div>
                            )}
                            {p.instructions && <div className="rx-instructions">{p.instructions}</div>}
                            <div className="rx-meta">Prescribed: {new Date(p.prescribed_at).toLocaleDateString()}</div>
                            <div className="rx-actions">
                                <button onClick={() => openEditForm(p)} className="rx-btn rx-btn--edit">Edit</button>
                                <button onClick={() => handleToggleActive(p)} className="rx-btn rx-btn--toggle">
                                    {p.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button onClick={() => setConfirmDeleteId(p.id)} className="rx-btn rx-btn--delete">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Drawer
                open={showForm}
                onClose={closeForm}
                title={editId ? 'Edit Prescription' : 'New Prescription'}
                size="md"
                dirty={dirty}
                footer={
                    <>
                        <button type="button" onClick={closeForm} className="rx-btn-cancel" disabled={saving}>Cancel</button>
                        <button type="submit" form="prescription-form" disabled={saving} className="rx-btn-submit">
                            {saving ? 'Saving...' : (editId ? 'Update' : 'Create')}
                        </button>
                    </>
                }
            >
                <form id="prescription-form" onSubmit={handleSubmit} className="rx-form">
                    <div className="rx-form-group">
                        <label>Patient *</label>
                        <div className="patient-selector-wrapper">
                            <input
                                type="text"
                                placeholder="Search patient by name..."
                                value={patientSearch}
                                onChange={e => handlePatientSearch(e.target.value)}
                                onFocus={() => handlePatientSearch(patientSearch)}
                            />
                            {formData.patient && (
                                <span className="selected-patient-chip">
                                    {patientOptions.find(p => p.unique_id === formData.patient)
                                        ? `${patientOptions.find(p => p.unique_id === formData.patient)!.first_name} ${patientOptions.find(p => p.unique_id === formData.patient)!.last_name}`
                                        : patientSearch || formData.patient}
                                    <button type="button" onClick={() => { setFormData(f => ({ ...f, patient: '' })); setPatientSearch(''); }}>×</button>
                                </span>
                            )}
                            {patientSearchResults.length > 0 && !formData.patient && (
                                <ul className="patient-selector-dropdown">
                                    {patientSearchResults.map(p => (
                                        <li key={p.unique_id}>
                                            <button type="button" onClick={() => {
                                                setFormData(f => ({ ...f, patient: p.unique_id }));
                                                setDirty(true);
                                                setPatientSearch(`${p.first_name} ${p.last_name}`);
                                                setPatientSearchResults([]);
                                            }}>
                                                {p.first_name} {p.last_name}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="rx-form-row">
                        <div className="rx-form-group" style={{ position: 'relative' }}>
                            <label>Medication Name *</label>
                            <input
                                name="medication_name"
                                value={formData.medication_name}
                                onChange={handleChange}
                                onBlur={() => setTimeout(() => setShowDrugSuggestions(false), 150)}
                                onFocus={() => {
                                    if (formData.medication_name.length >= 2) setShowDrugSuggestions(true);
                                }}
                                autoComplete="off"
                                required
                                placeholder="Type to search or enter name..."
                            />
                            {showDrugSuggestions && drugSuggestions.length > 0 && (
                                <ul className="drug-suggestions-dropdown">
                                    {drugSuggestions.map(d => (
                                        <li key={d}>
                                            <button type="button" onMouseDown={() => {
                                                setFormData(f => ({ ...f, medication_name: d }));
                                                setDirty(true);
                                                setShowDrugSuggestions(false);
                                                setDrugSuggestions([]);
                                            }}>
                                                {d}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="rx-form-group">
                            <label>Dosage *</label>
                            <input name="dosage" value={formData.dosage} onChange={handleChange} required placeholder="e.g. 500mg" />
                        </div>
                    </div>
                    <div className="rx-form-row">
                        <div className="rx-form-group">
                            <label>Frequency *</label>
                            <select name="frequency" value={formData.frequency} onChange={handleChange}>
                                {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="rx-form-group">
                            <label>Duration (days)</label>
                            <input name="duration_days" type="number" value={formData.duration_days} onChange={handleChange} min={1} />
                        </div>
                    </div>
                    <div className="rx-form-group">
                        <label>Instructions</label>
                        <textarea name="instructions" value={formData.instructions} onChange={handleChange} rows={3} />
                    </div>
                    <div className="rx-form-group rx-form-checkbox">
                        <label>
                            <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
                            {' '}Active prescription
                        </label>
                    </div>
                </form>
            </Drawer>

            {confirmDeleteId !== null && (
                <ConfirmModal
                    message="Delete this prescription? This action cannot be undone."
                    onConfirm={() => handleDelete(confirmDeleteId)}
                    onCancel={() => setConfirmDeleteId(null)}
                />
            )}
        </div>
    );
}

export default Prescriptions;
