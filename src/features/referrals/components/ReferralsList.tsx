// src/features/referrals/components/ReferralsList.tsx
// Phase 8: Urgency-colored left borders, tabs with badge counts, proper Modal for Respond

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
import '../styles/ReferralsList.css';

const PAGE_SIZE = 20;
type Tab = 'all' | 'received' | 'sent';

interface PatientResult { unique_id: string; first_name: string; last_name: string; }

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
            } catch { /* ignore */ }
            finally { setLoading(false); }
        }, 300);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">New Referral — Select Patient</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Search for a patient to create a referral for.
                </p>
                <input
                    ref={inputRef}
                    className="input"
                    placeholder="Search by name or ID…"
                    value={q}
                    onChange={e => { setQ(e.target.value); search(e.target.value); }}
                    style={{ marginBottom: '0.75rem' }}
                />
                {loading && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Searching…</p>}
                {!loading && results.length === 0 && q.trim() && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>No patients found.</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 260, overflowY: 'auto' }}>
                    {results.map(p => (
                        <button
                            key={p.unique_id}
                            type="button"
                            className="btn btn-ghost"
                            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '0.625rem 0.75rem' }}
                            onClick={() => onSelect(p)}
                        >
                            <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span>
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{p.unique_id}</span>
                        </button>
                    ))}
                </div>
                <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-secondary btn-full" onClick={onClose}>Cancel</button>
                    <Link to="/patients" className="btn btn-ghost btn-full" style={{ textAlign: 'center' }}>
                        Browse all patients →
                    </Link>
                </div>
            </div>
        </div>
    );
};

// ── Respond Modal (using shared .modal-overlay pattern) ────────────────────────
const RespondModal = ({
    referral,
    onClose,
    onDone,
}: {
    referral: Referral;
    onClose: () => void;
    onDone: (updated: Referral) => void;
}) => {
    const [respondStatus, setRespondStatus] = useState('accepted');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const { mutate: submit, isPending } = useMutation({
        mutationFn: () => api.post(`/referrals/${referral.id}/respond/`, {
            status: respondStatus,
            response_notes: notes,
        }),
        onSuccess: (res) => {
            toast.success('Response submitted.');
            onDone(res.data);
        },
        onError: (err: unknown) => {
            const e = err as { response?: { data?: { error?: string } } };
            setError(e?.response?.data?.error || 'Failed to respond. Try again.');
        },
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">Respond to Referral</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Patient: <strong>{referral.patient_details?.first_name} {referral.patient_details?.last_name}</strong>
                    {' · '}From: <strong>Dr. {referral.referred_by_details?.full_name ?? 'Unknown'}</strong>
                </p>
                {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
                <form onSubmit={e => { e.preventDefault(); submit(); }}>
                    <div className="form-field">
                        <label htmlFor="respond-status">Response</label>
                        <select
                            id="respond-status"
                            className="input select-input"
                            value={respondStatus}
                            onChange={e => setRespondStatus(e.target.value)}
                        >
                            <option value="accepted">Accept</option>
                            <option value="in_progress">Mark In Progress</option>
                            <option value="completed">Mark Completed</option>
                            <option value="rejected">Reject</option>
                        </select>
                    </div>
                    <div className="form-field">
                        <label htmlFor="respond-notes">
                            Notes {respondStatus === 'rejected' && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                        </label>
                        <textarea
                            id="respond-notes"
                            className="input textarea"
                            rows={3}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Add response notes…"
                            required={respondStatus === 'rejected'}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isPending}>
                            {isPending ? 'Saving…' : 'Submit Response'}
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
    const [page, setPage] = useState(1);
    const [showPatientPicker, setShowPatientPicker] = useState(false);
    const [newReferralPatient, setNewReferralPatient] = useState<PatientResult | null>(null);

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
                count: res.data.count ?? (res.data.results ?? res.data).length,
            };
        },
        staleTime: 30 * 1000,
        placeholderData: (prev) => prev,
    });

    const referrals = data?.results ?? [];
    const totalCount = data?.count ?? 0;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const handleTabChange = (newTab: Tab) => { setTab(newTab); setPage(1); };

    const handleRespond = (updated: Referral) => {
        queryClient.setQueryData(queryKeys.referrals.list(filters), (old: typeof data) => {
            if (!old) return old;
            return { ...old, results: old.results.map(r => r.id === updated.id ? updated : r) };
        });
        setRespondTarget(null);
        queryClient.invalidateQueries({ queryKey: queryKeys.referrals.list(filters) });
    };

    const myId = profile?.id;

    // Urgency → left border class
    const urgencyClass = (urgency: string) => {
        return `referral-card referral-card--${urgency}`;
    };

    const TabBtn = ({ value, label }: { value: Tab; label: string }) => (
        <button
            onClick={() => handleTabChange(value)}
            style={{
                padding: '0.5rem 1.25rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: 'none',
                borderBottom: tab === value ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color: tab === value ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 120ms ease',
            }}
        >
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

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)', marginBottom: '1rem' }}>
                <TabBtn value="all" label="All" />
                <TabBtn value="received" label="Received" />
                <TabBtn value="sent" label="Sent" />
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <select
                    className="input select-input"
                    style={{ width: 'auto', minWidth: 160 }}
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                </select>
                <select
                    className="input select-input"
                    style={{ width: 'auto', minWidth: 160 }}
                    value={urgencyFilter}
                    onChange={e => { setUrgencyFilter(e.target.value); setPage(1); }}
                >
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {referrals.map(referral => {
                        const isReceived = referral.referred_to === myId;
                        const canRespond = isReceived && referral.status !== 'completed' && referral.status !== 'rejected';
                        const urgency = referral.urgency ?? 'routine';

                        return (
                            <div key={referral.id} className={urgencyClass(urgency)}>
                                {/* Header row */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.625rem' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                                            <StatusBadge status={urgency} label={referral.urgency_display} size="md" />
                                            {isReceived
                                                ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>← Received from Dr. {referral.referred_by_details?.full_name ?? '?'}</span>
                                                : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→ Sent to Dr. {referral.referred_to_details?.full_name ?? '?'}</span>
                                            }
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                                            {referral.patient_details
                                                ? <Link to={`/patients/${referral.patient_details.unique_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                    {referral.patient_details.first_name} {referral.patient_details.last_name}
                                                  </Link>
                                                : 'Patient'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                            Specialty: {referral.specialty_display ?? referral.specialty_requested}
                                        </div>
                                    </div>
                                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                                        <StatusBadge status={referral.status} label={referral.status_display} />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {new Date(referral.date_of_referral).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>

                                {/* Reason */}
                                {referral.reason_for_referral && (
                                    <p style={{ fontSize: '0.8375rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border-subtle)' }}>
                                        {referral.reason_for_referral}
                                    </p>
                                )}

                                {/* Response notes */}
                                {referral.response_notes && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-success-dark)', background: 'var(--color-success-light)', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
                                        Response: {referral.response_notes}
                                    </div>
                                )}

                                {/* Actions */}
                                {canRespond && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => setRespondTarget(referral)}
                                        >
                                            Respond
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={{ marginTop: '1rem' }}>
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    onPageChange={setPage}
                    isLoading={isLoading}
                />
            </div>

            {respondTarget && (
                <RespondModal
                    referral={respondTarget}
                    onClose={() => setRespondTarget(null)}
                    onDone={handleRespond}
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
                    onSuccess={() => {
                        setNewReferralPatient(null);
                        queryClient.invalidateQueries({ queryKey: queryKeys.referrals.list(filters) });
                    }}
                />
            )}
        </>
    );
};

export default ReferralsList;
