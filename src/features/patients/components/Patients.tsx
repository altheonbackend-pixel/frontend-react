// src/features/patients/components/Patients.tsx
// Phase 8: Table on desktop, card grid on mobile, status filter chips, full-row click

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { type Patient } from '../../../shared/types';
import api from '../../../shared/services/api';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import Dialog from '../../../shared/components/ui/Dialog';
import { Pagination } from '../../../shared/components/Pagination';
import { queryKeys } from '../../../shared/queryKeys';
import { PageHeader } from '../../../shared/components/PageHeader';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { Avatar } from '../../../shared/components/Avatar';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { toast } from '../../../shared/components/ui';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'transferred', label: 'Transferred' },
    { value: 'deceased', label: 'Deceased' },
];

function calcAge(dob: string | null | undefined): string {
    if (!dob) return '—';
    const diff = Date.now() - new Date(dob).getTime();
    const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    return `${age} yrs`;
}

const Patients = () => {
    const { t } = useTranslation();
    usePageTitle(t('pages.patients', 'Patients'));
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    const vitalAlertFilter = searchParams.get('vital_alert_recent') === 'true';

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [searchTerm]);

    useEffect(() => { setPage(1); }, [statusFilter]);

    const filters = { page, search: debouncedSearch, status: statusFilter, vital_alert_recent: vitalAlertFilter };

    const { data, isLoading, isError } = useQuery({
        queryKey: queryKeys.patients.list(filters),
        queryFn: async () => {
            const params: Record<string, string | number | boolean> = { page, page_size: PAGE_SIZE };
            if (debouncedSearch) params.search = debouncedSearch;
            if (statusFilter) params.status = statusFilter;
            if (vitalAlertFilter) params.vital_alert_recent = true;
            const res = await api.get('/doctors/me/patients/', { params });
            return {
                results: (res.data.results ?? res.data) as Patient[],
                count: res.data.count ?? (res.data.results ?? res.data).length,
            };
        },
        staleTime: 30 * 1000,
        placeholderData: keepPreviousData,
    });

    const patients = data?.results ?? [];
    const totalCount = data?.count ?? 0;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/patients/${id}/`);
            setConfirmDeleteId(null);
            queryClient.invalidateQueries({ queryKey: ['patients'] });
            toast.success(t('patients.deleted', 'Patient removed.'));
        } catch {
            setConfirmDeleteId(null);
            toast.error(t('patients.delete_error', 'Could not delete patient.'));
        }
    };

    const handleExportPdf = async () => {
        setExporting(true);
        try {
            const res = await api.get('/patients/export-pdf/', {
                responseType: 'blob',
                params: {
                    ...(debouncedSearch ? { search: debouncedSearch } : {}),
                    ...(statusFilter ? { status: statusFilter } : {}),
                },
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'patients-list.pdf';
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Could not export PDF.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <>
            <PageHeader
                title={t('patients.title', 'My Patients')}
                subtitle={totalCount > 0 ? `${totalCount} patient${totalCount !== 1 ? 's' : ''} total` : undefined}
                actions={
                    <>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={handleExportPdf}
                            disabled={exporting}
                        >
                            {exporting ? 'Exporting…' : '↓ Export PDF'}
                        </button>
                        <Link to="/patients/add" className="btn btn-primary btn-sm">
                            + {t('patients.add_button', 'Add Patient')}
                        </Link>
                    </>
                }
            />

            {isError && <div className="error-message" style={{ marginBottom: '1rem' }}>{t('patients.error.load')}</div>}

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: '0.875rem' }}>
                <svg
                    style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                    width="16" height="16" fill="none" stroke="var(--text-muted)" strokeWidth={2} viewBox="0 0 24 24"
                >
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                    id="global-patient-search"
                    type="search"
                    className="input"
                    style={{ paddingLeft: '2.5rem', height: '44px' }}
                    placeholder={t('patients.search_placeholder', 'Search patients by name, phone…')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Status filter chips */}
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setStatusFilter(f.value)}
                        style={{
                            padding: '0.3rem 0.875rem',
                            borderRadius: '999px',
                            border: statusFilter === f.value ? '1.5px solid var(--accent)' : '1.5px solid var(--border-default)',
                            background: statusFilter === f.value ? 'var(--accent)' : 'transparent',
                            color: statusFilter === f.value ? 'white' : 'var(--text-secondary)',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 120ms ease',
                        }}
                    >
                        {f.label}
                    </button>
                ))}
                {vitalAlertFilter && (
                    <button
                        onClick={() => { const p = new URLSearchParams(searchParams); p.delete('vital_alert_recent'); setSearchParams(p); setPage(1); }}
                        style={{
                            padding: '0.3rem 0.875rem',
                            borderRadius: '999px',
                            border: '1.5px solid var(--warning, #f59e0b)',
                            background: 'var(--warning, #f59e0b)',
                            color: 'white',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                        }}
                    >
                        ⚠ Vital Alert Patients <span style={{ opacity: 0.8 }}>×</span>
                    </button>
                )}
            </div>

            {/* Patient list — table on desktop, cards on mobile */}
            <div className="section-card">
                {isLoading && patients.length === 0 ? (
                    <div className="section-card-body"><TabSkeleton rows={6} /></div>
                ) : patients.length === 0 ? (
                    <div className="section-card-body">
                        <div className="empty-state">
                            <div className="empty-state-icon">👥</div>
                            <div className="empty-state-title">
                                {debouncedSearch || statusFilter || vitalAlertFilter
                                    ? 'No patients match your filter'
                                    : t('patients.no_patients', 'No patients yet')}
                            </div>
                            <div className="empty-state-subtitle">
                                {!debouncedSearch && !statusFilter && !vitalAlertFilter && 'Add your first patient to get started.'}
                            </div>
                            {!debouncedSearch && !statusFilter && !vitalAlertFilter && (
                                <Link to="/patients/add" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
                                    Add Patient
                                </Link>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="patients-table" style={{ display: 'table' }}>
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>Age</th>
                                        <th>Phone</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {patients.map(patient => (
                                        <tr
                                            key={patient.unique_id}
                                            onClick={() => navigate(`/patients/${patient.unique_id}`)}
                                            style={{ cursor: 'pointer' }}
                                            onMouseEnter={() => {
                                                queryClient.prefetchQuery({
                                                    queryKey: queryKeys.patients.detail(patient.unique_id),
                                                    queryFn: () => api.get(`/patients/${patient.unique_id}/`).then(r => r.data),
                                                    staleTime: 30_000,
                                                });
                                            }}
                                        >
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <Avatar name={`${patient.first_name} ${patient.last_name}`} size="sm" />
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                            {patient.first_name} {patient.last_name}
                                                        </div>
                                                        {patient.date_of_birth && (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                DOB: {new Date(patient.date_of_birth).toLocaleDateString('en-GB')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{calcAge(patient.date_of_birth)}</td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{patient.phone_number || '—'}</td>
                                            <td>
                                                {patient.status && <StatusBadge status={patient.status} label={patient.status_display} />}
                                            </td>
                                            <td onClick={e => e.stopPropagation()}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                                                    <Link
                                                        to={`/patients/edit/${patient.unique_id}`}
                                                        className="btn btn-ghost btn-sm"
                                                        title={t('patients.edit', 'Edit')}
                                                    >
                                                        ✏️
                                                    </Link>
                                                    <button
                                                        className="btn-danger-outline btn-sm"
                                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                                        title={t('patients.delete', 'Delete')}
                                                        onClick={() => setConfirmDeleteId(patient.unique_id)}
                                                    >
                                                        🗑
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Pagination */}
            <div style={{ marginTop: '1rem' }}>
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    onPageChange={setPage}
                    isLoading={isLoading}
                />
            </div>

            <Dialog
                open={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId); }}
                title={t('patients.error.delete_confirm', 'Are you sure you want to delete this patient? This action cannot be undone.')}
                tone="danger"
            />
        </>
    );
};

export default Patients;
