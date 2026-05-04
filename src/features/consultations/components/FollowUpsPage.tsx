// src/features/consultations/components/FollowUpsPage.tsx
// Phase 5: Dedicated follow-up management view

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';
import { queryKeys } from '../../../shared/queryKeys';
import { PageHeader } from '../../../shared/components/PageHeader';
import { toast } from '../../../shared/components/ui';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import type { FollowUpConsultation } from '../../../shared/types';

type Filter = 'overdue' | 'week' | 'month' | 'all';

const FILTER_LABELS: Record<Filter, string> = {
    overdue: 'Overdue',
    week: 'Due this week',
    month: 'Due this month',
    all: 'All',
};

function FollowUpsPage() {
    usePageTitle('Follow-up Due');
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [filter, setFilter] = useState<Filter>('overdue');
    const [acknowledging, setAcknowledging] = useState<number | null>(null);
    const [dismissTarget, setDismissTarget] = useState<number | null>(null);
    const [dismissReason, setDismissReason] = useState('');
    const [dismissing, setDismissing] = useState(false);

    const daysAheadMap: Record<Filter, number> = {
        overdue: 0,
        week: 7,
        month: 30,
        all: -1,
    };

    const { data: followUps = [], isLoading, isError } = useQuery<FollowUpConsultation[]>({
        queryKey: ['consultations', 'followUps', filter],
        queryFn: async () => {
            const params: Record<string, string | number | boolean> = { pending_only: true };
            const days = daysAheadMap[filter];
            if (days >= 0) params.days_ahead = days;
            const res = await api.get('/consultations/follow-ups/', { params });
            return res.data.results ?? res.data;
        },
        staleTime: 60_000,
    });

    const handleAcknowledge = async (id: number) => {
        try {
            setAcknowledging(id);
            await api.patch(`/consultations/${id}/`, { follow_up_notification_sent: true });
            toast.success('Follow-up acknowledged.');
            await Promise.all([
                qc.refetchQueries({ queryKey: ['consultations', 'followUps'] }),
                qc.refetchQueries({ queryKey: queryKeys.dashboard() }),
            ]);
        } catch {
            toast.error('Failed to acknowledge follow-up.');
        } finally {
            setAcknowledging(null);
        }
    };

    const handleDismiss = async () => {
        if (dismissTarget === null) return;
        setDismissing(true);
        try {
            await api.post(`/consultations/${dismissTarget}/dismiss-follow-up/`, { reason: dismissReason });
            toast.success('Follow-up dismissed.');
            setDismissTarget(null);
            setDismissReason('');
            await Promise.all([
                qc.refetchQueries({ queryKey: ['consultations', 'followUps'] }),
                qc.refetchQueries({ queryKey: ['consultations', 'overdue-count'] }),
                qc.refetchQueries({ queryKey: queryKeys.dashboard() }),
            ]);
        } catch {
            toast.error('Failed to dismiss follow-up.');
        } finally {
            setDismissing(false);
        }
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    return (
        <>
            {/* Dismiss reason modal */}
            {dismissTarget !== null && (
                <div className="modal-overlay" onClick={() => { setDismissTarget(null); setDismissReason(''); }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <h3 style={{ marginTop: 0 }}>Dismiss follow-up</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 0 }}>
                            This follow-up will be hidden from the list. Optionally provide a reason.
                        </p>
                        <textarea
                            autoFocus
                            rows={3}
                            placeholder="Reason for dismissal (optional)"
                            value={dismissReason}
                            onChange={e => setDismissReason(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                            <button type="button" className="btn-task-secondary" onClick={() => { setDismissTarget(null); setDismissReason(''); }}>
                                Cancel
                            </button>
                            <button type="button" className="btn-task-accept" disabled={dismissing} onClick={handleDismiss}>
                                {dismissing ? 'Dismissing…' : 'Confirm dismiss'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <PageHeader
                title="Follow-up Due"
                subtitle="Consultations requiring a return visit"
            />

            {/* Filter bar */}
            <div className="follow-ups-filter-bar">
                {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
                    <button
                        key={f}
                        type="button"
                        className={`follow-ups-filter-btn${filter === f ? ' active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {FILTER_LABELS[f]}
                    </button>
                ))}
            </div>

            <div className="section-card">
                <div className="section-card-body section-card-body--flush">
                    {isLoading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
                    ) : isError ? (
                        <div className="error-message" style={{ margin: '1rem' }}>Failed to load follow-ups.</div>
                    ) : followUps.length === 0 ? (
                        <div className="empty-state" style={{ padding: '3rem 1rem' }}>
                            <div className="empty-state-icon">✅</div>
                            <div className="empty-state-title">No follow-ups in this range</div>
                            <div className="empty-state-subtitle">All clear for the selected period.</div>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="follow-ups-table">
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>Last Visit</th>
                                        <th>Follow-up Due</th>
                                        <th>Reason</th>
                                        <th>Vital Alerts</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {followUps.map(f => {
                                        const dueDate = new Date(f.follow_up_date);
                                        dueDate.setHours(0, 0, 0, 0);
                                        const isOverdue = dueDate < today;
                                        const isDueSoon = !isOverdue && dueDate <= weekFromNow;
                                        return (
                                            <tr key={f.id}>
                                                <td>
                                                    <Link to={`/patients/${f.patient}`} className="follow-ups-patient-link">
                                                        {f.patient_name || f.patient}
                                                    </Link>
                                                </td>
                                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                                    {f.consultation_date
                                                        ? new Date(f.consultation_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                        : '—'}
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    <span className={`follow-up-date-tag${isOverdue ? ' overdue' : isDueSoon ? ' soon' : ''}`}>
                                                        {isOverdue && '⚠ '}
                                                        {dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: 240 }}>
                                                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {f.reason_for_consultation}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {f.has_vital_alerts && f.vital_alert_reasons?.length
                                                        ? <span title={f.vital_alert_reasons.join(', ')} style={{ color: 'var(--color-danger)', fontWeight: 600, cursor: 'help' }}>⚠ {f.vital_alert_reasons.length}</span>
                                                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                    }
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                        {f.follow_up_appointment ? (
                                                            <span style={{
                                                                fontSize: '0.78rem', background: 'var(--color-success-light)',
                                                                color: 'var(--color-success-dark)', borderRadius: '4px',
                                                                padding: '2px 8px', fontWeight: 500,
                                                            }}>
                                                                ✓ Appt booked
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="btn-task-accept"
                                                                onClick={() => navigate(`/appointments?patient_id=${f.patient}`)}
                                                            >
                                                                Book Appt
                                                            </button>
                                                        )}
                                                        <Link
                                                            to={`/patients/${f.patient}?tab=consultations`}
                                                            className="btn-task-secondary"
                                                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                                        >
                                                            View Visit
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn-task-secondary"
                                                            disabled={acknowledging === f.id}
                                                            onClick={() => handleAcknowledge(f.id)}
                                                            title="Mark that the follow-up reminder has been noted"
                                                        >
                                                            {acknowledging === f.id ? '…' : 'Mark Noted'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-task-secondary"
                                                            onClick={() => setDismissTarget(f.id)}
                                                            title="Remove from this list (no follow-up needed)"
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default FollowUpsPage;
