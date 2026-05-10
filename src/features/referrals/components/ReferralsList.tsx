// src/features/referrals/components/ReferralsList.tsx

import { useState, useEffect, useRef } from 'react';
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
import { toast } from '../../../shared/components/ui';
import ReferralForm from './ReferralForm';
import ReferralSLABadge from './ReferralSLABadge';
import ReferralMessageThread from './ReferralMessageThread';
import { respondToReferral, deleteReferral, submitDraft, submitResult } from '../services/referralService';
import '../styles/ReferralsList.css';

const PAGE_SIZE = 20;
type Tab = 'all' | 'received' | 'sent';

interface PatientResult { unique_id: string; first_name: string; last_name: string; }

// ── Helpers ────────────────────────────────────────────────────────────────────
const ALLOWED_RESPOND_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
    pending:  [{ value: 'accepted', label: 'Accept' }, { value: 'rejected', label: 'Reject' }, { value: 'returned', label: 'Return for more information' }],
    returned: [{ value: 'accepted', label: 'Accept' }, { value: 'rejected', label: 'Reject' }],
    accepted: [{ value: 'in_progress', label: 'Mark In Progress' }, { value: 'returned', label: 'Return for more information' }],
    // in_progress: result submission only — no respond options
};

// ── Patient Picker Modal ───────────────────────────────────────────────────────
const PatientPicker = ({ onSelect, onClose }: { onSelect: (p: PatientResult) => void; onClose: () => void }) => {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<PatientResult[]>([]);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box--md" onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">New Referral — Select Patient</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Search for a patient to create a referral for.</p>
                <input
                    ref={inputRef} className="input" placeholder="Search by name or ID…"
                    value={q} onChange={e => { setQ(e.target.value); search(e.target.value); }}
                    style={{ marginBottom: '0.75rem' }}
                />
                {loading && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Searching…</p>}
                {!loading && results.length === 0 && q.trim() && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>No patients found.</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 260, overflowY: 'auto' }}>
                    {results.map(p => (
                        <button key={p.unique_id} type="button" className="btn btn-ghost"
                            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '0.625rem 0.75rem' }}
                            onClick={() => onSelect(p)}>
                            <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span>
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{p.unique_id}</span>
                        </button>
                    ))}
                </div>
                <div className="btn-row btn-row--mt">
                    <button className="btn btn-secondary btn-full" onClick={onClose}>Cancel</button>
                    <Link to="/patients" className="btn btn-secondary btn-full" style={{ textAlign: 'center' }}>Browse all patients →</Link>
                </div>
            </div>
        </div>
    );
};

// ── Respond Modal ──────────────────────────────────────────────────────────────
const RespondModal = ({
    referral, onClose, onDone,
}: { referral: Referral; onClose: () => void; onDone: (updated: Referral) => void; }) => {
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
        onSuccess: (res) => { toast.success('Response submitted.'); onDone(res.data); },
        onError: (err: unknown) => {
            const e = err as { response?: { data?: { error?: string } } };
            setError(e?.response?.data?.error || 'Failed to respond. Try again.');
        },
    });

    if (options.length === 0) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-box modal-box--md" onClick={e => e.stopPropagation()}>
                    <h3 className="modal-title">No actions available</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        This referral is in <strong>{referral.status}</strong> status. No respond actions are available.
                    </p>
                    <div className="btn-row btn-row--mt">
                        <button className="btn btn-secondary btn-full" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box--md" onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">Respond to Referral</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Patient: <strong>{referral.patient_details?.first_name} {referral.patient_details?.last_name}</strong>
                    {' · '}From: <strong>Dr. {referral.referred_by_details?.full_name ?? 'Unknown'}</strong>
                </p>
                {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
                <form onSubmit={e => { e.preventDefault(); submit(); }}>
                    <div className="form-field">
                        <label htmlFor="respond-status">Response</label>
                        <select id="respond-status" className="input select-input" value={respondStatus} onChange={e => setRespondStatus(e.target.value)}>
                            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className="form-field">
                        <label htmlFor="respond-notes">
                            Notes {(respondStatus === 'rejected' || respondStatus === 'returned') && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                        </label>
                        <textarea
                            id="respond-notes" className="input textarea" rows={3}
                            value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder={respondStatus === 'returned' ? 'Explain why you are returning this referral…' : 'Add response notes…'}
                            required={respondStatus === 'rejected' || respondStatus === 'returned'}
                        />
                    </div>
                    {respondStatus === 'returned' && (
                        <div className="form-field">
                            <label htmlFor="return-info">What specific information do you need?</label>
                            <textarea
                                id="return-info" className="input textarea" rows={2}
                                value={returnInfo} onChange={e => setReturnInfo(e.target.value)}
                                placeholder="e.g. Please include recent ECG and lipid panel results"
                            />
                        </div>
                    )}
                    <div className="btn-row btn-row--mt">
                        <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-full" disabled={isPending}>
                            {isPending ? 'Saving…' : 'Submit Response'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Submit Result Modal ────────────────────────────────────────────────────────
const SubmitResultModal = ({
    referral, onClose, onDone,
}: { referral: Referral; onClose: () => void; onDone: (updated: Referral) => void; }) => {
    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    const { mutate: submit, isPending } = useMutation({
        mutationFn: () => submitResult(referral.id, result),
        onSuccess: (res) => { toast.success('Result submitted. Referral completed.'); onDone(res.data); },
        onError: (err: unknown) => {
            const e = err as { response?: { data?: { error?: string; detail?: string } } };
            setError(e?.response?.data?.error || e?.response?.data?.detail || 'Failed to submit result. Try again.');
        },
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box--md" onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">Submit Clinical Result</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Patient: <strong>{referral.patient_details?.first_name} {referral.patient_details?.last_name}</strong>
                    {' · '}From: <strong>Dr. {referral.referred_by_details?.full_name ?? 'Unknown'}</strong>
                </p>
                {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
                <form onSubmit={e => { e.preventDefault(); if (result.trim()) submit(); }}>
                    <div className="form-field">
                        <label htmlFor="result-text">Clinical findings / result <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <textarea
                            id="result-text" className="input textarea" rows={5}
                            value={result} onChange={e => setResult(e.target.value)}
                            placeholder="Describe your clinical findings, diagnosis, and recommended next steps…"
                            required
                        />
                    </div>
                    <div className="btn-row btn-row--mt">
                        <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-full" disabled={isPending || !result.trim()}>
                            {isPending ? 'Submitting…' : 'Submit & Complete Referral'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ReferralsList = () => {
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

    const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.referrals.list(filters) });

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
            toast.success('Referral deleted.');
            setConfirmDeleteId(null);
            invalidate();
        } catch {
            toast.error('Failed to delete referral.');
        }
    };

    const handleSubmitDraft = async (id: number) => {
        try {
            await submitDraft(id);
            toast.success('Referral sent successfully.');
            invalidate();
        } catch {
            toast.error('Failed to submit draft.');
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
                title="Referrals"
                subtitle="Track and respond to patient referrals"
                actions={
                    <button className="btn btn-primary btn-sm" onClick={() => setShowPatientPicker(true)}>
                        + New Referral
                    </button>
                }
            />

            <div className="tab-bar">
                <TabBtn value="all"      label="All" />
                <TabBtn value="received" label="Received" />
                <TabBtn value="sent"     label="Sent" />
            </div>

            <div className="filter-row">
                <select className="input select-input" style={{ width: 'auto', minWidth: 160 }}
                    value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="returned">Returned for Info</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="recalled">Recalled</option>
                    <option value="expired">Expired</option>
                </select>
                <select className="input select-input" style={{ width: 'auto', minWidth: 160 }}
                    value={urgencyFilter} onChange={e => { setUrgencyFilter(e.target.value); setPage(1); }}>
                    <option value="">All Urgencies</option>
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                </select>
            </div>

            {isError && <div className="error-message" style={{ marginBottom: '1rem' }}>Failed to load referrals.</div>}

            {isLoading && !data ? (
                <div className="section-card"><div className="section-card-body"><TabSkeleton rows={4} /></div></div>
            ) : referrals.length === 0 ? (
                <div className="section-card">
                    <div className="section-card-body">
                        <div className="empty-state">
                            <div className="empty-state-icon">💬</div>
                            <div className="empty-state-title">No referrals found</div>
                            <div className="empty-state-subtitle">Referrals sent or received will appear here.</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="referral-list">
                    {referrals.map(referral => {
                        const isReceived = referral.referred_to === myId;
                        const isSent     = referral.referred_by === myId;
                        const isDraft    = referral.is_draft;
                        const canRespond = isReceived && !!ALLOWED_RESPOND_OPTIONS[referral.status];
                        const canDelete  = isSent && ['draft', 'pending', 'rejected', 'cancelled', 'recalled', 'expired'].includes(referral.status);
                        const canEdit    = isSent && ['draft', 'pending', 'returned'].includes(referral.status);
                        const isReturnedToMe = isSent && referral.status === 'returned';
                        const urgency    = referral.urgency ?? 'routine';

                        return (
                            <div key={referral.id} className={urgencyClass(urgency)}>
                                {/* SLA breached banner */}
                                {referral.sla_breached && (
                                    <div style={{ background: 'var(--color-danger-bg, #fef2f2)', color: 'var(--color-danger, #dc2626)', fontSize: '0.78rem', fontWeight: 600, padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                                        ⚠ SLA breached — response overdue
                                    </div>
                                )}

                                {/* Returned banner */}
                                {isReturnedToMe && (
                                    <div style={{ background: 'var(--color-warning-bg, #fffbeb)', border: '1px solid var(--color-warning, #f59e0b)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                                        <strong>Specialist returned this referral for more information.</strong>
                                        {referral.return_reason && <span> "{referral.return_reason}"</span>}
                                    </div>
                                )}

                                {/* Header row */}
                                <div className="referral-card__header">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="referral-card__badges">
                                            <StatusBadge status={urgency} label={referral.urgency_display} size="md" />
                                            {/* Status badge — prominent, inline with urgency */}
                                            <StatusBadge status={referral.status} label={referral.status_display} size="md" />
                                            {referral.referral_type_display && (
                                                <span className="card-meta" style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', padding: '0 6px', fontSize: '0.75rem' }}>
                                                    {referral.referral_type_display}
                                                </span>
                                            )}
                                            {isDraft && <span className="card-meta" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Draft</span>}
                                        </div>
                                        <div className="card-name">
                                            {referral.patient_details
                                                ? <Link to={`/patients/${referral.patient_details.unique_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                    {referral.patient_details.first_name} {referral.patient_details.last_name}
                                                  </Link>
                                                : 'Patient'}
                                        </div>
                                        <div className="card-meta">
                                            Specialty: {referral.specialty_display ?? referral.specialty_requested}
                                            {' · '}
                                            {isReceived
                                                ? `From Dr. ${referral.referred_by_details?.full_name ?? '?'}`
                                                : `To Dr. ${referral.referred_to_details?.full_name ?? '?'}`}
                                        </div>
                                    </div>
                                    <div className="referral-card__status">
                                        <span className="card-meta">
                                            {new Date(referral.date_of_referral).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                        {/* SLA badge */}
                                        {urgency !== 'routine' && referral.sla_due_at && !referral.sla_breached && (
                                            <ReferralSLABadge sla_due_at={referral.sla_due_at} sla_breached={false} urgency={urgency} />
                                        )}
                                    </div>
                                </div>

                                {referral.reason_for_referral && (
                                    <p className="card-reason">{referral.reason_for_referral}</p>
                                )}
                                {referral.response_notes && (
                                    <div className="referral-card__response">Response: {referral.response_notes}</div>
                                )}
                                {referral.return_requested_info && isSent && (
                                    <div className="referral-card__response" style={{ borderLeft: '3px solid var(--color-warning, #f59e0b)', paddingLeft: '0.5rem' }}>
                                        <strong>Needs:</strong> {referral.return_requested_info}
                                    </div>
                                )}
                                {referral.status === 'cancelled' && referral.cancelled_by_details && (
                                    <div className="card-meta" style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                                        Cancelled by Dr. {referral.cancelled_by_details.full_name}
                                        {referral.cancellation_reason && ` — ${referral.cancellation_reason}`}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="btn-row" style={{ marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {/* Dr. B respond */}
                                    {canRespond && !isDraft && (
                                        <button className="btn btn-primary btn-sm" onClick={() => setRespondTarget(referral)}>
                                            {referral.status === 'returned' ? 'Re-evaluate' : 'Respond'}
                                        </button>
                                    )}
                                    {/* Dr. B submit result (in_progress only) */}
                                    {isReceived && referral.status === 'in_progress' && (
                                        <button className="btn btn-primary btn-sm" onClick={() => setSubmitResultTarget(referral)}>
                                            Submit Result
                                        </button>
                                    )}
                                    {/* Draft actions */}
                                    {isDraft && isSent && (
                                        <>
                                            <button className="btn btn-primary btn-sm" onClick={() => handleSubmitDraft(referral.id)}>
                                                Send Referral
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setEditTarget(referral)}>
                                                Edit
                                            </button>
                                        </>
                                    )}
                                    {/* Edit for pending/returned */}
                                    {canEdit && !isDraft && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => setEditTarget(referral)}>
                                            {referral.status === 'returned' ? 'Edit & Resubmit' : 'Edit'}
                                        </button>
                                    )}
                                    {/* Delete */}
                                    {canDelete && (
                                        confirmDeleteId === referral.id ? (
                                            <>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Delete?</span>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(referral.id)}>Confirm</button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                                            </>
                                        ) : (
                                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(referral.id)}>Delete</button>
                                        )
                                    )}
                                    {/* Message thread toggle */}
                                    {!isDraft && !referral.is_external && (referral.referred_by === myId || referral.referred_to === myId) && (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setOpenThreadId(openThreadId === referral.id ? null : referral.id)}
                                        >
                                            {openThreadId === referral.id ? 'Hide Messages' : 'Messages'}
                                        </button>
                                    )}
                                </div>

                                {/* Message thread */}
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
