import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Patient } from '../../../shared/types';
import { useTranslation } from 'react-i18next';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
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
    });

    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [duplicates, setDuplicates] = useState<{ unique_id: string; first_name: string; last_name: string; date_of_birth: string | null }[]>([]);
    const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
        };
    }, []);

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
            });
        }
    }, [patientToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const updated = { ...formData, [name]: value };
        setFormData(updated);
        setDirty(true);

        // Duplicate detection: check when name fields change (only for new patients)
        if (!patientToEdit && (name === 'first_name' || name === 'last_name' || name === 'date_of_birth')) {
            const fn = name === 'first_name' ? value : updated.first_name;
            const ln = name === 'last_name' ? value : updated.last_name;
            const dob = name === 'date_of_birth' ? value : updated.date_of_birth;
            if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
            if (fn.length >= 2 && ln.length >= 2) {
                dupTimerRef.current = setTimeout(async () => {
                    try {
                        const params: Record<string, string> = { first_name: fn, last_name: ln };
                        if (dob) params.date_of_birth = dob;
                        const res = await api.get('/patients/check-duplicate/', { params });
                        setDuplicates(res.data.duplicates || []);
                    } catch {
                        setDuplicates([]);
                    }
                }, 600);
            } else {
                setDuplicates([]);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!token) {
            toast.error(t('patient_form.error.auth'));
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
                toast.success(patientToEdit ? t('patient_form.success.edit') : t('patient_form.success.add'));
                setDirty(false);
                onSuccess(response.data);
                onCancel();
            }
        } catch (err) {
            toast.error(parseApiError(err, t('patient_form.error.general')));
        } finally {
            setLoading(false);
        }
    };

    const buttonText = patientToEdit ? t('patient_form.submit.edit') : t('patient_form.submit.add');

    return (
        <Modal
            open
            onClose={onCancel}
            title={patientToEdit ? t('patient_form.title_edit') : t('patient_form.title_add')}
            size="lg"
            dirty={dirty}
            footer={
                <>
                    <button type="button" onClick={onCancel} className="cancel-button" disabled={loading}>
                        {t('patient_form.cancel')}
                    </button>
                    <button type="submit" form="patient-form" disabled={loading}>
                        {loading ? t('patient_form.submit.loading') : buttonText}
                    </button>
                </>
            }
        >
                <form id="patient-form" onSubmit={handleSubmit} className="form">
                    {duplicates.length > 0 && (
                        <div className="duplicate-warning">
                            <strong>⚠ Possible duplicate patient detected:</strong>
                            <ul>
                                {duplicates.map(d => (
                                    <li key={d.unique_id}>
                                        {d.first_name} {d.last_name}
                                        {d.date_of_birth && ` — DOB: ${d.date_of_birth}`}
                                    </li>
                                ))}
                            </ul>
                            <small>Review before creating a new record to avoid duplicates.</small>
                        </div>
                    )}

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
                    
                </form>
        </Modal>
    );
};

export default PatientForm;