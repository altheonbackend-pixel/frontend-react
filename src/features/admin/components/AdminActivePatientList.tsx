import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../shared/services/api';
import PageLoader from '../../../shared/components/PageLoader';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import '../styles/AdminDoctorList.css';

interface ActivePatient {
    id: string;
    unique_id: string;
    full_name: string;
    email: string | null;
    status: string;
    created_at: string;
    primary_doctor: string | null;
}

const STATUS_LABELS: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    transferred: 'Transferred',
    deceased: 'Deceased',
};

const STATUS_BADGE: Record<string, string> = {
    active: 'badge-success',
    inactive: 'badge-warning',
    transferred: 'badge-info',
    deceased: 'badge-muted',
};

const AdminActivePatientList = () => {
    usePageTitle('Active Patients — Admin');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin', 'patients', 'active', search],
        queryFn: async () => {
            const res = await api.get('/admin/patients/active/', { params: { search: search || undefined } });
            return res.data as { count: number; results: ActivePatient[] };
        },
    });

    if (isLoading) return <PageLoader message="Loading active patients" />;

    return (
        <div className="admin-list-page">
            <div className="admin-list-header">
                <div>
                    <h1 className="admin-list-title">Active Patients</h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        All non-deleted patients on the platform. Total: {data?.count ?? 0}
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
                <div className="error-banner">Failed to load patients. Check network and retry.</div>
            )}

            {!data?.results?.length ? (
                <div className="empty-state">
                    <p>No active patients found{search ? ` matching "${search}"` : ''}.</p>
                </div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Primary Doctor</th>
                                <th>Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.results.map(patient => (
                                <tr key={patient.id}>
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
                                    <td>
                                        <span className={`badge ${STATUS_BADGE[patient.status] ?? 'badge-muted'}`}>
                                            {STATUS_LABELS[patient.status] ?? patient.status}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        {patient.primary_doctor ?? '—'}
                                    </td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        {new Date(patient.created_at).toLocaleDateString('en-GB', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                        })}
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

export default AdminActivePatientList;
