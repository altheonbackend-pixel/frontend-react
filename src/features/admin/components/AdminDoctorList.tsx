import { useEffect, useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import type { AdminDoctor } from '../../../shared/types';
import '../styles/AdminDoctorList.css';
import PageLoader from '../../../shared/components/PageLoader';

type Tab = 'active' | 'pending' | 'rejected';

// ── Reject Modal ──────────────────────────────────────────────────────────────
const RejectModal = ({ doctor, onConfirm, onClose }: {
    doctor: AdminDoctor;
    onConfirm: (reason: string) => void;
    onClose: () => void;
}) => {
    const [reason, setReason] = useState('');
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <h3>Reject Registration</h3>
                <p>Rejecting <strong>{doctor.full_name}</strong>. Please provide a reason:</p>
                <textarea
                    className="modal-textarea"
                    placeholder="e.g. Invalid license number, incomplete information..."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={4}
                />
                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-danger"
                        onClick={() => { if (reason.trim()) onConfirm(reason.trim()); }}
                        disabled={!reason.trim()}
                    >
                        Reject Registration
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Transfer Patients Modal ───────────────────────────────────────────────────
const TransferModal = ({ doctor, onConfirm, onClose, searchDoctors }: {
    doctor: AdminDoctor;
    onConfirm: (toDoctorId: number) => void;
    onClose: () => void;
    searchDoctors: (q: string) => Promise<AdminDoctor[]>;
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<AdminDoctor[]>([]);
    const [selected, setSelected] = useState<AdminDoctor | null>(null);

    const handleSearch = async (q: string) => {
        setQuery(q);
        if (q.length < 2) { setResults([]); return; }
        const res = await searchDoctors(q);
        setResults(res.filter(d => d.id !== doctor.id));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <h3>Transfer Patients</h3>
                <p>Transfer all patients from <strong>{doctor.full_name}</strong> to another doctor.</p>

                <input
                    type="text"
                    className="modal-input"
                    placeholder="Search doctor by name or email..."
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                />

                {results.length > 0 && (
                    <div className="doctor-search-results">
                        {results.map(d => (
                            <div
                                key={d.id}
                                className={`doctor-search-item${selected?.id === d.id ? ' selected' : ''}`}
                                onClick={() => setSelected(d)}
                            >
                                <strong>{d.full_name}</strong>
                                <span className="doctor-search-meta">{d.specialty} · {d.email}</span>
                            </div>
                        ))}
                    </div>
                )}

                {selected && (
                    <div className="selected-doctor-badge">
                        Selected: <strong>{selected.full_name}</strong>
                    </div>
                )}

                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-warning"
                        onClick={() => { if (selected) onConfirm(selected.id); }}
                        disabled={!selected}
                    >
                        Transfer Patients
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Limits Editor ─────────────────────────────────────────────────────────────
const LimitsEditor = ({ doctor, onSave, onClose }: {
    doctor: AdminDoctor;
    onSave: (maxOwned: number, maxJoined: number) => void;
    onClose: () => void;
}) => {
    const [maxOwned, setMaxOwned] = useState(doctor.max_clinics_owned);
    const [maxJoined, setMaxJoined] = useState(doctor.max_clinics_joined);
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <h3>Edit Clinic Limits — {doctor.full_name}</h3>
                <p className="modal-hint">Set to 0 for unlimited.</p>
                <div className="modal-field">
                    <label>Max clinics this doctor can CREATE</label>
                    <input
                        type="number"
                        min={0}
                        className="modal-input"
                        value={maxOwned}
                        onChange={e => setMaxOwned(parseInt(e.target.value) || 0)}
                    />
                </div>
                <div className="modal-field">
                    <label>Max clinics this doctor can JOIN</label>
                    <input
                        type="number"
                        min={0}
                        className="modal-input"
                        value={maxJoined}
                        onChange={e => setMaxJoined(parseInt(e.target.value) || 0)}
                    />
                </div>
                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => onSave(maxOwned, maxJoined)}>Save Limits</button>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
const AdminDoctorList = ({ initialTab = 'active' }: { initialTab?: Tab }) => {
    const {
        doctors, totalDoctors, currentPage,
        pendingDoctors, totalPending,
        rejectedDoctors, totalRejected,
        isLoading, error,
        fetchDoctors, fetchPendingDoctors, fetchRejectedDoctors,
        updateDoctorAccessLevel, updateDoctorLimits,
        activateDoctor, deactivateDoctor,
        approveDoctor, rejectDoctor,
        transferPatients, suspendForum, unsuspendForum,
        searchDoctors,
    } = useAdmin();

    const [tab, setTab] = useState<Tab>(initialTab);
    const [rejectTarget, setRejectTarget] = useState<AdminDoctor | null>(null);
    const [transferTarget, setTransferTarget] = useState<AdminDoctor | null>(null);
    const [limitsTarget, setLimitsTarget] = useState<AdminDoctor | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const pageSize = 50;

    useEffect(() => { loadTab(tab, 1); }, [tab]);

    const loadTab = (t: Tab, page: number) => {
        if (t === 'active') fetchDoctors(page);
        else if (t === 'pending') fetchPendingDoctors(page);
        else fetchRejectedDoctors(page);
    };

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    const handleApprove = async (doctor: AdminDoctor) => {
        await approveDoctor(doctor.id);
        showSuccess(`${doctor.full_name} approved and can now log in.`);
    };

    const handleReject = async (reason: string) => {
        if (!rejectTarget) return;
        await rejectDoctor(rejectTarget.id, reason);
        showSuccess(`${rejectTarget.full_name}'s registration rejected.`);
        setRejectTarget(null);
    };

    const handleTransfer = async (toDoctorId: number) => {
        if (!transferTarget) return;
        const result = await transferPatients(transferTarget.id, toDoctorId);
        showSuccess(`Transferred ${result.transferred_count} patients from ${result.from_doctor} to ${result.to_doctor}.`);
        setTransferTarget(null);
    };

    const handleLimitsSave = async (maxOwned: number, maxJoined: number) => {
        if (!limitsTarget) return;
        await updateDoctorLimits(limitsTarget.id, maxOwned, maxJoined);
        showSuccess(`Limits updated for ${limitsTarget.full_name}.`);
        setLimitsTarget(null);
    };

    const currentDoctors = tab === 'active' ? doctors : tab === 'pending' ? pendingDoctors : rejectedDoctors;
    const totalCount = tab === 'active' ? totalDoctors : tab === 'pending' ? totalPending : totalRejected;
    const totalPages = Math.ceil(totalCount / pageSize);

    const showLoading = isLoading && currentDoctors.length === 0;

    if (showLoading) return <PageLoader message="Loading Doctors" />;

    return (
        <div className="admin-doctor-list">
            <div className="admin-doctor-list__header">
                <h1>Doctor Management</h1>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button className={`tab${tab === 'active' ? ' active' : ''}`} onClick={() => setTab('active')}>
                    Active Doctors ({totalDoctors})
                </button>
                <button className={`tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
                    Pending Approval
                    {totalPending > 0 && <span className="tab-badge">{totalPending}</span>}
                </button>
                <button className={`tab${tab === 'rejected' ? ' active' : ''}`} onClick={() => setTab('rejected')}>
                    Rejected ({totalRejected})
                </button>
            </div>

            {successMsg && <div className="success-banner">{successMsg}</div>}
            {error && <div className="error-message">{error}</div>}

            {/* ── ACTIVE TAB ── */}
            {tab === 'active' && (
                <div className="table-responsive">
                    <table className="doctors-table">
                        <thead>
                            <tr>
                                <th>Name / Email</th>
                                <th>Specialty</th>
                                <th>Access Level</th>
                                <th>Status</th>
                                <th>Clinics (Own/Join)</th>
                                <th>Forum</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {doctors.length === 0 ? (
                                <tr><td colSpan={7} className="no-data">No active doctors found</td></tr>
                            ) : doctors.map(doctor => (
                                <tr key={doctor.id} className={`doctor-row ${doctor.is_active ? 'active' : 'inactive'}`}>
                                    <td>
                                        <div className="doctor-name-cell">
                                            <span className="doctor-name">{doctor.full_name}</span>
                                            <span className="doctor-email">{doctor.email}</span>
                                            {doctor.license_number && (
                                                <span className="doctor-license">#{doctor.license_number}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>{doctor.specialty || '—'}</td>
                                    <td>
                                        <select
                                            className={`access-level-select level-${doctor.access_level}`}
                                            value={doctor.access_level}
                                            onChange={e => updateDoctorAccessLevel(doctor.id, parseInt(e.target.value) as 1 | 2)}
                                        >
                                            <option value={1}>Level 1 (Basic)</option>
                                            <option value={2}>Level 2 (Advanced)</option>
                                        </select>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${doctor.is_active ? 'status-active' : 'status-inactive'}`}>
                                            {doctor.is_active ? '✓ Active' : '✗ Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="limits-cell">
                                            <span title="Clinics owned/max">{doctor.clinics_owned}/{doctor.max_clinics_owned === 0 ? '∞' : doctor.max_clinics_owned} own</span>
                                            <span title="Clinics joined/max">{doctor.clinics_joined}/{doctor.max_clinics_joined === 0 ? '∞' : doctor.max_clinics_joined} joined</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`forum-badge ${doctor.forum_suspended ? 'forum-suspended' : 'forum-active'}`}>
                                            {doctor.forum_suspended ? 'Suspended' : 'Active'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-menu">
                                            {doctor.is_active ? (
                                                <button className="btn-sm btn-deactivate" onClick={() => deactivateDoctor(doctor.id)} title="Deactivate account">
                                                    Deactivate
                                                </button>
                                            ) : (
                                                <button className="btn-sm btn-activate" onClick={() => activateDoctor(doctor.id)} title="Activate account">
                                                    Activate
                                                </button>
                                            )}
                                            {!doctor.is_active && (
                                                <button className="btn-sm btn-transfer" onClick={() => setTransferTarget(doctor)} title="Transfer patients">
                                                    Transfer Patients
                                                </button>
                                            )}
                                            {doctor.forum_suspended ? (
                                                <button className="btn-sm btn-secondary" onClick={() => unsuspendForum(doctor.id)} title="Lift forum suspension">
                                                    Unsuspend Forum
                                                </button>
                                            ) : (
                                                <button className="btn-sm btn-warning" onClick={() => suspendForum(doctor.id)} title="Suspend from forum">
                                                    Suspend Forum
                                                </button>
                                            )}
                                            <button className="btn-sm btn-secondary" onClick={() => setLimitsTarget(doctor)} title="Edit clinic limits">
                                                Edit Limits
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── PENDING TAB ── */}
            {tab === 'pending' && (
                <div className="pending-list">
                    {pendingDoctors.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">✅</div>
                            <div className="empty-state__title">No Pending Registrations</div>
                            <div className="empty-state__text">All doctor registrations have been reviewed.</div>
                        </div>
                    ) : pendingDoctors.map(doctor => (
                        <div key={doctor.id} className="pending-card">
                            <div className="pending-card__info">
                                <div className="pending-card__name">{doctor.full_name}</div>
                                <div className="pending-card__email">{doctor.email}</div>
                                <div className="pending-card__meta">
                                    <span className="meta-tag">Specialty: {doctor.specialty || 'N/A'}</span>
                                    <span className="meta-tag">License: {doctor.license_number || 'N/A'}</span>
                                    {doctor.date_joined && (
                                        <span className="meta-tag">Registered: {doctor.date_joined}</span>
                                    )}
                                </div>
                            </div>
                            <div className="pending-card__actions">
                                <button className="btn btn-approve" onClick={() => handleApprove(doctor)}>
                                    ✓ Approve
                                </button>
                                <button className="btn btn-reject" onClick={() => setRejectTarget(doctor)}>
                                    ✗ Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── REJECTED TAB ── */}
            {tab === 'rejected' && (
                <div className="table-responsive">
                    <table className="doctors-table">
                        <thead>
                            <tr>
                                <th>Name / Email</th>
                                <th>Specialty / License</th>
                                <th>Rejection Reason</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rejectedDoctors.length === 0 ? (
                                <tr><td colSpan={4} className="no-data">No rejected registrations</td></tr>
                            ) : rejectedDoctors.map(doctor => (
                                <tr key={doctor.id} className="doctor-row inactive">
                                    <td>
                                        <div className="doctor-name-cell">
                                            <span className="doctor-name">{doctor.full_name}</span>
                                            <span className="doctor-email">{doctor.email}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div>
                                            <div>{doctor.specialty || '—'}</div>
                                            <small className="doctor-email">{doctor.license_number || '—'}</small>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="rejection-reason">{doctor.rejection_reason || '—'}</span>
                                    </td>
                                    <td>
                                        <button className="btn-sm btn-approve" onClick={() => handleApprove(doctor)}>
                                            Approve Now
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        className="pagination-btn"
                        onClick={() => loadTab(tab, currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        ← Previous
                    </button>
                    <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                    <button
                        className="pagination-btn"
                        onClick={() => loadTab(tab, currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        Next →
                    </button>
                </div>
            )}

            {/* Modals */}
            {rejectTarget && (
                <RejectModal
                    doctor={rejectTarget}
                    onConfirm={handleReject}
                    onClose={() => setRejectTarget(null)}
                />
            )}
            {transferTarget && (
                <TransferModal
                    doctor={transferTarget}
                    onConfirm={handleTransfer}
                    onClose={() => setTransferTarget(null)}
                    searchDoctors={searchDoctors}
                />
            )}
            {limitsTarget && (
                <LimitsEditor
                    doctor={limitsTarget}
                    onSave={handleLimitsSave}
                    onClose={() => setLimitsTarget(null)}
                />
            )}
        </div>
    );
};

export default AdminDoctorList;
