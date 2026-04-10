import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import '../../../shared/styles/FormStyles.css';
import api from '../../../shared/services/api';

const COMMON_SYMPTOMS = [
    'Fever', 'Cough', 'Shortness of breath', 'Fatigue', 'Headache',
    'Sore throat', 'Runny nose', 'Chest pain', 'Nausea', 'Vomiting',
    'Diarrhea', 'Abdominal pain', 'Back pain', 'Joint pain', 'Dizziness',
    'Loss of appetite', 'Weight loss', 'Sweating', 'Chills', 'Rash',
];

interface Consultation {
    id?: number;
    consultation_date: string;
    consultation_type?: string;
    reason_for_consultation: string;
    symptoms?: string[];
    medical_report: string | null;
    diagnosis: string | null;
    medications: string | null;
    follow_up_date?: string | null;
    weight: number | null;
    height: number | null;
    sp2: number | null;
    temperature: number | null;
    blood_pressure: string | null;
    visible_to_patient?: boolean;
}

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
        consultation_date: new Date().toISOString().slice(0, 10),
        consultation_type: 'in_person',
        reason_for_consultation: '',
        medical_report: '',
        diagnosis: '',
        medications: '',
        follow_up_date: '',
        weight: '',
        height: '',
        sp2: '',
        temperature: '',
        blood_pressure: '',
        visible_to_patient: false,
    });
    const [symptoms, setSymptoms] = useState<string[]>([]);
    const [customSymptom, setCustomSymptom] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (consultationToEdit) {
            setFormData({
                consultation_date: consultationToEdit.consultation_date || new Date().toISOString().slice(0, 10),
                consultation_type: consultationToEdit.consultation_type || 'in_person',
                reason_for_consultation: consultationToEdit.reason_for_consultation,
                medical_report: consultationToEdit.medical_report || '',
                diagnosis: consultationToEdit.diagnosis || '',
                medications: consultationToEdit.medications || '',
                follow_up_date: consultationToEdit.follow_up_date || '',
                weight: consultationToEdit.weight !== null ? String(consultationToEdit.weight) : '',
                height: consultationToEdit.height !== null ? String(consultationToEdit.height) : '',
                sp2: consultationToEdit.sp2 !== null ? String(consultationToEdit.sp2) : '',
                temperature: consultationToEdit.temperature !== null ? String(consultationToEdit.temperature) : '',
                blood_pressure: consultationToEdit.blood_pressure || '',
                visible_to_patient: consultationToEdit.visible_to_patient || false,
            });
            setSymptoms(consultationToEdit.symptoms || []);
        }
    }, [consultationToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const toggleSymptom = (symptom: string) => {
        setSymptoms(prev =>
            prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
        );
    };

    const addCustomSymptom = () => {
        const trimmed = customSymptom.trim();
        if (trimmed && !symptoms.includes(trimmed)) {
            setSymptoms(prev => [...prev, trimmed]);
            setCustomSymptom('');
        }
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
                symptoms,
                weight: formData.weight ? parseFloat(formData.weight) : null,
                height: formData.height ? parseFloat(formData.height) : null,
                sp2: formData.sp2 ? parseFloat(formData.sp2) : null,
                temperature: formData.temperature ? parseFloat(formData.temperature) : null,
                blood_pressure: formData.blood_pressure || null,
                follow_up_date: formData.follow_up_date || null,
            };

            let response;
            if (consultationToEdit && consultationToEdit.id) {
                response = await api.put(`/consultations/${consultationToEdit.id}/`, dataToSend);
            } else {
                response = await api.post('/consultations/', dataToSend);
            }

            if (response.status === 201 || response.status === 200) {
                onSuccess();
            }
        } catch (err) {
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
        <div className="form-overlay">
            <div className="form-container">
                <h3>{isEditing ? t('consultation.title_edit') : t('consultation.title_add')}</h3>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <form onSubmit={handleSubmit} className="form">
                    {/* Consultation date */}
                    <div className="form-group">
                        <label htmlFor="consultation_date">{t('consultation.date')} <span className="required">*</span></label>
                        <input type="date" id="consultation_date" name="consultation_date" value={formData.consultation_date} onChange={handleChange} required />
                    </div>

                    {/* Consultation type */}
                    <div className="form-group">
                        <label htmlFor="consultation_type">Consultation Type</label>
                        <select id="consultation_type" name="consultation_type" value={formData.consultation_type} onChange={handleChange}>
                            <option value="in_person">In Person</option>
                            <option value="telemedicine">Telemedicine</option>
                            <option value="home_visit">Home Visit</option>
                        </select>
                    </div>

                    {/* Vitals */}
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

                    {/* Clinical info */}
                    <div className="form-group">
                        <label htmlFor="reason_for_consultation">{t('consultation.reason')} <span className="required">*</span></label>
                        <textarea id="reason_for_consultation" name="reason_for_consultation" value={formData.reason_for_consultation} onChange={handleChange} required rows={3} />
                    </div>

                    {/* Symptoms multi-select */}
                    <div className="form-group">
                        <label>Symptoms</label>
                        <div className="symptoms-chips">
                            {COMMON_SYMPTOMS.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    className={`symptom-chip${symptoms.includes(s) ? ' active' : ''}`}
                                    onClick={() => toggleSymptom(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <div className="custom-symptom-row">
                            <input
                                type="text"
                                placeholder="Add custom symptom..."
                                value={customSymptom}
                                onChange={e => setCustomSymptom(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSymptom())}
                            />
                            <button type="button" onClick={addCustomSymptom} className="add-chip-btn">Add</button>
                        </div>
                        {symptoms.filter(s => !COMMON_SYMPTOMS.includes(s)).map(s => (
                            <span key={s} className="symptom-chip active custom-chip">
                                {s}
                                <button type="button" onClick={() => toggleSymptom(s)} className="chip-remove">×</button>
                            </span>
                        ))}
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

                    {/* Follow-up date */}
                    <div className="form-group">
                        <label htmlFor="follow_up_date">Follow-up Date</label>
                        <input type="date" id="follow_up_date" name="follow_up_date" value={formData.follow_up_date} onChange={handleChange} />
                    </div>

                    {/* Visible to patient toggle */}
                    <div className="form-group form-checkbox">
                        <label>
                            <input
                                type="checkbox"
                                name="visible_to_patient"
                                checked={formData.visible_to_patient}
                                onChange={handleChange}
                            />
                            {' '}Visible to patient
                        </label>
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
