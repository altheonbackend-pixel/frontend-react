// CR-P2-09 — Send a bulk secure message to a curated cohort.
//
// Caller passes a list of patient UUIDs (filtered however they like —
// "patients overdue for flu shot", "all DM patients", etc.) and this
// modal handles the subject/body/urgency capture + POST.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../shared/services/api';
import { toast } from '../../shared/components/ui';
import { SmartTextarea } from '../../shared/components/SmartTextarea';

interface Props {
    open: boolean;
    patientIds: string[];
    onClose: () => void;
    onSent?: (count: number) => void;
}

export function BulkCampaignModal({ open, patientIds, onClose, onSent }: Props) {
    const { t } = useTranslation();
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'non_urgent'>('routine');
    const [sending, setSending] = useState(false);

    if (!open) return null;

    const submit = async () => {
        if (!body.trim()) return;
        setSending(true);
        try {
            const res = await api.post('/batch/message/', {
                patient_ids: patientIds, subject, body, urgency,
            });
            toast.success(t('campaign.sent', '{{n}} messages queued.', { n: res.data.sent_count ?? patientIds.length }));
            onSent?.(res.data.sent_count ?? 0);
            onClose();
        } catch (e: unknown) {
            toast.error(
                (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                || 'Could not send.',
            );
        } finally {
            setSending(false);
        }
    };

    return (
        <div
            role="dialog" aria-modal="true"
            style={{
                position: 'fixed', inset: 0, zIndex: 100,
                background: 'rgba(15,23,42,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--bg-elevated)', borderRadius: 12,
                    width: 'min(560px, 92vw)', padding: '1.25rem',
                    boxShadow: 'var(--shadow-xl)',
                }}
            >
                <h2 style={{ margin: '0 0 0.5rem' }}>
                    {t('campaign.title', 'Send to {{n}} patients', { n: patientIds.length })}
                </h2>
                <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
                    {t('campaign.note', 'Each patient receives a secure in-app message. Not sent via SMS or email.')}
                </p>
                <input
                    className="form-input"
                    placeholder={t('messages.subject_placeholder', 'Subject')}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ width: '100%', marginBottom: 8 }}
                />
                <select
                    className="form-input"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as typeof urgency)}
                    style={{ width: '100%', marginBottom: 8 }}
                >
                    <option value="routine">{t('messages.urgency.routine', 'Routine')}</option>
                    <option value="urgent">{t('messages.urgency.urgent', 'Urgent (24h)')}</option>
                    <option value="non_urgent">{t('messages.urgency.non_urgent', 'Non-urgent')}</option>
                </select>
                <SmartTextarea
                    value={body}
                    onChange={setBody}
                    rows={6}
                    placeholder={t('campaign.body_placeholder', 'Personal greeting reads better — try ".heent" or your saved smart phrases.')}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '1rem' }}>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        type="button" className="btn btn-primary"
                        onClick={submit}
                        disabled={sending || !body.trim() || patientIds.length === 0}
                    >
                        {sending ? t('campaign.sending', 'Sending…') : t('campaign.send', 'Send to {{n}}', { n: patientIds.length })}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BulkCampaignModal;
