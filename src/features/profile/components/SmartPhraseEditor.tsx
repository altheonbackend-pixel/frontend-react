// CR-P2-01 — Smart-phrase library editor.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { toast } from '../../../shared/components/ui';
import { SkeletonList } from '../../../shared/components/ui/Skeleton';
import { Icon } from '../../../shared/components/Icons';

interface SmartPhrase {
    id: number; trigger: string; expansion: string; scope: string;
    times_used: number; created_at: string; updated_at: string;
}

export function SmartPhraseEditor() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [editing, setEditing] = useState<SmartPhrase | null>(null);
    const [trigger, setTrigger] = useState('');
    const [expansion, setExpansion] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['smart-phrases'],
        queryFn: async () => (await api.get<{ results?: SmartPhrase[] } | SmartPhrase[]>('/smart-phrases/')).data,
    });
    const list: SmartPhrase[] = Array.isArray(data) ? data : (data?.results ?? []);

    const reset = () => { setEditing(null); setTrigger(''); setExpansion(''); };

    const save = async () => {
        if (!trigger.trim() || !expansion.trim()) return;
        try {
            if (editing) {
                await api.patch(`/smart-phrases/${editing.id}/`, { trigger: trigger.trim(), expansion });
            } else {
                await api.post('/smart-phrases/', { trigger: trigger.trim(), expansion });
            }
            toast.success(t('smartphrase.toast.saved', 'Smart phrase saved.'));
            reset();
            qc.invalidateQueries({ queryKey: ['smart-phrases'] });
        } catch (e: unknown) {
            toast.error(
                (e as { response?: { data?: { detail?: string; trigger?: string[] } } })?.response?.data?.detail
                || (e as { response?: { data?: { trigger?: string[] } } })?.response?.data?.trigger?.[0]
                || 'Save failed.',
            );
        }
    };

    const remove = async (sp: SmartPhrase) => {
        if (!confirm(t('smartphrase.confirm_delete', 'Delete this smart phrase?'))) return;
        await api.delete(`/smart-phrases/${sp.id}/`);
        qc.invalidateQueries({ queryKey: ['smart-phrases'] });
    };

    return (
        <div className="page-wrapper-tight">
            <h1>{t('smartphrase.title', 'Smart phrases')}</h1>
            <p style={{ color: 'var(--text-muted)' }}>
                {t('smartphrase.help', 'Type `.your-trigger` in any note field and it expands to the full text. Saves typing.')}
            </p>

            <div style={{
                background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 12,
                border: '1px solid var(--border-default)', marginBottom: '1rem',
            }}>
                <h3 style={{ margin: '0 0 0.5rem' }}>
                    {editing ? t('smartphrase.edit', 'Edit phrase') : t('smartphrase.new', 'New phrase')}
                </h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-muted)' }}>.</span>
                    <input
                        className="form-input"
                        placeholder="heent"
                        value={trigger}
                        onChange={(e) => setTrigger(e.target.value)}
                        style={{ flex: 1 }}
                    />
                </div>
                <textarea
                    className="form-input"
                    placeholder={t('smartphrase.expansion_placeholder', 'HEENT: PERRL, EOMI, oropharynx clear, no cervical lymphadenopathy.')}
                    value={expansion}
                    onChange={(e) => setExpansion(e.target.value)}
                    rows={4}
                    style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    {editing && (
                        <button type="button" className="btn btn-ghost" onClick={reset}>
                            {t('common.cancel', 'Cancel')}
                        </button>
                    )}
                    <button type="button" className="btn btn-primary" onClick={save}>
                        {editing ? t('common.save', 'Save') : t('smartphrase.add', '+ Add phrase')}
                    </button>
                </div>
            </div>

            {isLoading && <SkeletonList count={4} />}
            {!isLoading && list.length === 0 && <p>{t('smartphrase.empty', 'No phrases yet.')}</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {list.map(sp => (
                    <li key={sp.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        padding: '0.75rem', borderBottom: '1px solid var(--border-default)',
                    }}>
                        <div style={{ flex: 1 }}>
                            <code style={{ fontWeight: 600 }}>.{sp.trigger}</code>
                            <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                                {sp.expansion}
                            </small>
                            <small style={{ color: 'var(--text-muted)' }}>
                                used {sp.times_used}×
                            </small>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button type="button" className="btn btn-ghost btn-sm"
                                onClick={() => { setEditing(sp); setTrigger(sp.trigger); setExpansion(sp.expansion); }}>
                                <Icon name="settings" size={14} />
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(sp)}>
                                <Icon name="x" size={14} />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default SmartPhraseEditor;
