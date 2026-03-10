// Fichier : src/components/Patients.tsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../auth/hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import '../../../shared/styles/ListStyles.css';
import { type Patient } from '../../../shared/types';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';

interface PatientsProps {
    refreshPatients?: boolean;
}

const Patients = ({ refreshPatients }: PatientsProps) => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const navigate = useNavigate();

    const fetchPatients = async () => {
        if (!token) {
            setError(t('patients.error.auth'));
            setLoading(false);
            return;
        }

        try {
            const response = await api.get('/doctors/me/patients/');
            setPatients(response.data);
            setError(null);
        } catch (err) {
            console.error('Erreur lors de la récupération des patients:', err);
            setError(t('patients.error.load'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, [token, refreshPatients]);

    const handleAddPatientClick = () => {
        navigate('/patients/add');
    };

    const handleEditPatient = (patientId: string) => {
        navigate(`/patients/edit/${patientId}`);
    };

    const handleDeletePatient = async (patientId: string) => {
        if (!window.confirm(t('patients.error.delete_confirm'))) {
            return;
        }
        
        if (!token) {
            setError(t('patients.error.auth'));
            return;
        }

        try {
            await api.delete(`/patients/${patientId}/`);
            setPatients(patients.filter(patient => patient.unique_id !== patientId));
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

    // Logique de filtrage mise à jour pour le nom complet
    const filteredPatients = patients.filter(patient =>
        `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <div className="loading-message">{t('patients.loading')}</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>; // Error is already translated from state setter
    }

    return (
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
                {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
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
                                    onClick={() => handleDeletePatient(patient.unique_id)}
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
    );
};

export default Patients;