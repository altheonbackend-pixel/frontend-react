import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../auth/hooks/useAuth';
import '../../../shared/styles/FormStyles.css';
import { type Patient } from '../../../shared/types';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';

interface PatientFormProps {
    onSuccess: (patient: Patient) => void;
    patientToEdit?: Patient | null;
    onCancel: () => void;
}

const PatientForm = ({ onSuccess, patientToEdit, onCancel }: PatientFormProps) => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        age: '',
        date_of_birth: '',
        medical_history: '',
        blood_group: '',
        address: '',
        email: '',
        phone_number: '',
        emergency_contact_name: '',
        emergency_contact_number: '',
        allergies: '',
    });

    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Pré-remplir le formulaire si un patient à modifier est passé en prop
    useEffect(() => {
        if (patientToEdit) {
            setFormData({
                first_name: patientToEdit.first_name || '',
                last_name: patientToEdit.last_name || '',
                age: patientToEdit.age !== null ? String(patientToEdit.age) : '',
                date_of_birth: patientToEdit.date_of_birth || '',
                medical_history: patientToEdit.medical_history || '',
                blood_group: patientToEdit.blood_group || '',
                address: patientToEdit.address || '',
                email: patientToEdit.email || '',
                phone_number: patientToEdit.phone_number || '',
                emergency_contact_name: patientToEdit.emergency_contact_name || '',
                emergency_contact_number: patientToEdit.emergency_contact_number || '',
                allergies: patientToEdit.allergies || '',
            });
        }
    }, [patientToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        if (!token) {
            setErrorMessage(t('patient_form.error.auth'));
            setLoading(false);
            return;
        }

        try {
            const dataToSend = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                date_of_birth: formData.date_of_birth || null,
                medical_history: formData.medical_history || null,
                blood_group: formData.blood_group || null,
                address: formData.address || null,
                email: formData.email || null,
                phone_number: formData.phone_number || null,
                emergency_contact_name: formData.emergency_contact_name || null,
                emergency_contact_number: formData.emergency_contact_number || null,
                allergies: formData.allergies || null,
                age: formData.age ? parseInt(formData.age, 10) : null,
            };

            let response;
            if (patientToEdit && patientToEdit.unique_id) {
                // Requête PUT pour modifier le patient existant
                response = await api.put(
                    `/patients/${patientToEdit.unique_id}/`,
                    dataToSend
                );
            } else {
                // Requête POST pour créer un nouveau patient
                response = await api.post(
                    `/patients/`,
                    dataToSend
                );
            }
            
            if (response.status === 201 || response.status === 200) {
                setSuccessMessage(patientToEdit ? t('patient_form.success.edit') : t('patient_form.success.add'));
                setFormData({
                    first_name: '', last_name: '', age: '', date_of_birth: '', medical_history: '',
                    blood_group: '', address: '', email: '', phone_number: '',
                    emergency_contact_name: '', emergency_contact_number: '', allergies: '',
                });
                onSuccess(response.data);

                // --- NOUVELLE LOGIQUE AJOUTÉE ---
                // Fermer le formulaire après 1.5 secondes pour laisser le temps au message de succès d'apparaître
                setTimeout(() => {
                    onCancel(); 
                }, 1500); 
            }
        } catch (err) {
            console.error('Erreur lors de l\'enregistrement du patient:', err);
            if (axios.isAxiosError(err) && err.response) {
                const errorData = err.response.data;
                const errorMessages = Object.values(errorData).flat().join(' ');
                setErrorMessage(`Erreur: ${errorMessages}`);
            } else {
                setErrorMessage(t('patient_form.error.general'));
            }
        } finally {
            setLoading(false);
        }
    };

    const buttonText = patientToEdit ? t('patient_form.submit.edit') : t('patient_form.submit.add');

    return (
        <div className="form-overlay">
            <div className="form-container">
                <form onSubmit={handleSubmit} className="form">
                    <h3>{patientToEdit ? t('patient_form.title_edit') : t('patient_form.title_add')}</h3>
                    {successMessage && <div className="success-message">{successMessage}</div>}
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                    
                    <div className="form-group">
                        <label htmlFor="first_name">{t('patient_form.label.first_name')} <span className="required">*</span></label>
                        <input type="text" id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="last_name">{t('patient_form.label.last_name')} <span className="required">*</span></label>
                        <input type="text" id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} required />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="date_of_birth">{t('patient_form.label.dob')}</label>
                        <input type="date" id="date_of_birth" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="age">{t('patient_form.label.age')}</label>
                        <input type="number" id="age" name="age" value={formData.age} onChange={handleChange} />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="email">{t('patient_form.label.email')}</label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone_number">{t('patient_form.label.phone')}</label>
                        <input type="tel" id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="address">{t('patient_form.label.address')}</label>
                        <textarea id="address" name="address" value={formData.address} onChange={handleChange} rows={3}></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="medical_history">{t('patient_form.label.medical_history')}</label>
                        <textarea id="medical_history" name="medical_history" value={formData.medical_history} onChange={handleChange} rows={5}></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="allergies">{t('patient_form.label.allergies')}</label>
                        <textarea id="allergies" name="allergies" value={formData.allergies} onChange={handleChange} rows={3}></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="blood_group">{t('patient_form.label.blood_group')}</label>
                        <input type="text" id="blood_group" name="blood_group" value={formData.blood_group} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="emergency_contact_name">{t('patient_form.label.emergency_name')}</label>
                        <input type="text" id="emergency_contact_name" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="emergency_contact_number">{t('patient_form.label.emergency_phone')}</label>
                        <input type="tel" id="emergency_contact_number" name="emergency_contact_number" value={formData.emergency_contact_number} onChange={handleChange} />
                    </div>
                    
                    <div className="form-actions">
                        <button type="submit" disabled={loading}>
                            {loading ? t('patient_form.submit.loading') : buttonText}
                        </button>
                        <button type="button" onClick={onCancel} className="cancel-button">
                            {t('patient_form.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PatientForm;