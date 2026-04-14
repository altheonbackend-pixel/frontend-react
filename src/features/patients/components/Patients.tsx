import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import '../styles/PatientsList.css';
import { type Patient } from '../../../shared/types';
import api from '../../../shared/services/api';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { Pagination } from '../../../shared/components/Pagination';
import { queryKeys } from '../../../shared/queryKeys';

const PAGE_SIZE = 20;

interface PatientsProps {
    refreshPatients?: number | boolean;
}

const Patients = ({ refreshPatients }: PatientsProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [debouncedSearch, setDebouncedSearch] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    // Debounce search by 400ms
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1); // reset to page 1 on new search
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset to page 1 on status filter change
    useEffect(() => { setPage(1); }, [statusFilter]);

    // Invalidate when parent triggers a refresh
    useEffect(() => {
        if (refreshPatients) {
            queryClient.invalidateQueries({ queryKey: ['patients'] });
        }
    }, [refreshPatients, queryClient]);

    const filters = { page, search: debouncedSearch, status: statusFilter };

    const { data, isLoading, isError } = useQuery({
        queryKey: queryKeys.patients.list(filters),
        queryFn: async () => {
            const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
            if (debouncedSearch) params.search = debouncedSearch;
            if (statusFilter) params.status = statusFilter;
            const res = await api.get('/doctors/me/patients/', { params });
            return {
                results: (res.data.results ?? res.data) as Patient[],
                count: res.data.count ?? (res.data.results ?? res.data).length,
            };
        },
        staleTime: 30 * 1000,
        placeholderData: (prev) => prev,
    });

    const patients = data?.results ?? [];
    const totalCount = data?.count ?? 0;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const handleDeletePatient = async (patientId: string) => {
        try {
            await api.delete(`/patients/${patientId}/`);
            setConfirmDeleteId(null);
            queryClient.invalidateQueries({ queryKey: ['patients'] });
        } catch {
            setConfirmDeleteId(null);
        }
    };

    const handleExportPdf = async () => {
        setExporting(true);
        try {
            const response = await api.get('/patients/export-pdf/', {
                responseType: 'blob',
                params: {
                    ...(debouncedSearch ? { search: debouncedSearch } : {}),
                    ...(statusFilter ? { status: statusFilter } : {}),
                },
            });
            const url = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'patients-list.pdf';
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            // silent — user can retry
        } finally {
            setExporting(false);
        }
    };

    return (
        <>
        <div className="patients-container">
            {isError && <div className="error-message" style={{ marginBottom: '12px' }}>{t('patients.error.load')}</div>}
            <div className="patients-header">
                <h2 className="page-title">{t('patients.title')}</h2>
                <div className="header-buttons">
                    <button onClick={() => navigate('/patients/add')} className="action-button add-button">
                        {t('patients.add_button')}
                    </button>
                    <button onClick={handleExportPdf} className="export-button" disabled={exporting}>
                        {exporting ? 'Exporting…' : t('patients.export_button')}
                    </button>
                </div>
            </div>

            <div className="search-container">
                <input
                    type="text"
                    placeholder={t('patients.search_placeholder')}
                    className="input search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="patients-status-filters">
                {[
                    { value: '', label: 'All' },
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'transferred', label: 'Transferred' },
                    { value: 'deceased', label: 'Deceased' },
                ].map(f => (
                    <button
                        key={f.value}
                        className={`status-filter-btn${statusFilter === f.value ? ' active' : ''} filter-${f.value || 'all'}`}
                        onClick={() => setStatusFilter(f.value)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {isLoading && patients.length === 0 ? (
                <p className="no-patients-message">{t('patients.loading')}</p>
            ) : (
                <div id="patients-list-to-export" className="patients-list">
                    {patients.length > 0 ? (
                        patients.map((patient) => (
                            <div key={patient.unique_id} className="patient-card">
                                <div className="patient-info">
                                    <div className="patient-name-row">
                                        <h3 className="patient-name">{patient.first_name} {patient.last_name}</h3>
                                        {patient.status && (
                                            <span className={`patient-list-status status-${patient.status}`}>{patient.status_display || patient.status}</span>
                                        )}
                                    </div>
                                    <p className="patient-dob"><strong>{t('patients.dob_label')}</strong> {patient.date_of_birth || t('patients.dob_not_specified')}</p>
                                </div>
                                <div className="patient-actions">
                                    <Link to={`/patients/${patient.unique_id}`} className="action-button details-button">
                                        {t('patients.view_folder')}
                                    </Link>
                                    <button
                                        onClick={() => navigate(`/patients/edit/${patient.unique_id}`)}
                                        className="action-button edit-button"
                                    >
                                        {t('patients.edit')}
                                    </button>
                                    <button
                                        onClick={() => setConfirmDeleteId(patient.unique_id)}
                                        className="action-button delete-button"
                                    >
                                        {t('patients.delete')}
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="no-patients-message">{t('patients.no_patients')}</p>
                    )}
                </div>
            )}

            <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={setPage}
                isLoading={isLoading}
            />
        </div>

        {confirmDeleteId && (
            <ConfirmModal
                message={t('patients.error.delete_confirm')}
                onConfirm={() => handleDeletePatient(confirmDeleteId)}
                onCancel={() => setConfirmDeleteId(null)}
            />
        )}
        </>
    );
};

export default Patients;
