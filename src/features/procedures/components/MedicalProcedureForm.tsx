import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';

const PROCEDURE_CATEGORIES = [
    { value: 'surgical', label: 'Surgical' },
    { value: 'diagnostic', label: 'Diagnostic' },
    { value: 'therapeutic', label: 'Therapeutic' },
    { value: 'screening', label: 'Screening' },
    { value: 'vaccination', label: 'Vaccination' },
    { value: 'other', label: 'Other' },
];

interface MedicalProcedureRecord {
    id?: number;
    procedure_category?: string;
    procedure_type: string;
    procedure_date: string;
    result: string | null;
    attachments: string | null;
}

interface MedicalProcedureFormProps {
    patientId: string;
    onSuccess: () => void;
    onCancel: () => void;
    procedureToEdit?: MedicalProcedureRecord | null;
}

type FormData = {
    procedure_category: string;
    procedure_type: string;
    procedure_date: string;
    result: string;
    attachments: File | null;
};

const MedicalProcedureForm = ({ patientId, onSuccess, onCancel, procedureToEdit }: MedicalProcedureFormProps) => {
    const { t } = useTranslation();

    const [formData, setFormData] = useState<FormData>({
        procedure_category: 'diagnostic',
        procedure_type: '',
        procedure_date: '',
        result: '',
        attachments: null,
    });
    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (procedureToEdit) {
            setFormData({
                procedure_category: procedureToEdit.procedure_category || 'diagnostic',
                procedure_type: procedureToEdit.procedure_type,
                procedure_date: procedureToEdit.procedure_date,
                result: procedureToEdit.result || '',
                attachments: null,
            });
        }
    }, [procedureToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setDirty(true);
        const fileInput = e.target as HTMLInputElement;
        if (name === 'attachments' && fileInput.files && fileInput.files.length > 0) {
            setFormData(prev => ({ ...prev, attachments: fileInput.files![0] }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const dataToSend = new FormData();
        dataToSend.append('patient', patientId);
        dataToSend.append('procedure_category', formData.procedure_category);
        dataToSend.append('procedure_type', formData.procedure_type);
        dataToSend.append('procedure_date', formData.procedure_date);
        dataToSend.append('result', formData.result);
        if (formData.attachments) {
            dataToSend.append('attachments', formData.attachments);
        }

        try {
            if (procedureToEdit && procedureToEdit.id) {
                await api.patch(`/medical-procedures/${procedureToEdit.id}/`, dataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/medical-procedures/', dataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            toast.success(isEditing ? t('medical_procedure.submit_edit') : t('medical_procedure.submit_add'));
            setDirty(false);
            onSuccess();
        } catch (err) {
            toast.error(parseApiError(err, t('medical_procedure.error.generic')));
        } finally {
            setLoading(false);
        }
    };

    const isEditing = !!procedureToEdit;

    return (
        <Drawer
            open
            onClose={onCancel}
            title={isEditing ? t('medical_procedure.title_edit') : t('medical_procedure.title_add')}
            size="md"
            dirty={dirty}
            footer={
                <>
                    <button type="button" onClick={onCancel} className="cancel-button" disabled={loading}>
                        {t('medical_procedure.cancel')}
                    </button>
                    <button type="submit" form="procedure-form" disabled={loading}>
                        {loading ? t('medical_procedure.loading') : (isEditing ? t('medical_procedure.submit_edit') : t('medical_procedure.submit_add'))}
                    </button>
                </>
            }
        >
            <form id="procedure-form" onSubmit={handleSubmit} className="form">
                <div className="form-group">
                    <label htmlFor="procedure_category">Category <span className="required">*</span></label>
                    <select id="procedure_category" name="procedure_category" value={formData.procedure_category} onChange={handleChange}>
                        {PROCEDURE_CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="procedure_type">{t('medical_procedure.type')} <span className="required">*</span></label>
                    <input type="text" id="procedure_type" name="procedure_type" value={formData.procedure_type} onChange={handleChange} required
                        placeholder={formData.procedure_category === 'other' ? 'Describe the procedure...' : 'e.g. Appendectomy, CBC, Chest X-ray'} />
                </div>
                <div className="form-group">
                    <label htmlFor="procedure_date">{t('medical_procedure.date')} <span className="required">*</span></label>
                    <input type="date" id="procedure_date" name="procedure_date" value={formData.procedure_date} onChange={handleChange} required />
                </div>
                <div className="form-group">
                    <label htmlFor="result">{t('medical_procedure.result')}</label>
                    <textarea id="result" name="result" value={formData.result} onChange={handleChange} rows={5} />
                </div>
                <div className="form-group">
                    <label htmlFor="attachments">{t('medical_procedure.attachments')}</label>
                    <input type="file" id="attachments" name="attachments" onChange={handleChange} />
                </div>
            </form>
        </Drawer>
    );
};

export default MedicalProcedureForm;
