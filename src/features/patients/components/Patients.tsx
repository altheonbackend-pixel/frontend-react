// Fichier : src/components/Patients.tsx

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
            const response = await api.get('/doctors/me/patients/', { params });
            setPatients(response.data.results ?? response.data);
            setError(null);
        } catch (err) {
            console.error('Erreur lors de la récupération des patients:', err);
            setError(t('patients.error.load'));
        } finally {
            setLoading(false);
        }
    }, [token, debouncedSearch, t]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients, refreshPatients]);

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
            console.log(`Patient ${patientId} supprimé avec succès.`);
        } catch (err) {
            console.error('Erreur lors de la suppression du patient:', err);
            setError(t('patients.error.delete_error'));
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

            } catch (err) {
                console.error("Erreur lors de la création du PDF:", err);
                setError(t('patients.error.pdf'));
            }
        }
    };

    if (loading) {
        return <div className="loading-message">{t('patients.loading')}</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>; // Error is already translated from state setter
    }

    return (
        <>
        <div className="patients-container">
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
            
            <div id="patients-list-to-export" className="patients-list">
                {patients.length > 0 ? (
                    patients.map((patient) => (
                        <div key={patient.unique_id} className="patient-card">
                            <div className="patient-info">
                                <h3 className="patient-name">{patient.first_name} {patient.last_name}</h3>
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