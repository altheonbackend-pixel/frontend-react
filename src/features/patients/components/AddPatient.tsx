//import React from 'react';
import PatientForm from './PatientForm';
import { useNavigate } from 'react-router-dom';
;
import { useTranslation } from 'react-i18next';

interface AddPatientProps {
    onPatientAdded: () => void;
}

const AddPatient = ({ onPatientAdded }: AddPatientProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleBackClick = () => {
        navigate('/patients');
    };

    const handleCancel = () => {
        // Appeler la même fonction de navigation pour retourner à la liste des patients
        navigate('/patients');
    };

    return (
        <div className="add-patient-container">
            <div className="add-patient-header">
                <button onClick={handleBackClick} className="back-button">
                    {t('add_patient.back_to_list')}
                </button>
                <h2 className="page-title">{t('add_patient.title')}</h2>
            </div>
            <PatientForm onSuccess={onPatientAdded} onCancel={handleCancel} />
        </div>
    );
};

export default AddPatient;