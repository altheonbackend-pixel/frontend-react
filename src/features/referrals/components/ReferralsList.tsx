import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Referral } from '../../../shared/types';
import { Link } from 'react-router-dom';
import api from '../../../shared/services/api';
import PageLoader from '../../../shared/components/PageLoader';
import '../styles/ReferralsList.css';

type Tab = 'all' | 'received' | 'sent';

const STATUS_COLORS: Record<string, string> = {
    pending: '#f6ad55',
    accepted: '#68d391',
    in_progress: '#63b3ed',
    completed: '#9ae6b4',
    rejected: '#fc8181',
};

const URGENCY_COLORS: Record<string, string> = {
    routine: '#a0aec0',
    urgent: '#f6ad55',
    emergency: '#fc8181',
};

const RespondModal = ({
    referral,
    onClose,
    onDone,
}: {
    referral: Referral;
    onClose: () => void;
    onDone: (updated: Referral) => void;
}) => {
    const [respondStatus, setRespondStatus] = useState<string>('accepted');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.post(`/referrals/${referral.id}/respond/`, {
                status: respondStatus,
                response_notes: notes,
            });
            onDone(res.data);
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to respond. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <h3>Respond to Referral</h3>
                <p>
                    Patient: <strong>{referral.patient_details?.first_name} {referral.patient_details?.last_name}</strong>
                    <br />
                    From: <strong>Dr. {referral.referred_by_details?.full_name ?? 'Unknown'}</strong>
                </p>
                {error && <p className="error-text">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Status</label>
                        <select value={respondStatus} onChange={e => setRespondStatus(e.target.value)}>
                            <option value="accepted">Accept</option>
                            <option value="in_progress">Mark In Progress</option>
                            <option value="completed">Mark Completed</option>
                            <option value="rejected">Reject</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Response Notes {respondStatus === 'rejected' && <span style={{ color: '#e53e3e' }}>*</span>}</label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Add response notes…"
                            required={respondStatus === 'rejected'}
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving…' : 'Submit Response'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ReferralsList = () => {
    const { profile } = useAuth();
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('all');
    const [statusFilter, setStatusFilter] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState('');
    const [respondTarget, setRespondTarget] = useState<Referral | null>(null);

    const fetchReferrals = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (tab !== 'all') params.direction = tab;
            if (statusFilter) params.status = statusFilter;
            if (urgencyFilter) params.urgency = urgencyFilter;
            const res = await api.get('/referrals/', { params });
            setReferrals(res.data.results ?? res.data);
            setError(null);
        } catch {
            setError('Failed to load referrals.');
        } finally {
            setLoading(false);
        }
    }, [tab, statusFilter, urgencyFilter]);

    useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

    const handleRespond = (updated: Referral) => {
        setReferrals(prev => prev.map(r => r.id === updated.id ? updated : r));
        setRespondTarget(null);
    };

    const myId = profile?.id;

    if (loading) return <PageLoader message="Loading referrals…" />;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="referrals-container">
            <div className="referrals-header">
                <h1 className="referrals-title">Referrals</h1>
                <p className="referrals-subtitle">Track and respond to patient referrals</p>
            </div>

            {/* Tabs */}
            <div className="referral-tabs">
                {(['all', 'received', 'sent'] as Tab[]).map(t => (
                    <button
                        key={t}
                        className={`referral-tab${tab === t ? ' active' : ''}`}
                        onClick={() => setTab(t)}
                    >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="referral-filters">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                </select>
                <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}>
                    <option value="">All Urgencies</option>
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                </select>
            </div>

            {referrals.length === 0 ? (
                <div className="no-referrals-message"><p>No referrals found.</p></div>
            ) : (
                <ul className="referrals-grid">
                    {referrals.map(referral => {
                        const isReceived = referral.referred_to === myId;
                        const canRespond = isReceived && referral.status !== 'completed' && referral.status !== 'rejected';
                        return (
                            <li key={referral.id} className="referral-card normal">
                                <div className="referral-content">
                                    <div className="referral-header">
                                        <h3 className="referral-patient-name">
                                            <span className="patient-badge">Patient</span>
                                            <Link
                                                to={`/patients/${referral.patient_details?.unique_id}`}
                                                className="patient-link"
                                            >
                                                {referral.patient_details?.first_name} {referral.patient_details?.last_name}
                                            </Link>
                                        </h3>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <span
                                                className="status-badge"
                                                style={{ background: URGENCY_COLORS[referral.urgency] }}
                                            >
                                                {referral.urgency_display ?? referral.urgency}
                                            </span>
                                            <span
                                                className="status-badge"
                                                style={{ background: STATUS_COLORS[referral.status] }}
                                            >
                                                {referral.status_display ?? referral.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="referral-body">
                                        <div className="referral-field">
                                            <span className="referral-label">Specialty</span>
                                            <span className="specialty-tag">
                                                {referral.specialty_display ?? referral.specialty_requested}
                                            </span>
                                        </div>
                                        <div className="referral-field">
                                            <span className="referral-label">Reason</span>
                                            <p className="reason-text">{referral.reason_for_referral}</p>
                                        </div>
                                        <div className="referral-field">
                                            <span className="referral-label">Referred To</span>
                                            <span className="referral-value">Dr. {referral.referred_to_details?.full_name}</span>
                                        </div>
                                        <div className="referral-field">
                                            <span className="referral-label">Referred By</span>
                                            <span className="referral-value">
                                                {referral.referred_by_details
                                                    ? `Dr. ${referral.referred_by_details.full_name}`
                                                    : '—'}
                                            </span>
                                        </div>
                                        {referral.response_notes && (
                                            <div className="referral-field">
                                                <span className="referral-label">Response</span>
                                                <p className="reason-text">{referral.response_notes}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="referral-footer">
                                        <span style={{ fontSize: '12px', color: '#718096' }}>
                                            {new Date(referral.date_of_referral).toLocaleDateString()}
                                        </span>
                                        {canRespond && (
                                            <button
                                                className="btn-respond"
                                                onClick={() => setRespondTarget(referral)}
                                            >
                                                Respond
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {respondTarget && (
                <RespondModal
                    referral={respondTarget}
                    onClose={() => setRespondTarget(null)}
                    onDone={handleRespond}
                />
            )}
        </div>
    );
};

export default ReferralsList;
