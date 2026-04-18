import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';
import { Dialog, toast, parseApiError } from '../../../shared/components/ui';
import PageLoader from '../../../shared/components/PageLoader';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import '../styles/AdminDoctorList.css';

interface DeletedPatient {
    id: string;
    unique_id: string;
    full_name: string;
    email: string | null;
    deleted_at: string | null;
    is_erased: boolean;
}

interface EraseTarget {
    id: string;
    name: string;
}

const AdminPatientList = () => {
    usePageTitle('Deleted Patients — Admin');
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [eraseTarget, setEraseTarget] = useState<EraseTarget | null>(null);
    const [showEraseConfirm, setShowEraseConfirm] = useState(false);
    const [recoverTarget, setRecoverTarget] = useState<EraseTarget | null>(null);
    const [showRecoverConfirm, setShowRecoverConfirm] = useState(false);

    // Debounce search input
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin', 'patients', 'deleted', search],
        queryFn: async () => {
            const res = await api.get('/admin/patients/', { params: { search: search || undefined } });
            return res.data as { count: number; results: DeletedPatient[] };
        },
    });

    const eraseMutation = useMutation({
        mutationFn: (patientId: string) => api.post(`/admin/patients/${patientId}/erase-pii/`),
        onSuccess: () => {
            toast.success('Patient PII erased. Action recorded in audit log.');
            queryClient.invalidateQueries({ queryKey: ['admin', 'patients', 'deleted'] });
            setShowEraseConfirm(false);
            setEraseTarget(null);
        },
        onError: (err) => toast.error(parseApiError(err, 'Erasure failed.')),
    });

    const recoverMutation = useMutation({
        mutationFn: (patientId: string) => api.post(`/admin/patients/${patientId}/recover/`),
        onSuccess: () => {
            toast.success('Patient recovered and restored to active records.');
            queryClient.invalidateQueries({ queryKey: ['admin', 'patients', 'deleted'] });
            setShowRecoverConfirm(false);
            setRecoverTarget(null);
        },
        onError: (err) => toast.error(parseApiError(err, 'Recovery failed.')),
    });

    if (isLoading) return <PageLoader message="Loading deleted patients" />;

    return (
        <div className="admin-list-page">
            <Dialog
                open={showEraseConfirm}
                tone="danger"
                title="Permanently erase patient identity"
                message={
                    eraseTarget
                        ? `This will permanently erase all personally identifiable information for ${eraseTarget.name}. Clinical records will be preserved. This action CANNOT be undone. The patient's name, date of birth, contact details, and address will be replaced with '[erased]'.`
                        : undefined
                }
                confirmLabel="I understand — permanently erase"
                cancelLabel="Cancel"
                onConfirm={() => { if (eraseTarget) eraseMutation.mutate(eraseTarget.id); }}
                onClose={() => { setShowEraseConfirm(false); setEraseTarget(null); }}
            />

            <Dialog
                open={showRecoverConfirm}
                tone="info"
                title="Recover patient"
                message={recoverTarget ? `Restore ${recoverTarget.name} to active patient records?` : undefined}
                confirmLabel="Recover"
                cancelLabel="Cancel"
                onConfirm={() => { if (recoverTarget) recoverMutation.mutate(recoverTarget.id); }}
                onClose={() => { setShowRecoverConfirm(false); setRecoverTarget(null); }}
            />

            <div className="admin-list-header">
                <div>
                    <h1 className="admin-list-title">Deleted Patients</h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Soft-deleted patients pending recovery or GDPR erasure. Total: {data?.count ?? 0}
                    </p>
                </div>
                <input
                    type="search"
                    className="admin-search-input"
                    placeholder="Search by name or email..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    style={{ width: '260px' }}
                />
            </div>

            {error && (
                <div className="error-banner">Failed to load deleted patients. Check network and retry.</div>
            )}

            {!data?.results?.length ? (
                <div className="empty-state">
                    <p>No deleted patients found{search ? ` matching "${search}"` : ''}.</p>
                </div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Deleted at</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.results.map(patient => (
                                <tr key={patient.id} className={patient.is_erased ? 'row-muted' : ''}>
                                    <td>
                                        <span style={{ fontWeight: 500 }}>{patient.full_name}</span>
                                        <br />
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {patient.unique_id}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                        {patient.email ?? '—'}
                                    </td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        {patient.deleted_at
                                            ? new Date(patient.deleted_at).toLocaleDateString()
                                            : '—'}
                                    </td>
                                    <td>
                                        {patient.is_erased ? (
                                            <span className="badge badge-danger">PII Erased</span>
                                        ) : (
                                            <span className="badge badge-warning">Deleted</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {!patient.is_erased && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => {
                                                            setRecoverTarget({ id: patient.id, name: patient.full_name });
                                                            setShowRecoverConfirm(true);
                                                        }}
                                                        disabled={recoverMutation.isPending}
                                                    >
                                                        Recover
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => {
                                                            setEraseTarget({ id: patient.id, name: patient.full_name });
                                                            setShowEraseConfirm(true);
                                                        }}
                                                        disabled={eraseMutation.isPending}
                                                    >
                                                        Erase PII
                                                    </button>
                                                </>
                                            )}
                                            {patient.is_erased && (
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                    Erased — no further action
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminPatientList;
