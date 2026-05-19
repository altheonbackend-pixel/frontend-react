// src/features/notebook/components/PrivateNotebook.tsx
// Phase 8: Two-column notes app layout (sidebar list + editor)

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { type NotebookEntry } from '../../../shared/types';
import { toast, parseApiError } from '../../../shared/components/ui';
import Dialog from '../../../shared/components/ui/Dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';
import { PageHeader } from '../../../shared/components/PageHeader';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';

const NOTEBOOK_KEY = ['notebook', 'list'] as const;

function PrivateNotebook() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { formatDate } = useFormatDateTime();
    const [activeId, setActiveId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ title: '', content: '' });
    const [isNew, setIsNew] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [searchQ, setSearchQ] = useState('');
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const { data: entries = [], isLoading } = useQuery<NotebookEntry[]>({
        queryKey: NOTEBOOK_KEY,
        queryFn: async () => {
            const res = await api.get('/notebook/');
            return res.data.results ?? res.data;
        },
        staleTime: 60 * 1000,
    });

    const saveMutation = useMutation({
        mutationFn: (payload: { title: string; content: string }) =>
            activeId && !isNew
                ? api.put(`/notebook/${activeId}/`, payload)
                : api.post('/notebook/', payload),
        onSuccess: (res) => {
            setAutoSaveStatus('saved');
            setDirty(false);
            if (isNew) {
                setIsNew(false);
                setActiveId(res.data.id);
            }
            queryClient.invalidateQueries({ queryKey: NOTEBOOK_KEY });
            setTimeout(() => setAutoSaveStatus('idle'), 2000);
        },
        onError: (err) => {
            toast.error(parseApiError(err, t('notes.error.save')));
            setAutoSaveStatus('idle');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/notebook/${id}/`),
        onSuccess: (_, id) => {
            toast.success(t('notes.toast.deleted'));
            setConfirmDeleteId(null);
            queryClient.setQueryData<NotebookEntry[]>(NOTEBOOK_KEY, (old = []) => old.filter(e => e.id !== id));
            if (activeId === id) {
                setActiveId(null);
                setFormData({ title: '', content: '' });
                setIsNew(false);
            }
        },
        onError: (err) => {
            toast.error(parseApiError(err, t('notes.error.delete')));
            setConfirmDeleteId(null);
        },
    });

    // Auto-save on change (debounced 1.5s)
    useEffect(() => {
        if (!dirty || !formData.title.trim()) return;
        setAutoSaveStatus('saving');
        const timer = setTimeout(() => {
            saveMutation.mutate(formData);
        }, 1500);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData, dirty]);

    const openEntry = (entry: NotebookEntry) => {
        setActiveId(entry.id);
        setFormData({ title: entry.title, content: entry.content });
        setIsNew(false);
        setDirty(false);
    };

    const openNew = () => {
        setActiveId(null);
        setFormData({ title: '', content: '' });
        setIsNew(true);
        setDirty(false);
    };

    const handleManualSave = () => {
        if (!formData.title.trim()) return;
        saveMutation.mutate(formData);
    };

    const filtered = entries.filter(e =>
        !searchQ || e.title.toLowerCase().includes(searchQ.toLowerCase()) || e.content.toLowerCase().includes(searchQ.toLowerCase())
    );

    const activeEntry = entries.find(e => e.id === activeId);
    const wordCount = formData.content.trim().split(/\s+/).filter(Boolean).length;

    return (
        <>
            <PageHeader
                title={t('notes.private.title')}
                subtitle={t('notes.private.subtitle')}
            />

            <div className="notebook-layout">
                {/* Sidebar list */}
                <div className="notebook-sidebar">
                    <div className="notebook-sidebar-header">
                        <button
                            className="btn btn-secondary btn-full btn-sm"
                            onClick={openNew}
                        >
                            {t('notes.private.new_entry')}
                        </button>
                        <div style={{ position: 'relative', marginTop: '0.625rem' }}>
                            <svg style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" fill="none" stroke="var(--text-muted)" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                            <input
                                type="search"
                                className="input"
                                style={{ paddingLeft: '2rem', height: '34px', fontSize: '0.8125rem' }}
                                placeholder={t('notes.private.search_placeholder')}
                                value={searchQ}
                                onChange={e => setSearchQ(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="notebook-entry-list">
                        {isLoading && (
                            <div style={{ padding: '1rem' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="skeleton-row" />
                                ))}
                            </div>
                        )}

                        {!isLoading && filtered.length === 0 && (
                            <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                {searchQ ? t('notes.private.no_search_results') : t('notes.private.empty')}
                            </div>
                        )}

                        {/* New entry placeholder in list */}
                        {isNew && (
                            <div className="notebook-entry-item active">
                                <div className="notebook-entry-title">{formData.title || t('notes.private.untitled')}</div>
                                <div className="notebook-entry-preview">{t('notes.private.new_entry_label')}</div>
                            </div>
                        )}

                        {filtered.map(entry => (
                            <div
                                key={entry.id}
                                className={`notebook-entry-item${activeId === entry.id && !isNew ? ' active' : ''}`}
                                onClick={() => openEntry(entry)}
                            >
                                <div className="notebook-entry-title">{entry.title}</div>
                                <div className="notebook-entry-preview">{entry.content.slice(0, 60)}</div>
                                <div className="notebook-entry-date">
                                    {formatDate(entry.updated_at)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Editor */}
                <div className="notebook-editor">
                    {!activeEntry && !isNew ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '1rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📔</div>
                                <p>{t('notes.private.select_or_create')}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="notebook-editor-header">
                                <input
                                    type="text"
                                    className="notebook-title-input"
                                    placeholder={t('notes.private.title_placeholder')}
                                    value={formData.title}
                                    onChange={e => { setFormData(f => ({ ...f, title: e.target.value })); setDirty(true); }}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={handleManualSave}
                                        disabled={saveMutation.isPending || !formData.title.trim()}
                                    >
                                        {saveMutation.isPending ? t('common.saving') : t('common.save')}
                                    </button>
                                    {activeId && !isNew && (
                                        <button
                                            className="btn-danger-outline btn-sm"
                                            onClick={() => setConfirmDeleteId(activeId)}
                                        >
                                            {t('common.delete')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <textarea
                                className="notebook-content-textarea"
                                placeholder={t('notes.private.content_placeholder')}
                                value={formData.content}
                                onChange={e => { setFormData(f => ({ ...f, content: e.target.value })); setDirty(true); }}
                            />

                            <div className="notebook-editor-footer">
                                <span>
                                    {autoSaveStatus === 'saving' && t('notes.private.saving')}
                                    {autoSaveStatus === 'saved' && t('notes.private.saved')}
                                    {autoSaveStatus === 'idle' && dirty && t('notes.private.unsaved_changes')}
                                </span>
                                <span>{t('notes.private.word_count', { count: wordCount })}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <Dialog
                open={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={() => { if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId); }}
                title={t('notes.private.delete_confirm')}
                tone="danger"
            />
        </>
    );
}

export default PrivateNotebook;
