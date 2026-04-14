import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/PatientsList.css';
import { type Patient } from '../../../shared/types';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import PageLoader from '../../../shared/components/PageLoader';

interface PatientsProps {
    refreshPatients?: number | boolean;
}

const Patients = ({ refreshPatients }: PatientsProps) => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [debouncedSearch, setDebouncedSearch] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const navigate = useNavigate();

    // Debounce the search term by 400 ms to avoid firing on every keystroke
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        if (!token) {
            setError(t('patients.error.auth'));
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);

        const params: Record<string, string> = {};
        if (debouncedSearch) params.search = debouncedSearch;
        if (statusFilter) params.status = statusFilter;

        api.get('/doctors/me/patients/', { params, signal: controller.signal })
            .then(response => {
                const patientsList = response.data.results ?? response.data;
                setPatients(patientsList.sort((a: Patient, b: Patient) =>
                    (b.unique_id || '').localeCompare(a.unique_id || '')
                ));
                setError(null);
            })
            .catch(err => {
                if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
                    setError(t('patients.error.load'));
                }
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, [token, debouncedSearch, statusFilter, refreshPatients, t]);

    const handleAddPatientClick = () => {
        navigate('/patients/add');
    };

    const handleEditPatient = (patientId: string) => {
        navigate(`/patients/edit/${patientId}`);
    };

    const handleDeletePatient = async (patientId: string) => {
        if (!token) {
            setError(t('patients.error.auth'));
            return;
        }

        try {
            await api.delete(`/patients/${patientId}/`);
            setPatients(patients.filter(patient => patient.unique_id !== patientId));
            setConfirmDeleteId(null);
        } catch {
            setError(t('patients.error.delete_error'));
            setConfirmDeleteId(null);
        }
    };

    const [exporting, setExporting] = useState(false);

    const handleExportPdf = async () => {
        setExporting(true);
        try {
            // Stream PDF from backend — avoids heavy jsPDF/html2canvas client-side bundle
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
            setError(t('patients.error.pdf'));
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return <PageLoader message={t('patients.loading')} />;
    }

    return (
        <>
        <div className="patients-container">
            {error && <div className="error-message" style={{ marginBottom: '12px' }}>{error}</div>}
            <div className="patients-header">
                <h2 className="page-title">{t('patients.title')}</h2>
                <div className="header-buttons">
                    <button onClick={handleAddPatientClick} className="action-button add-button">
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

            {/* Status filter tabs */}
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
                                    onClick={() => handleEditPatient(patient.unique_id)}
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