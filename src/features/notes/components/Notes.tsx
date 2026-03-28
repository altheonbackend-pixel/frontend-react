import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import '../../../shared/styles/DetailStyles.css';
import '../../../shared/styles/TextStyles.css';
import api from '../../../shared/services/api';
import ConfirmModal from '../../../shared/components/ConfirmModal';

interface Note {
    id: number;
    title: string;
    content: string;
    created_at: string;
}

const Notes = () => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [formData, setFormData] = useState({ title: '', content: '' });
    const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<number | null>(null);

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        if (!token) {
            setError(t('notes.error.auth'));
            setLoading(false);
            return;
        }

        try {
            const response = await api.get('/notes/');
            const notesList = response.data.results ?? response.data;
            const sortedNotes = notesList.sort((a: Note, b: Note) => {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            setNotes(sortedNotes);
        } catch (err) {
            console.error("Erreur lors du chargement des notes :", err);
            setError(t('notes.error.load'));
        } finally {
            setLoading(false);
        }
    };

    const handleNewNote = () => {
        setShowForm(true);
        setEditingNote(null);
        setFormData({ title: '', content: '' });
    };

    const handleEdit = (note: Note) => {
        setShowForm(true);
        setEditingNote(note);
        setFormData({ title: note.title, content: note.content });
    };

    const handleDelete = async (noteId: number) => {
        try {
            await api.delete(`/notes/${noteId}/`);
            setNotes(notes.filter(note => note.id !== noteId));
            setConfirmDeleteNoteId(null);
        } catch (err) {
                console.error("Erreur lors de la suppression de la note :", err);
                setError(t('notes.error.delete'));
            }
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const { name, value } = e.target;
            setFormData(prevData => ({ ...prevData, [name]: value }));
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            setLoading(true);

            try {
                if (editingNote) {
                    await api.put(`/notes/${editingNote.id}/`, formData);
                } else {
                    await api.post('/notes/', formData);
                }
                setShowForm(false);
                setEditingNote(null);
                fetchNotes();
            } catch (err) {
                console.error("Erreur lors de la soumission du formulaire :", err);
                setError(t('notes.error.save'));
            } finally {
                setLoading(false);
            }
        };

        if (loading) {
            return <div className="text-page-container loading-message">{t('notes.loading_page')}</div>;
        }

        if (error) {
            return <div className="text-page-container error-message">{error}</div>;
        }

        return (
            <div className="text-page-container">
                <div className="page-header">
                    <h1>{t('notes.title')}</h1>
                    <button onClick={handleNewNote} className="action-button content-button">
                        {t('notes.add_button')}
                    </button>
                </div>
                {showForm && (
                    <div className="form-container detail-info-group">
                        <h3>{editingNote ? t('notes.edit_title') : t('notes.add_title')}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="title">{t('notes.title_label')}</label>
                                <input
                                    type="text"
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="content">{t('notes.content_label')}</label>
                                <textarea
                                    id="content"
                                    name="content"
                                    value={formData.content}
                                    onChange={handleChange}
                                    required
                                ></textarea>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="action-button content-button" disabled={loading}>
                                    {loading ? t('notes.loading') : t('notes.submit')}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="action-button cancel-button">
                                    {t('notes.cancel')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                {!showForm && (
                    <div className="notes-list detail-list">
                        {notes.length > 0 ? (
                            <ul>
                                {notes.map(note => (
                                    <li key={note.id} className="note-item detail-list-item">
                                        <div className="note-header content-section">
                                            <h4>{note.title}</h4>
                                            <span className="date">{new Date(note.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p>{note.content}</p>
                                        <div className="note-actions entry-actions">
                                            <button onClick={() => handleEdit(note)} className="action-button edit-button">
                                                {t('notes.edit')}
                                            </button>
                                            <button onClick={() => setConfirmDeleteNoteId(note.id)} className="action-button delete-button">
                                                {t('notes.delete')}
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="no-data-message">{t('notes.no_notes')}</p>
                        )}
                    </div>
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