import { useEffect, useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import type { AdminClinic, AdminDoctor } from '../../../shared/types';
import PageLoader from '../../../shared/components/PageLoader';
import '../styles/AdminClinicList.css';

const TransferOwnerModal = ({ clinic, onConfirm, onClose, searchDoctors }: {
    clinic: AdminClinic;
    onConfirm: (newOwnerId: number) => void;
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
        setResults(res.filter(d => d.id !== clinic.creator_id));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <h3>Transfer Clinic Ownership</h3>
                <p>Transfer ownership of <strong>{clinic.name}</strong> to another doctor.</p>

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
                        New owner: <strong>{selected.full_name}</strong>
                    </div>
                )}

                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={() => { if (selected) onConfirm(selected.id); }}
                        disabled={!selected}
                    >
                        Transfer Ownership
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminClinicList = () => {
    const {
        clinics, totalClinics, currentClinicsPage, isLoading, error,
        fetchClinics, deactivateClinic, transferClinicOwner, deleteClinic,
        searchDoctors,
    } = useAdmin();

    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [transferTarget, setTransferTarget] = useState<AdminClinic | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AdminClinic | null>(null);
    const pageSize = 50;
    const totalPages = Math.ceil(totalClinics / pageSize);

    useEffect(() => { fetchClinics(1); }, []);

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    const handleDeactivate = async (clinic: AdminClinic) => {
        await deactivateClinic(clinic.id);
        showSuccess(`"${clinic.name}" set to private.`);
    };

    const handleTransfer = async (newOwnerId: number) => {
        if (!transferTarget) return;
        await transferClinicOwner(transferTarget.id, newOwnerId);
        showSuccess(`Ownership of "${transferTarget.name}" transferred.`);
        setTransferTarget(null);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteClinic(deleteTarget.id);
        showSuccess(`"${deleteTarget.name}" deleted.`);
        setDeleteTarget(null);
    };

    if (isLoading && clinics.length === 0) return <PageLoader message="Loading Clinics" />;

    return (
        <div className="admin-clinic-list">
            <div className="admin-clinic-list__header">
                <h1>Clinic Management</h1>
                <span className="count-badge">{totalClinics} total</span>
            </div>

            {successMsg && <div className="success-banner">{successMsg}</div>}
            {error && <div className="error-message">{error}</div>}

            <div className="table-responsive">
                <table className="clinics-table">
                    <thead>
                        <tr>
                            <th>Clinic Name</th>
                            <th>Address</th>
                            <th>Owner</th>
                            <th>Members</th>
                            <th>Visibility</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clinics.length === 0 ? (
                            <tr><td colSpan={6} className="no-data">No clinics found</td></tr>
                        ) : clinics.map(clinic => (
                            <tr key={clinic.id}>
                                <td>
                                    <div className="clinic-name-cell">
                                        <span className="clinic-name">{clinic.name}</span>
                                        <span className="clinic-id">ID: {clinic.id}</span>
                                    </div>
                                </td>
                                <td className="clinic-address">{clinic.address}</td>
                                <td>
                                    {clinic.creator_name ? (
                                        <div>
                                            <div className="owner-name">{clinic.creator_name}</div>
                                            <div className="owner-email">{clinic.creator_email}</div>
                                        </div>
                                    ) : (
                                        <span className="no-owner">No owner</span>
                                    )}
                                </td>
                                <td>
                                    <span className="member-count">{clinic.member_count}</span>
                                </td>
                                <td>
                                    <span className={`visibility-badge ${clinic.is_public ? 'public' : 'private'}`}>
                                        {clinic.is_public ? '🌐 Public' : '🔒 Private'}
                                    </span>
                                </td>
                                <td>
                                    <div className="action-menu">
                                        {clinic.is_public && (
                                            <button className="btn-sm btn-warning" onClick={() => handleDeactivate(clinic)}>
                                                Make Private
                                            </button>
                                        )}
                                        <button className="btn-sm btn-secondary" onClick={() => setTransferTarget(clinic)}>
                                            Transfer Owner
                                        </button>
                                        <button className="btn-sm btn-danger" onClick={() => setDeleteTarget(clinic)}>
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        className="pagination-btn"
                        onClick={() => fetchClinics(currentClinicsPage - 1)}
                        disabled={currentClinicsPage === 1}
                    >
                        ← Previous
                    </button>
                    <span className="pagination-info">Page {currentClinicsPage} of {totalPages}</span>
                    <button
                        className="pagination-btn"
                        onClick={() => fetchClinics(currentClinicsPage + 1)}
                        disabled={currentClinicsPage === totalPages}
                    >
                        Next →
                    </button>
                </div>
            )}

            {/* Delete confirm */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h3>Delete Clinic</h3>
                        <p>Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleDelete}>Delete Permanently</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer owner modal */}
            {transferTarget && (
                <TransferOwnerModal
                    clinic={transferTarget}
                    onConfirm={handleTransfer}
                    onClose={() => setTransferTarget(null)}
                    searchDoctors={searchDoctors}
                />
            )}
        </div>
    );
};

export default AdminClinicList;
