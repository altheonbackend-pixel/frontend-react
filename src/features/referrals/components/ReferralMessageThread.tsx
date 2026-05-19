// src/features/referrals/components/ReferralMessageThread.tsx

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/queryKeys';
import { getMessages, sendMessage, deleteMessage } from '../services/referralService';
import { type ReferralMessage } from '../../../shared/types';
import { toast } from '../../../shared/components/ui';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';

interface Props {
    referralId: number;
    currentDoctorId: number;
}

const ReferralMessageThread = ({ referralId, currentDoctorId }: Props) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { formatTime, formatDayMonth } = useFormatDateTime();
    const [body, setBody] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const { data: messages = [], isLoading } = useQuery<ReferralMessage[]>({
        queryKey: queryKeys.referrals.messages(referralId),
        queryFn: async () => {
            const res = await getMessages(referralId);
            return (res.data.results ?? res.data) as ReferralMessage[];
        },
        refetchInterval: 30_000,
        staleTime: 15_000,
    });

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const { mutate: send, isPending: sending } = useMutation({
        mutationFn: () => sendMessage(referralId, body.trim()),
        onSuccess: () => {
            setBody('');
            queryClient.invalidateQueries({ queryKey: queryKeys.referrals.messages(referralId) });
        },
        onError: () => toast.error(t('referrals.messages.send_failed')),
    });

    const { mutate: del } = useMutation({
        mutationFn: (msgId: number) => deleteMessage(referralId, msgId),
        onSuccess: () => {
            setConfirmDeleteId(null);
            queryClient.invalidateQueries({ queryKey: queryKeys.referrals.messages(referralId) });
        },
        onError: () => toast.error(t('referrals.messages.delete_failed')),
    });

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (body.trim()) send();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('referrals.messages.title')}
            </div>

            {isLoading ? (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>{t('common.loading')}</div>
            ) : messages.length === 0 ? (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.25rem 0' }}>{t('referrals.messages.empty')}</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: 260, overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {messages.map(msg => {
                        const isOwn = msg.sender === currentDoctorId;
                        return (
                            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '80%',
                                    background: isOwn ? 'var(--color-primary-subtle, #eff6ff)' : 'var(--bg-subtle)',
                                    color: 'var(--text-primary)',
                                    borderRadius: 'var(--radius)',
                                    padding: '0.45rem 0.65rem',
                                    fontSize: '0.875rem',
                                    position: 'relative',
                                    opacity: msg.is_deleted ? 0.45 : 1,
                                    fontStyle: msg.is_deleted ? 'italic' : 'normal',
                                }}>
                                    {!isOwn && (
                                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                                            {t('referrals.messages.sender_doctor', { name: msg.sender_details?.full_name ?? t('common.not_available') })}
                                        </div>
                                    )}
                                    {msg.is_deleted ? t('referrals.messages.deleted') : msg.body}
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem', textAlign: isOwn ? 'right' : 'left' }}>
                                        {formatTime(msg.created_at)}
                                        {' · '}
                                        {formatDayMonth(msg.created_at)}
                                    </div>
                                </div>
                                {isOwn && !msg.is_deleted && (
                                    <div style={{ marginTop: '0.15rem' }}>
                                        {confirmDeleteId === msg.id ? (
                                            <span style={{ fontSize: '0.75rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>{t('referrals.messages.delete_confirm')}</span>
                                                <button className="btn btn-danger" style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem' }} onClick={() => del(msg.id)}>{t('common.yes')}</button>
                                                <button className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem' }} onClick={() => setConfirmDeleteId(null)}>{t('common.no')}</button>
                                            </span>
                                        ) : (
                                            <button
                                                className="btn btn-ghost"
                                                style={{ fontSize: '0.72rem', padding: '0.1rem 0.35rem', color: 'var(--text-muted)' }}
                                                onClick={() => setConfirmDeleteId(msg.id)}
                                            >
                                                {t('common.delete')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>
            )}

            <form
                onSubmit={e => { e.preventDefault(); if (body.trim()) send(); }}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginTop: '0.25rem' }}
            >
                <textarea
                    className="input textarea"
                    rows={2}
                    style={{ flex: 1, resize: 'none', fontSize: '0.875rem' }}
                    placeholder={t('referrals.messages.placeholder')}
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                />
                <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={!body.trim() || sending}
                    style={{ flexShrink: 0 }}
                >
                    {sending ? '...' : t('referrals.messages.send')}
                </button>
            </form>
        </div>
    );
};

export default ReferralMessageThread;
