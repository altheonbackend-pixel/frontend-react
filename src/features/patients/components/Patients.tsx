import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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

    const fetchPatients = useCallback(async () => {
        if (!token) {
            setError(t('patients.error.auth'));
            setLoading(false);
            return;
        }

        try {
            const params: Record<string, string> = {};
            if (debouncedSearch) params.search = debouncedSearch;
            if (statusFilter) params.status = statusFilter;
            const response = await api.get('/doctors/me/patients/', { params });
            const patientsList = response.data.results ?? response.data;
            const sortedPatients = patientsList.sort((a: Patient, b: Patient) => {
              return (b.unique_id || "").localeCompare(a.unique_id || "");
            });
            setPatients(sortedPatients);
            setError(null);
        } catch {
            setError(t('patients.error.load'));
        } finally {
            setLoading(false);
        }
    }, [token, debouncedSearch, statusFilter, t]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients, refreshPatients, statusFilter]);

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

    const handleExportPdf = async () => {
        const input = document.getElementById('patients-list-to-export');
        if (input) {
            try {
                const canvas = await html2canvas(input, { scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                
                const pdf = new jsPDF('p', 'mm', 'a4');
                const imgProps= pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save("liste-des-patients.pdf");

            } catch {
                setError(t('patients.error.pdf'));
            }
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
                    <button onClick={handleExportPdf} className="action-button export-button">
                        {t('patients.export_button')}
                    </button>
                </div>
            </div>
            
            <div className="search-container">
                <input
                    type="text"
                    placeholder={t('patients.search_placeholder')}
                    className="search-input"
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
                                    {(patient as any).status && (
                                        <span className={`patient-list-status status-${(patient as any).status}`}>{(patient as any).status}</span>
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