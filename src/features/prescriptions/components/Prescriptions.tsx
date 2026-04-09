import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../shared/services/api';
import { type Prescription } from '../../../shared/types';
import '../styles/Prescriptions.css';

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

    useEffect(() => {
        fetchPrescriptions();
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const openCreateForm = () => {
        setFormData(EMPTY_FORM);
        setEditId(null);
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
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...formData,
                duration_days: formData.duration_days ? parseInt(formData.duration_days) : null,
                consultation: formData.consultation ? parseInt(formData.consultation) : null,
            };
            if (editId) {
                await api.put(`/prescriptions/${editId}/`, payload);
            } else {
                await api.post('/prescriptions/', payload);
            }
            setShowForm(false);
            fetchPrescriptions();
        } catch {
            setError('Failed to save prescription.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (p: Prescription) => {
        try {
            await api.patch(`/prescriptions/${p.id}/`, { is_active: !p.is_active });
            fetchPrescriptions();
        } catch {
            setError('Failed to update prescription.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Delete this prescription?')) return;
        try {
            await api.delete(`/prescriptions/${id}/`);
            fetchPrescriptions();
        } catch {
            setError('Failed to delete prescription.');
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
                                <button onClick={() => handleDelete(p.id)} className="rx-btn rx-btn--delete">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showForm && (
                <div className="rx-modal-overlay">
                    <div className="rx-modal">
                        <h3>{editId ? 'Edit Prescription' : 'New Prescription'}</h3>
                        <form onSubmit={handleSubmit} className="rx-form">
                            <div className="rx-form-row">
                                <div className="rx-form-group">
                                    <label>Patient ID *</label>
                                    <input name="patient" value={formData.patient} onChange={handleChange} required placeholder="Patient unique ID" />
                                </div>
                                <div className="rx-form-group">
                                    <label>Consultation ID</label>
                                    <input name="consultation" value={formData.consultation} onChange={handleChange} placeholder="Optional" />
                                </div>
                            </div>
                            <div className="rx-form-row">
                                <div className="rx-form-group">
                                    <label>Medication Name *</label>
                                    <input name="medication_name" value={formData.medication_name} onChange={handleChange} required />
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
                            <div className="rx-form-actions">
                                <button type="submit" disabled={saving} className="rx-btn-submit">
                                    {saving ? 'Saving...' : (editId ? 'Update' : 'Create')}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="rx-btn-cancel">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Prescriptions;
