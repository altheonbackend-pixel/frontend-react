import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import '../../../shared/styles/FormStyles.css'; // Changement ici !
import api from '../../../shared/services/api';

// Ajout de l'interface pour la consultation
interface Consultation {
    id?: number; // Optionnel car absent lors de la création
    consultation_date: string;
    reason_for_consultation: string;
    medical_report: string | null;
    diagnosis: string | null;
    medications: string | null;
    weight: number | null;
    height: number | null;
    sp2: number | null;
    temperature: number | null;
    blood_pressure: string | null;
}

// Ajout de la prop optionnelle consultationToEdit
interface ConsultationFormProps {
    patientId: string;
    onSuccess: () => void;
    onCancel: () => void;
    consultationToEdit?: Consultation | null;
}

const ConsultationForm = ({ patientId, onSuccess, onCancel, consultationToEdit }: ConsultationFormProps) => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        reason_for_consultation: '',
        medical_report: '',
        diagnosis: '',
        medications: '',
        weight: '',
        height: '',
        sp2: '',
        temperature: '',
        blood_pressure: '',
    });
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Pré-remplir le formulaire si on est en mode modification
    useEffect(() => {
        if (consultationToEdit) {
            setFormData({
                reason_for_consultation: consultationToEdit.reason_for_consultation,
                medical_report: consultationToEdit.medical_report || '',
                diagnosis: consultationToEdit.diagnosis || '',
                medications: consultationToEdit.medications || '',
                weight: consultationToEdit.weight !== null ? String(consultationToEdit.weight) : '',
                height: consultationToEdit.height !== null ? String(consultationToEdit.height) : '',
                sp2: consultationToEdit.sp2 !== null ? String(consultationToEdit.sp2) : '',
                temperature: consultationToEdit.temperature !== null ? String(consultationToEdit.temperature) : '',
                blood_pressure: consultationToEdit.blood_pressure || '',
            });
        }
    }, [consultationToEdit]);

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
        setErrorMessage(null);

        if (!token) {
            setErrorMessage(t('consultation.error.auth'));
            setLoading(false);
            return;
        }

        try {
            const dataToSend = {
                ...formData,
                patient: patientId,
                weight: formData.weight ? parseFloat(formData.weight) : null,
                height: formData.height ? parseFloat(formData.height) : null,
                sp2: formData.sp2 ? parseFloat(formData.sp2) : null,
                temperature: formData.temperature ? parseFloat(formData.temperature) : null,
                blood_pressure: formData.blood_pressure || null,
            };

            let response;
            if (consultationToEdit && consultationToEdit.id) {
                // Modification (PUT)
                response = await api.put(
                    `/consultations/${consultationToEdit.id}/`,
                    dataToSend,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );
            } else {
                // Création (POST)
                response = await api.post('/consultations/', dataToSend, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
            }

            if (response.status === 201 || response.status === 200) {
                onSuccess();
            }
        } catch (err) {
            console.error('Erreur lors de l\'enregistrement de la consultation:', err);
            if (axios.isAxiosError(err) && err.response) {
                const errorData = err.response.data;
                const errorMessages = Object.values(errorData).flat().join(' ');
                setErrorMessage(`${t('consultation.error.prefix')}${errorMessages}`);
            } else {
                setErrorMessage(t('consultation.error.generic'));
            }
        } finally {
            setLoading(false);
        }
    };

    const isEditing = !!consultationToEdit;

    return (
        <div className="form-overlay"> {/* Changement de classe ici */}
            <div className="form-container"> {/* Changement de classe ici */}
                <h3>{isEditing ? t('consultation.title_edit') : t('consultation.title_add')}</h3>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <form onSubmit={handleSubmit} className="form"> {/* Changement de classe ici */}
                    {/* Partie 1 : Champs des données physiques */}
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="weight">{t('consultation.weight')}</label>
                            <input type="number" step="0.01" id="weight" name="weight" value={formData.weight} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="height">{t('consultation.height')}</label>
                            <input type="number" step="0.01" id="height" name="height" value={formData.height} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="temperature">{t('consultation.temperature')}</label>
                            <input type="number" step="0.01" id="temperature" name="temperature" value={formData.temperature} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="sp2">{t('consultation.sp2')}</label>
                            <input type="number" step="0.01" id="sp2" name="sp2" value={formData.sp2} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="blood_pressure">{t('consultation.blood_pressure')}</label>
                        <input type="text" id="blood_pressure" name="blood_pressure" value={formData.blood_pressure} onChange={handleChange} />
                    </div>

                    <hr />

                    {/* Partie 2 : Champs des motifs de consultation et symptômes */}
                    <div className="form-group">
                        <label htmlFor="reason_for_consultation">{t('consultation.reason')} <span className="required">*</span></label>
                        <textarea id="reason_for_consultation" name="reason_for_consultation" value={formData.reason_for_consultation} onChange={handleChange} required rows={3} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="diagnosis">{t('consultation.diagnosis')}</label>
                        <textarea id="diagnosis" name="diagnosis" value={formData.diagnosis} onChange={handleChange} rows={3} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="medical_report">{t('consultation.report')}</label>
                        <textarea id="medical_report" name="medical_report" value={formData.medical_report} onChange={handleChange} rows={5} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="medications">{t('consultation.medications')}</label>
                        <textarea id="medications" name="medications" value={formData.medications} onChange={handleChange} rows={3} />
                    </div>

                    <div className="form-actions">
                        <button type="submit" disabled={loading}>
                            {loading ? t('consultation.loading') : (isEditing ? t('consultation.submit_edit') : t('consultation.submit_add'))}
                        </button>
                        <button type="button" onClick={onCancel} className="cancel-button">
                            {t('consultation.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConsultationForm;