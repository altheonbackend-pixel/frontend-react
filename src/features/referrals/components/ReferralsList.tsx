// src/features/referrals/components/ReferralsList.tsx

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Referral } from '../../../shared/types';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';
import { Pagination } from '../../../shared/components/Pagination';
import { queryKeys } from '../../../shared/queryKeys';
import { PageHeader } from '../../../shared/components/PageHeader';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { Modal, toast } from '../../../shared/components/ui';
import ReferralForm from './ReferralForm';
import ReferralSLABadge from './ReferralSLABadge';
import ReferralMessageThread from './ReferralMessageThread';
import { respondToReferral, deleteReferral, submitDraft, submitResult } from '../services/referralService';
import '../styles/ReferralsList.css';

const PAGE_SIZE = 20;
type Tab = 'all' | 'received' | 'sent';

interface PatientResult { unique_id: string; first_name: string; last_name: string; }

// ── Patient Picker Modal ───────────────────────────────────────────────────────
const PatientPicker = ({ onSelect, onClose }: { onSelect: (p: PatientResult) => void; onClose: () => void }) => {
    const { t } = useTranslation();
    const [q, setQ] = useState('');
    const [results, setResults] = useState<PatientResult[]>([]);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => inputRef.current?.focus(), 50);
        return () => clearTimeout(timer);
    }, []);

    const search = (val: string) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!val.trim()) { setResults([]); return; }
        timerRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await api.get('/patients/', { params: { search: val, page_size: 8 } });
                setResults((res.data.results ?? res.data) as PatientResult[]);
            } catch { /* ignore */ } finally { setLoading(false); }
        }, 300);
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={t('referrals.picker.title')}
            size="sm"
            dismissOnBackdrop="always"
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>{t('referrals.picker.cancel')}</button>
                    <Link to="/patients" className="btn btn-secondary">{t('referrals.picker.browse')}</Link>
                </>
            }
        >
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', marginTop: 0 }}>
                {t('referrals.picker.description')}
            </p>
            <input
                ref={inputRef} className="input" placeholder={t('referrals.picker.placeholder')}
                value={q} onChange={e => { setQ(e.target.value); search(e.target.value); }}
                style={{ marginBottom: '0.75rem' }}
            />
            {loading && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.25rem 0' }}>{t('referrals.picker.searching')}</p>}
            {!loading && results.length === 0 && q.trim() && (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.25rem 0' }}>{t('referrals.picker.no_results')}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 240, overflowY: 'auto' }}>
                {results.map(p => (
                    <button key={p.unique_id} type="button" className="btn btn-ghost"
                        style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '0.625rem 0.75rem' }}
                        onClick={() => onSelect(p)}>
                        <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{p.unique_id}</span>
                    </button>
                ))}
            </div>
        </Modal>
    );
};

// ── Respond Modal ──────────────────────────────────────────────────────────────
const RespondModal = ({
    referral, onClose, onDone,
}: { referral: Referral; onClose: () => void; onDone: (updated: Referral) => void; }) => {
    const { t } = useTranslation();

    const ALLOWED_RESPOND_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
        pending:  [
            { value: 'accepted',    label: t('referrals.respond.options.accept') },
            { value: 'rejected',    label: t('referrals.respond.options.reject') },
            { value: 'returned',    label: t('referrals.respond.options.return') },
        ],
        returned: [
            { value: 'accepted',    label: t('referrals.respond.options.accept') },
            { value: 'rejected',    label: t('referrals.respond.options.reject') },
        ],
        accepted: [
            { value: 'in_progress', label: t('referrals.respond.options.in_progress') },
            { value: 'returned',    label: t('referrals.respond.options.return') },
        ],
    };

    const options = ALLOWED_RESPOND_OPTIONS[referral.status] ?? [];
    const [respondStatus, setRespondStatus] = useState(options[0]?.value ?? 'accepted');
    const [notes, setNotes] = useState('');
    const [returnInfo, setReturnInfo] = useState('');
    const [error, setError] = useState('');

    const { mutate: submit, isPending } = useMutation({
        mutationFn: () => respondToReferral(referral.id, {
            status: respondStatus as 'accepted' | 'in_progress' | 'rejected' | 'returned',
            response_notes: notes,
            return_requested_info: returnInfo,
        }),
        onSuccess: (res) => { toast.success(t('referrals.respond.success')); onDone(res.data); },
        onError: (err: unknown) => {
            const e = err as { response?: { data?: { error?: string } } };
            setError(e?.response?.data?.error || t('referrals.respond.error'));
        },
    });

    if (options.length === 0) {
        return (
            <Modal
                open
                onClose={onClose}
                title={t('referrals.respond.no_actions_title')}
                size="sm"
                dismissOnBackdrop="always"
                footer={<button type="button" className="btn btn-secondary" onClick={onClose}>{t('referrals.respond.close')}</button>}
            >
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {t('referrals.respond.no_actions_body', { status: referral.status })}
                </p>
            </Modal>
        );
    }

    return (
        <Modal
            open
            onClose={onClose}
            title={t('referrals.respond.title')}
            size="sm"
            dismissOnBackdrop="always"
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>{t('referrals.respond.cancel')}</button>
                    <button type="submit" form="respond-form" className="btn btn-primary" disabled={isPending}>
                        {isPending ? t('referrals.respond.saving') : t('referrals.respond.submit')}
                    </button>
                </>
            }
        >
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '1.25rem' }}>
                {t('referrals.respond.patient_label')}: <strong>{referral.patient_details?.first_name} {referral.patient_details?.last_name}</strong>
                {' · '}
                {t('referrals.respond.from_label')}: <strong>Dr. {referral.referred_by_details?.full_name ?? '?'}</strong>
            </p>
            {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
            <form id="respond-form" onSubmit={e => { e.preventDefault(); submit(); }}>
                <div className="form-group">
                    <label htmlFor="respond-status">{t('referrals.respond.response_label')}</label>
                    <select id="respond-status" className="input select-input" value={respondStatus} onChange={e => setRespondStatus(e.target.value)}>
                        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="respond-notes">
                        {t('referrals.respond.notes_label')} {(respondStatus === 'rejected' || respondStatus === 'returned') && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                    </label>
                    <textarea
                        id="respond-notes" className="input textarea" rows={3}
                        value={notes} onChange={e => setNotes(e.target.value)}
                        placeholder={respondStatus === 'returned' ? t('referrals.respond.placeholder_returned') : t('referrals.respond.placeholder_notes')}
                        required={respondStatus === 'rejected' || respondStatus === 'returned'}
                    />
                </div>
                {respondStatus === 'returned' && (
                    <div className="form-group">
                        <label htmlFor="return-info">{t('referrals.respond.specific_info_label')}</label>
                        <textarea
                            id="return-info" className="input textarea" rows={2}
                            value={returnInfo} onChange={e => setReturnInfo(e.target.value)}
                            placeholder={t('referrals.respond.specific_info_placeholder')}
                        />
                    </div>
                )}
            </form>
        </Modal>
    );
};

// ── Submit Result Modal ────────────────────────────────────────────────────────
const SubmitResultModal = ({
    referral, onClose, onDone,
}: { referral: Referral; onClose: () => void; onDone: (updated: Referral) => void; }) => {
    const { t } = useTranslation();
    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    const { mutate: submit, isPending } = useMutation({
        mutationFn: () => submitResult(referral.id, result),
        onSuccess: (res) => { toast.success(t('referrals.result.success')); onDone(res.data); },
        onError: (err: unknown) => {
            const e = err as { response?: { data?: { error?: string; detail?: string } } };
            setError(e?.response?.data?.error || e?.response?.data?.detail || t('referrals.result.error'));
        },
    });

    return (
        <Modal
            open
            onClose={onClose}
            title={t('referrals.result.title')}
            size="sm"
            dismissOnBackdrop="always"
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>{t('referrals.result.cancel')}</button>
                    <button type="submit" form="submit-result-form" className="btn btn-primary" disabled={isPending || !result.trim()}>
                        {isPending ? t('referrals.result.submitting') : t('referrals.result.submit')}
                    </button>
                </>
            }
        >
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '1.25rem' }}>
                {t('referrals.respond.patient_label')}: <strong>{referral.patient_details?.first_name} {referral.patient_details?.last_name}</strong>
                {' · '}
                {t('referrals.respond.from_label')}: <strong>Dr. {referral.referred_by_details?.full_name ?? '?'}</strong>
            </p>
            {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
            <form id="submit-result-form" onSubmit={e => { e.preventDefault(); if (result.trim()) submit(); }}>
                <div className="form-group">
                    <label htmlFor="result-text">{t('referrals.result.findings_label')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <textarea
                        id="result-text" className="input textarea" rows={5}
                        value={result} onChange={e => setResult(e.target.value)}
                        placeholder={t('referrals.result.placeholder')}
                        required
                    />
                </div>
            </form>
        </Modal>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ReferralsList = () => {
    const { t } = useTranslation();
    const { profile } = useAuth();
    const queryClient = useQueryClient();

    const [tab, setTab] = useState<Tab>('all');
    const [statusFilter, setStatusFilter] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState('');
    const [respondTarget, setRespondTarget] = useState<Referral | null>(null);
    const [submitResultTarget, setSubmitResultTarget] = useState<Referral | null>(null);
    const [page, setPage] = useState(1);
    const [showPatientPicker, setShowPatientPicker] = useState(false);
    const [newReferralPatient, setNewReferralPatient] = useState<PatientResult | null>(null);
    const [editTarget, setEditTarget] = useState<Referral | null>(null);
    const [openThreadId, setOpenThreadId] = useState<number | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const filters = { tab, statusFilter, urgencyFilter, page };

    const { data, isLoading, isError } = useQuery({
        queryKey: queryKeys.referrals.list(filters),
        queryFn: async () => {
            const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
            if (tab !== 'all') params.direction = tab;
            if (statusFilter) params.status = statusFilter;
            if (urgencyFilter) params.urgency = urgencyFilter;
            const res = await api.get('/referrals/', { params });
            return {
                results: (res.data.results ?? res.data) as Referral[],
                count:   res.data.count ?? (res.data.results ?? res.data).length,
            };
        },
        staleTime: 30 * 1000,
        placeholderData: (prev) => prev,
    });

    const referrals  = data?.results ?? [];
    const totalCount = data?.count ?? 0;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['referrals'] });

    const handleTabChange = (newTab: Tab) => { setTab(newTab); setPage(1); };

    const handleResponded = (updated: Referral) => {
        queryClient.setQueryData(queryKeys.referrals.list(filters), (old: typeof data) => {
            if (!old) return old;
            return { ...old, results: old.results.map(r => r.id === updated.id ? updated : r) };
        });
        setRespondTarget(null);
        invalidate();
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteReferral(id);
            toast.success(t('referrals.list.toast.deleted'));
            setConfirmDeleteId(null);
            invalidate();
        } catch {
            toast.error(t('referrals.list.toast.delete_failed'));
        }
    };

    const handleSubmitDraft = async (id: number) => {
        try {
            await submitDraft(id);
            toast.success(t('referrals.list.toast.draft_sent'));
            invalidate();
        } catch {
            toast.error(t('referrals.list.toast.draft_send_failed'));
        }
    };

    const myId = profile?.id;

    const urgencyClass = (urgency: string) => `referral-card referral-card--${urgency}`;

    const TabBtn = ({ value, label }: { value: Tab; label: string }) => (
        <button onClick={() => handleTabChange(value)} className={`tab-btn${tab === value ? ' tab-btn--active' : ''}`}>
            {label}
        </button>
    );

    return (
        <>
            <PageHeader
                title={t('referrals.list.title')}
                subtitle={t('referrals.list.subtitle')}
                actions={
                    <button className="btn btn-primary btn-sm" onClick={() => setShowPatientPicker(true)}>
                        {t('referrals.list.new_referral')}
                    </button>
                }
            />

            <div className="tab-bar">
                <TabBtn value="all"      label={t('referrals.list.tabs.all')} />
                <TabBtn value="received" label={t('referrals.list.tabs.received')} />
                <TabBtn value="sent"     label={t('referrals.list.tabs.sent')} />
            </div>

            <div className="filter-row">
                <select className="input select-input" style={{ width: 'auto', minWidth: 160 }}
                    value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                    <option value="">{t('referrals.list.filter.all_statuses')}</option>
                    <option value="draft">{t('referrals.list.status.draft')}</option>
                    <option value="pending">{t('referrals.list.status.pending')}</option>
                    <option value="accepted">{t('referrals.list.status.accepted')}</option>
                    <option value="in_progress">{t('referrals.list.status.in_progress')}</option>
                    <option value="returned">{t('referrals.list.status.returned_for_info')}</option>
                    <option value="completed">{t('referrals.list.status.completed')}</option>
                    <option value="rejected">{t('referrals.list.status.rejected')}</option>
                    <option value="cancelled">{t('referrals.list.status.cancelled')}</option>
                    <option value="recalled">{t('referrals.list.status.recalled')}</option>
                    <option value="expired">{t('referrals.list.status.expired')}</option>
                </select>
                <select className="input select-input" style={{ width: 'auto', minWidth: 160 }}
                    value={urgencyFilter} onChange={e => { setUrgencyFilter(e.target.value); setPage(1); }}>
                    <option value="">{t('referrals.list.filter.all_urgencies')}</option>
                    <option value="routine">{t('referrals.list.urgency.routine')}</option>
                    <option value="urgent">{t('referrals.list.urgency.urgent')}</option>
                    <option value="emergency">{t('referrals.list.urgency.emergency')}</option>
                </select>
            </div>

            {isError && <div className="error-message" style={{ marginBottom: '1rem' }}>{t('referrals.list.error.load')}</div>}

            {isLoading && !data ? (
                <div className="section-card"><div className="section-card-body"><TabSkeleton rows={4} /></div></div>
            ) : referrals.length === 0 ? (
                <div className="section-card">
                    <div className="section-card-body">
                        <div className="empty-state">
                            <div className="empty-state-icon">💬</div>
                            <div className="empty-state-title">{t('referrals.list.empty.title')}</div>
                            <div className="empty-state-subtitle">{t('referrals.list.empty.subtitle')}</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="referral-list">
                    {referrals.map(referral => {
                        const isReceived = referral.referred_to === myId;
                        const isSent     = referral.referred_by === myId;
                        const isDraft    = referral.is_draft;
                        const ALLOWED_RESPOND_STATUSES = ['pending', 'returned', 'accepted'];
                        const canRespond = isReceived && ALLOWED_RESPOND_STATUSES.includes(referral.status);
                        const canDelete  = isSent && ['draft', 'pending', 'rejected', 'cancelled', 'recalled', 'expired'].includes(referral.status);
                        const canEdit    = isSent && ['draft', 'pending', 'returned'].includes(referral.status);
                        const isReturnedToMe = isSent && referral.status === 'returned';
                        const urgency    = referral.urgency ?? 'routine';

                        return (
                            <div key={referral.id} className={urgencyClass(urgency)}>
                                {referral.sla_breached && (
                                    <div style={{ background: 'var(--color-danger-bg, #fef2f2)', color: 'var(--color-danger, #dc2626)', fontSize: '0.78rem', fontWeight: 600, padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                                        {t('referrals.list.card.sla_breached')}
                                    </div>
                                )}

                                {isReturnedToMe && (
                                    <div style={{ background: 'var(--color-warning-bg, #fffbeb)', border: '1px solid var(--color-warning, #f59e0b)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                                        <strong>{t('referrals.list.card.specialist_returned')}</strong>
                                        {referral.return_reason && <span> "{referral.return_reason}"</span>}
                                    </div>
                                )}

                                <div className="referral-card__header">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="referral-card__badges">
                                            <StatusBadge status={urgency} label={referral.urgency_display} size="md" />
                                            <StatusBadge status={referral.status} label={referral.status_display} size="md" />
                                            {referral.referral_type_display && (
                                                <span className="card-meta" style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', padding: '0 6px', fontSize: '0.75rem' }}>
                                                    {referral.referral_type_display}
                                                </span>
                                            )}
                                            {isDraft && <span className="card-meta" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('referrals.list.card.draft_label')}</span>}
                                        </div>
                                        <div className="card-name">
                                            {referral.patient_details
                                                ? <Link to={`/patients/${referral.patient_details.unique_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                    {referral.patient_details.first_name} {referral.patient_details.last_name}
                                                  </Link>
                                                : t('referrals.list.card.patient_unknown')}
                                        </div>
                                        <div className="card-meta">
                                            {t('referrals.list.card.specialty')}: {referral.specialty_display ?? referral.specialty_requested}
                                            {' · '}
                                            {isReceived
                                                ? t('referrals.list.card.from_dr', { name: referral.referred_by_details?.full_name ?? '?' })
                                                : t('referrals.list.card.to_dr',   { name: referral.referred_to_details?.full_name ?? '?' })}
                                        </div>
                                    </div>
                                    <div className="referral-card__status">
                                        <span className="card-meta">
                                            {new Date(referral.date_of_referral).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                        {urgency !== 'routine' && referral.sla_due_at && !referral.sla_breached && (
                                            <ReferralSLABadge sla_due_at={referral.sla_due_at} sla_breached={false} urgency={urgency} />
                                        )}
                                    </div>
                                </div>

                                {referral.reason_for_referral && (
                                    <p className="card-reason">{referral.reason_for_referral}</p>
                                )}
                                {referral.response_notes && (
                                    <div className="referral-card__response">{t('referrals.list.card.response_label')}: {referral.response_notes}</div>
                                )}
                                {referral.return_requested_info && isSent && (
                                    <div className="referral-card__response" style={{ borderLeft: '3px solid var(--color-warning, #f59e0b)', paddingLeft: '0.5rem' }}>
                                        <strong>{t('referrals.list.card.needs_label')}:</strong> {referral.return_requested_info}
                                    </div>
                                )}
                                {referral.status === 'cancelled' && referral.cancelled_by_details && (
                                    <div className="card-meta" style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                                        {t('referrals.list.card.cancelled_by', { name: referral.cancelled_by_details.full_name })}
                                        {referral.cancellation_reason && ` — ${referral.cancellation_reason}`}
                                    </div>
                                )}

                                <div className="btn-row" style={{ marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {canRespond && !isDraft && (
                                        <button className="btn btn-primary btn-sm" onClick={() => setRespondTarget(referral)}>
                                            {referral.status === 'returned' ? t('referrals.list.actions.re_evaluate') : t('referrals.list.actions.respond')}
                                        </button>
                                    )}
                                    {isReceived && referral.status === 'in_progress' && (
                                        <button className="btn btn-primary btn-sm" onClick={() => setSubmitResultTarget(referral)}>
                                            {t('referrals.list.actions.submit_result')}
                                        </button>
                                    )}
                                    {isDraft && isSent && (
                                        <>
                                            <button className="btn btn-primary btn-sm" onClick={() => handleSubmitDraft(referral.id)}>
                                                {t('referrals.list.actions.send_referral')}
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setEditTarget(referral)}>
                                                {t('referrals.list.actions.edit')}
                                            </button>
                                        </>
                                    )}
                                    {canEdit && !isDraft && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => setEditTarget(referral)}>
                                            {referral.status === 'returned' ? t('referrals.list.actions.edit_resubmit') : t('referrals.list.actions.edit')}
                                        </button>
                                    )}
                                    {canDelete && (
                                        confirmDeleteId === referral.id ? (
                                            <>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>{t('referrals.list.actions.delete_confirm_q')}</span>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(referral.id)}>{t('referrals.list.actions.confirm')}</button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>{t('referrals.list.actions.cancel')}</button>
                                            </>
                                        ) : (
                                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(referral.id)}>{t('referrals.list.actions.delete')}</button>
                                        )
                                    )}
                                    {!isDraft && !referral.is_external && (referral.referred_by === myId || referral.referred_to === myId) && (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setOpenThreadId(openThreadId === referral.id ? null : referral.id)}
                                        >
                                            {openThreadId === referral.id ? t('referrals.list.actions.hide_messages') : t('referrals.list.actions.messages')}
                                        </button>
                                    )}
                                </div>

                                {openThreadId === referral.id && myId !== undefined && (
                                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                                        <ReferralMessageThread referralId={referral.id} currentDoctorId={myId} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={{ marginTop: '1rem' }}>
                <Pagination
                    currentPage={page} totalPages={totalPages} totalCount={totalCount}
                    onPageChange={setPage} isLoading={isLoading}
                />
            </div>

            {respondTarget && (
                <RespondModal referral={respondTarget} onClose={() => setRespondTarget(null)} onDone={handleResponded} />
            )}

            {submitResultTarget && (
                <SubmitResultModal
                    referral={submitResultTarget}
                    onClose={() => setSubmitResultTarget(null)}
                    onDone={updated => { queryClient.setQueryData(queryKeys.referrals.list(filters), (old: typeof data) => { if (!old) return old; return { ...old, results: old.results.map(r => r.id === updated.id ? updated : r) }; }); setSubmitResultTarget(null); invalidate(); }}
                />
            )}

            {showPatientPicker && (
                <PatientPicker
                    onSelect={p => { setNewReferralPatient(p); setShowPatientPicker(false); }}
                    onClose={() => setShowPatientPicker(false)}
                />
            )}

            {newReferralPatient && (
                <ReferralForm
                    patientId={newReferralPatient.unique_id}
                    onClose={() => setNewReferralPatient(null)}
                    onSuccess={() => { setNewReferralPatient(null); invalidate(); }}
                />
            )}

            {editTarget && (
                <ReferralForm
                    patientId={editTarget.patient as string}
                    referralToEdit={editTarget}
                    onClose={() => setEditTarget(null)}
                    onSuccess={() => { setEditTarget(null); invalidate(); }}
                />
            )}
        </>
    );
};

export default ReferralsList;
