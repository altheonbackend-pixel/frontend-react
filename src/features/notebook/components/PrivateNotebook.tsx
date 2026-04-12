import { useState, useEffect } from 'react';
import { type NotebookEntry } from '../../../shared/types';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import api from '../../../shared/services/api';
import '../styles/PrivateNotebook.css';

const EMPTY_FORM = { title: '', content: '' };

function PrivateNotebook() {
    const [entries, setEntries] = useState<NotebookEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [searchQ, setSearchQ] = useState('');

    useEffect(() => { fetchEntries(); }, []);

    const fetchEntries = async () => {
        try {
            const res = await api.get('/notebook/');
            setEntries(res.data.results ?? res.data);
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to load notebook.'));
        } finally {
            setLoading(false);
        }
    };

    const openNew = () => {
        setFormData(EMPTY_FORM);
        setEditingId(null);
        setDirty(false);
        setShowForm(true);
    };

    const openEdit = (e: NotebookEntry) => {
        setFormData({ title: e.title, content: e.content });
        setEditingId(e.id);
        setDirty(false);
        setShowForm(true);
    };

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setSaving(true);
        try {
            if (editingId) {
                await api.put(`/notebook/${editingId}/`, formData);
                toast.success('Entry updated.');
            } else {
                await api.post('/notebook/', formData);
                toast.success('Entry created.');
            }
            setDirty(false);
            setShowForm(false);
            fetchEntries();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to save entry.'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/notebook/${id}/`);
            toast.success('Entry deleted.');
            setConfirmDeleteId(null);
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to delete entry.'));
            setConfirmDeleteId(null);
        }
    };

    const filtered = entries.filter(e =>
        !searchQ || e.title.toLowerCase().includes(searchQ.toLowerCase()) || e.content.toLowerCase().includes(searchQ.toLowerCase())
    );

    return (
        <div className="notebook-page">
            <div className="notebook-header">
                <div>
                    <h2>Private Notebook</h2>
                    <p className="notebook-sub">Personal notes — visible only to you, not part of any patient record</p>
                </div>
                <button onClick={openNew} className="btn-new-entry">+ New Entry</button>
            </div>

            <div className="notebook-filters">
                <input
                    type="text"
                    className="notebook-search"
                    placeholder="Search entries..."
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                />
            </div>

            {loading ? (
                <p className="notebook-empty">Loading...</p>
            ) : filtered.length === 0 ? (
                <p className="notebook-empty">
                    {searchQ ? 'No entries match your search.' : 'No entries yet. Start writing.'}
                </p>
            ) : (
                <div className="notebook-grid">
                    {filtered.map(entry => (
                        <div key={entry.id} className="notebook-card">
                            <div className="notebook-card-header">
                                <h4 className="notebook-card-title">{entry.title}</h4>
                                <span className="notebook-card-date">
                                    {new Date(entry.updated_at).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="notebook-card-content">{entry.content}</p>
                            <div className="notebook-card-actions">
                                <button onClick={() => openEdit(entry)} className="nb-btn nb-btn--edit">Edit</button>
                                <button onClick={() => setConfirmDeleteId(entry.id)} className="nb-btn nb-btn--delete">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Drawer
                open={showForm}
                onClose={() => { setShowForm(false); setDirty(false); }}
                title={editingId ? 'Edit Entry' : 'New Entry'}
                size="md"
                dirty={dirty}
                footer={
                    <>
                        <button type="button" onClick={() => setShowForm(false)} className="cancel-button" disabled={saving}>
                            Cancel
                        </button>
                        <button type="submit" form="notebook-form" disabled={saving}>
                            {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                        </button>
                    </>
                }
            >
                <form id="notebook-form" onSubmit={handleSubmit} className="form">
                    <div className="form-group">
                        <label>Title *</label>
                        <input
                            value={formData.title}
                            onChange={e => { setFormData(f => ({ ...f, title: e.target.value })); setDirty(true); }}
                            required
                            placeholder="Entry title..."
                        />
                    </div>
                    <div className="form-group">
                        <label>Content *</label>
                        <textarea
                            value={formData.content}
                            onChange={e => { setFormData(f => ({ ...f, content: e.target.value })); setDirty(true); }}
                            required
                            rows={10}
                            placeholder="Write your notes here..."
                        />
                    </div>
                </form>
            </Drawer>

            {confirmDeleteId !== null && (
                <ConfirmModal
                    message="Delete this notebook entry? This cannot be undone."
                    onConfirm={() => handleDelete(confirmDeleteId)}
                    onCancel={() => setConfirmDeleteId(null)}
                />
            )}
        </div>
    );
}

export default PrivateNotebook;
