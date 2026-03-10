// src/pages/EditPatientPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import PatientForm from './PatientForm';
import { type Patient } from '../../../shared/types';
import api from '../../../shared/services/api';

const EditPatientPage = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPatient = async () => {
            if (!id || !token) {
                setLoading(false);
                setError(t('edit_patient.error.auth'));
                return;
            }

            try {
                const response = await api.get(`/patients/${id}/`);
                setPatient(response.data);
                setLoading(false);
            } catch (err) {
                console.error('Erreur lors de la récupération du patient:', err);
                setError(t('edit_patient.error.load'));
                setLoading(false);
            }
        };

        fetchPatient();
    }, [id, token]);

    const handleSuccess = () => {
        // Redirige vers la liste des patients après la mise à jour
        navigate('/patients');
    };

    const handleCancel = () => {
        navigate('/patients');
    };

    if (loading) {
        return <div className="loading-message">{t('edit_patient.loading')}</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!patient) {
        return <div className="no-data-message">{t('edit_patient.error.load')}</div>;
    }

    return (
        <div className="edit-patient-container">
            <h3>{t('edit_patient.title')}</h3>
            <PatientForm 
                patientToEdit={patient}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
            />
        </div>
    );
};

export default EditPatientPage;