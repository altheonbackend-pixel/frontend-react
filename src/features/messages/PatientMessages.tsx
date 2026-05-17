// CR-P1-12 — Doctor-side patient secure messaging.
//
// Three columns:
//   Left:  list of patients the doctor has any message with (unread first).
//   Center: the selected thread (oldest → newest).
//   Right:  compose box.

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../shared/services/api';
import { toast } from '../../shared/components/ui';
import { SmartTextarea } from '../../shared/components/SmartTextarea';
import { Icon } from '../../shared/components/Icons';
import { SkeletonList } from '../../shared/components/ui/Skeleton';
import { useFormatDateTime } from '../../shared/hooks/useUserTimezone';

interface Message {
    id: number; patient: string; doctor: number;
    sender_type: 'patient' | 'doctor' | 'system';
    subject: string; body: string;
    urgency: 'routine' | 'urgent' | 'non_urgent';
    is_read_by_recipient: boolean; read_at: string | null;
    created_at: string;
    patient_name: string; doctor_name: string;
}

interface PatientThread { patient_id: string; patient_name: string; last_at: string; unread: number; }

export function PatientMessages() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const { formatDateTime, formatDateTimeLong } = useFormatDateTime();
    const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [subject, setSubject] = useState('');
    const [urgency, setUrgency] = useState<Message['urgency']>('routine');

    const allMessages = useQuery({
        queryKey: ['messages-all'],
        queryFn: async () => (await api.get<{ results?: Message[] } | Message[]>('/patient-messages/')).data,
    });

    const list: Message[] = Array.isArray(allMessages.data)
        ? allMessages.data
        : (allMessages.data?.results ?? []);

    // Group by patient.
    const threads: PatientThread[] = Array.from(
        list.reduce((acc, m) => {
            const key = m.patient;
            const cur = acc.get(key) ?? { patient_id: key, patient_name: m.patient_name, last_at: m.created_at, unread: 0 };
            if (m.created_at > cur.last_at) cur.last_at = m.created_at;
            if (!m.is_read_by_recipient && m.sender_type === 'patient') cur.unread++;
            acc.set(key, cur);
            return acc;
        }, new Map<string, PatientThread>()).values(),
    ).sort((a, b) => b.unread - a.unread || (b.last_at > a.last_at ? 1 : -1));

    const thread = selectedPatient
        ? list.filter(m => m.patient === selectedPatient).sort((a, b) => a.created_at.localeCompare(b.created_at))
        : [];

    useEffect(() => {
        if (!selectedPatient && threads.length) setSelectedPatient(threads[0].patient_id);
    }, [threads, selectedPatient]);

    // Auto-mark patient → doctor messages as read when the thread is open.
    useEffect(() => {
        thread.filter(m => !m.is_read_by_recipient && m.sender_type === 'patient').forEach(m => {
            api.post(`/patient-messages/${m.id}/mark-read/`).catch(() => undefined);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPatient]);

    const send = async () => {
        if (!selectedPatient || !draft.trim()) return;
        try {
            await api.post('/patient-messages/', {
                patient: selectedPatient,
                subject: subject.trim(),
                body: draft.trim(),
                urgency,
            });
            setDraft(''); setSubject('');
            toast.success(t('messages.toast.sent', 'Message sent.'));
            qc.invalidateQueries({ queryKey: ['messages-all'] });
        } catch (e: unknown) {
            toast.error(
                (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                || 'Could not send.',
            );
        }
    };

    return (
        <div className="page-wrapper" style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '1rem', maxWidth: '1200px' }}>
            <aside style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: '0.5rem', height: '70vh', overflowY: 'auto' }}>
                <h2 style={{ fontSize: '1rem', margin: '0.5rem' }}>{t('messages.threads', 'Conversations')}</h2>
                {allMessages.isLoading && <SkeletonList count={6} />}
                {!allMessages.isLoading && threads.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>
                        {t('messages.empty', 'No messages yet.')}
                    </p>
                )}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {threads.map(th => (
                        <li
                            key={th.patient_id}
                            onClick={() => setSelectedPatient(th.patient_id)}
                            className={selectedPatient === th.patient_id ? 'msg-thread msg-thread--active' : 'msg-thread'}
                            style={{
                                padding: '0.6rem', borderRadius: 8, cursor: 'pointer',
                                background: selectedPatient === th.patient_id ? 'var(--accent-lighter)' : 'transparent',
                                marginBottom: 4,
                            }}
                        >
                            <strong>{th.patient_name}</strong>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                                <small style={{ color: 'var(--text-muted)' }}>
                                    {formatDateTime(th.last_at)}
                                </small>
                                {th.unread > 0 && <span className="db-tab-count">{th.unread}</span>}
                            </div>
                        </li>
                    ))}
                </ul>
            </aside>

            <main style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '1rem', height: '70vh', overflowY: 'auto' }}>
                {thread.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '5rem' }}>
                        {t('messages.select', 'Select a conversation to read messages.')}
                    </div>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {thread.map(m => {
                            const fromMe = m.sender_type === 'doctor';
                            return (
                                <li key={m.id} style={{
                                    alignSelf: fromMe ? 'flex-end' : 'flex-start',
                                    maxWidth: '75%',
                                    background: fromMe ? 'var(--accent)' : 'var(--bg-subtle)',
                                    color: fromMe ? 'white' : 'var(--text-primary)',
                                    padding: '0.6rem 0.9rem',
                                    borderRadius: 12,
                                }}>
                                    {m.subject && <div style={{ fontWeight: 600, marginBottom: 2 }}>{m.subject}</div>}
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                                    <small style={{
                                        display: 'block', marginTop: 4,
                                        opacity: 0.7, fontSize: '0.7rem',
                                    }}>{formatDateTimeLong(m.created_at)}{m.urgency !== 'routine' ? ` · ${m.urgency}` : ''}</small>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </main>

            <aside style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '1rem' }}>
                <h3 style={{ fontSize: '1rem', marginTop: 0 }}>{t('messages.compose', 'Compose message')}</h3>
                <input
                    type="text"
                    className="form-input"
                    placeholder={t('messages.subject_placeholder', 'Subject')}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ width: '100%', marginBottom: 8 }}
                    disabled={!selectedPatient}
                />
                <select
                    className="form-input"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as Message['urgency'])}
                    style={{ width: '100%', marginBottom: 8 }}
                    disabled={!selectedPatient}
                >
                    <option value="routine">{t('messages.urgency.routine', 'Routine')}</option>
                    <option value="urgent">{t('messages.urgency.urgent', 'Urgent (24h)')}</option>
                    <option value="non_urgent">{t('messages.urgency.non_urgent', 'Non-urgent')}</option>
                </select>
                <SmartTextarea
                    value={draft}
                    onChange={setDraft}
                    placeholder={t('messages.body_placeholder', 'Your message…')}
                    rows={6}
                    disabled={!selectedPatient}
                />
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={send}
                    disabled={!selectedPatient || !draft.trim()}
                    style={{ marginTop: 8, width: '100%' }}
                >
                    <Icon name="messages" size={14} /> {t('messages.send', 'Send')}
                </button>
            </aside>
        </div>
    );
}

export default PatientMessages;
