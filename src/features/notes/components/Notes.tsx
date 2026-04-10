import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import '../../../shared/styles/DetailStyles.css';
import '../../../shared/styles/TextStyles.css';
import './Notes.css';
import api from '../../../shared/services/api';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import PageLoader from '../../../shared/components/PageLoader';

interface Note {
    id: number;
    title: string;
    content: string;
    note_type: string;
    note_type_display: string;
    patient: string | null;
    patient_name?: string;
    author_name?: string;
    created_at: string;
    updated_at: string;
}

interface PatientOption {
    unique_id: string;
    first_name: string;
    last_name: string;
}

const NOTE_TYPE_OPTIONS = [
    { value: 'general', label: 'General Note' },
    { value: 'clinical', label: 'Clinical Note' },
    { value: 'follow_up', label: 'Follow-up Note' },
    { value: 'referral', label: 'Referral Note' },
    { value: 'prescription', label: 'Prescription Note' },
    { value: 'lab', label: 'Lab Result Note' },
    { value: 'private', label: 'Private Note' },
];

const NOTE_TYPE_COLORS: Record<string, string> = {
    general: '#718096',
    clinical: '#3182ce',
    follow_up: '#38a169',
    referral: '#805ad5',
    prescription: '#d69e2e',
    lab: '#ed8936',
    private: '#e53e3e',
};

const Notes = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const prefilledPatientId = searchParams.get('patient') || '';

    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<number | null>(null);

    // Filters
    const [filterType, setFilterType] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        note_type: 'general',
        patient: prefilledPatientId,
    });
    const [formLoading, setFormLoading] = useState(false);
    const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
    const [patientSearch, setPatientSearch] = useState('');
    const [patientSearchResults, setPatientSearchResults] = useState<PatientOption[]>([]);

    // Auto-open form when patient is pre-filled via URL
    useEffect(() => {
        if (prefilledPatientId) {
            setShowForm(true);
            setFormData(prev => ({ ...prev, patient: prefilledPatientId }));
        }
    }, [prefilledPatientId]);

    // Once patients load, set patientSearch display name for pre-filled patient
    useEffect(() => {
        if (prefilledPatientId && patientOptions.length > 0 && !patientSearch) {
            const found = patientOptions.find(p => p.unique_id === prefilledPatientId);
            if (found) setPatientSearch(`${found.first_name} ${found.last_name}`);
        }
    }, [prefilledPatientId, patientOptions, patientSearch]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchNotes = useCallback(async () => {
        try {
            const params: Record<string, string> = {};
            if (debouncedSearch) params.search = debouncedSearch;
            if (filterType) params.note_type = filterType;
            const res = await api.get('/notes/', { params });
            setNotes(res.data.results ?? res.data);
            setError(null);
        } catch {
            setError(t('notes.error.load'));
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, filterType, t]);

    useEffect(() => { fetchNotes(); }, [fetchNotes]);

    // Fetch patients for the patient selector
    useEffect(() => {
        api.get('/doctors/me/patients/?page_size=200')
            .then(res => setPatientOptions(res.data.results ?? res.data))
            .catch(() => {});
    }, []);

    // Patient search filter for selector
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

    const handleNewNote = () => {
        setShowForm(true);
        setEditingNote(null);
        setFormData({ title: '', content: '', note_type: 'general', patient: '' });
        setPatientSearch('');
    };

    const handleEdit = (note: Note) => {
        setShowForm(true);
        setEditingNote(note);
        setFormData({
            title: note.title,
            content: note.content,
            note_type: note.note_type,
            patient: note.patient || '',
        });
        setPatientSearch('');
    };

    const handleDelete = async (noteId: number) => {
        try {
            await api.delete(`/notes/${noteId}/`);
            setNotes(prev => prev.filter(n => n.id !== noteId));
            setConfirmDeleteNoteId(null);
        } catch {
            setError(t('notes.error.delete'));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            const payload = {
                ...formData,
                patient: formData.patient || null,
            };
            if (editingNote) {
                await api.put(`/notes/${editingNote.id}/`, payload);
            } else {
                await api.post('/notes/', payload);
            }
            setShowForm(false);
            setEditingNote(null);
            fetchNotes();
        } catch {
            setError(t('notes.error.save'));
        } finally {
            setFormLoading(false);
        }
    };

    if (loading) return <PageLoader message={t('notes.loading_page')} />;
    if (error) return <div className="text-page-container error-message">{error}</div>;

    return (
        <div className="notes-page">
            <div className="notes-page-header">
                <div>
                    <h1>{t('notes.title')}</h1>
                    <p className="notes-sub">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={handleNewNote} className="btn-new-note">
                    + New Note
                </button>
            </div>

            {/* Filters */}
            <div className="notes-filters">
                <input
                    type="text"
                    placeholder="Search notes..."
                    className="notes-search"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <select
                    className="notes-type-filter"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="">All types</option>
                    {NOTE_TYPE_OPTIONS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
            </div>

            {/* Note Form */}
            {showForm && (
                <div className="note-form-card">
                    <h3>{editingNote ? t('notes.edit_title') : t('notes.add_title')}</h3>
                    <form onSubmit={handleSubmit} className="note-form">
                        <div className="note-form-row">
                            <div className="form-group">
                                <label>Title *</label>
                                <input name="title" value={formData.title} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label>Note Type</label>
                                <select name="note_type" value={formData.note_type} onChange={handleChange}>
                                    {NOTE_TYPE_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Patient selector */}
                        <div className="form-group">
                            <label>Link to Patient (optional)</label>
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
                                            : formData.patient}
                                        <button type="button" onClick={() => { setFormData(f => ({ ...f, patient: '' })); setPatientSearch(''); }}>×</button>
                                    </span>
                                )}
                                {patientSearchResults.length > 0 && !formData.patient && (
                                    <ul className="patient-selector-dropdown">
                                        {patientSearchResults.map(p => (
                                            <li key={p.unique_id}>
                                                <button type="button" onClick={() => {
                                                    setFormData(f => ({ ...f, patient: p.unique_id }));
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

                        <div className="form-group">
                            <label>Content *</label>
                            <textarea name="content" value={formData.content} onChange={handleChange} required rows={6} />
                        </div>

                        <div className="note-form-actions">
                            <button type="submit" disabled={formLoading} className="btn-save-note">
                                {formLoading ? 'Saving...' : (editingNote ? 'Update Note' : 'Create Note')}
                            </button>
                            <button type="button" onClick={() => { setShowForm(false); setEditingNote(null); }} className="btn-cancel-note">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Notes grid */}
            {!showForm && (
                <>
                    {notes.length === 0 ? (
                        <div className="notes-empty">
                            <p>No notes yet. Create your first note.</p>
                        </div>
                    ) : (
                        <div className="notes-grid">
                            {notes.map(note => (
                                <div key={note.id} className="note-card">
                                    <div className="note-card-header">
                                        <span
                                            className="note-type-badge"
                                            style={{ background: `${NOTE_TYPE_COLORS[note.note_type] || '#718096'}20`, color: NOTE_TYPE_COLORS[note.note_type] || '#718096', border: `1px solid ${NOTE_TYPE_COLORS[note.note_type] || '#718096'}40` }}
                                        >
                                            {note.note_type_display || note.note_type}
                                        </span>
                                        <span className="note-date">{new Date(note.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <h4 className="note-title">{note.title}</h4>
                                    {note.patient && (
                                        <div className="note-patient-link">
                                            <Link to={`/patients/${note.patient}`}>Patient record →</Link>
                                        </div>
                                    )}
                                    <p className="note-content">{note.content}</p>
                                    <div className="note-card-footer">
                                        {note.author_name && <span className="note-author">{note.author_name}</span>}
                                        <div className="note-actions">
                                            <button onClick={() => handleEdit(note)} className="note-btn note-btn--edit">Edit</button>
                                            <button onClick={() => setConfirmDeleteNoteId(note.id)} className="note-btn note-btn--delete">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {confirmDeleteNoteId !== null && (
                <ConfirmModal
                    message={t('notes.delete_confirm')}
                    onConfirm={() => handleDelete(confirmDeleteNoteId)}
                    onCancel={() => setConfirmDeleteNoteId(null)}
                />
            )}
        </div>
    );
};

export default Notes;
