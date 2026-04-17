import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';
import { procedureSchema, type ProcedureFormData, PROCEDURE_CATEGORIES } from '../procedureSchema';

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

const MedicalProcedureForm = ({ patientId, onSuccess, onCancel, procedureToEdit }: MedicalProcedureFormProps) => {
    const { t } = useTranslation();
    const [attachment, setAttachment] = useState<File | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<ProcedureFormData>({
        resolver: zodResolver(procedureSchema),
        defaultValues: {
            procedure_category: 'diagnostic',
            procedure_type: '',
            procedure_date: '',
            result: '',
        },
    });

    const procedureCategory = watch('procedure_category');

    useEffect(() => {
        if (procedureToEdit) {
            reset({
                procedure_category: procedureToEdit.procedure_category || 'diagnostic',
                procedure_type: procedureToEdit.procedure_type,
                procedure_date: procedureToEdit.procedure_date,
                result: procedureToEdit.result || '',
            });
            setAttachment(null);
        }
    }, [procedureToEdit, reset]);

    const onSubmit = async (data: ProcedureFormData) => {
        const formData = new FormData();
        formData.append('patient', patientId);
        formData.append('procedure_category', data.procedure_category);
        formData.append('procedure_type', data.procedure_type);
        formData.append('procedure_date', data.procedure_date);
        formData.append('result', data.result ?? '');
        if (attachment) {
            formData.append('attachments', attachment);
        }

        try {
            if (procedureToEdit?.id) {
                await api.patch(`/medical-procedures/${procedureToEdit.id}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                await api.post('/medical-procedures/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            toast.success(isEditing ? t('medical_procedure.submit_edit') : t('medical_procedure.submit_add'));
            onSuccess();
        } catch (err) {
            toast.error(parseApiError(err, t('medical_procedure.error.generic')));
        }
    };

    const isEditing = !!procedureToEdit;

    return (
        <Drawer
            open
            onClose={onCancel}
            title={isEditing ? t('medical_procedure.title_edit') : t('medical_procedure.title_add')}
            size="md"
            dirty={isDirty}
            footer={
                <>
                    <button type="button" onClick={onCancel} className="cancel-button" disabled={isSubmitting}>
                        {t('medical_procedure.cancel')}
                    </button>
                    <button type="submit" form="procedure-form" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? t('medical_procedure.loading') : (isEditing ? t('medical_procedure.submit_edit') : t('medical_procedure.submit_add'))}
                    </button>
                </>
            }
        >
            <form id="procedure-form" onSubmit={handleSubmit(onSubmit)} className="form">
                <div className="form-group">
                    <label htmlFor="procedure_category">Category <span className="required">*</span></label>
                    <select id="procedure_category" {...register('procedure_category')}>
                        {PROCEDURE_CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                    {errors.procedure_category && <span className="field-error">{errors.procedure_category.message}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="procedure_type">{t('medical_procedure.type')} <span className="required">*</span></label>
                    <input
                        type="text"
                        id="procedure_type"
                        placeholder={procedureCategory === 'other' ? 'Describe the procedure...' : 'e.g. Appendectomy, CBC, Chest X-ray'}
                        {...register('procedure_type')}
                    />
                    {errors.procedure_type && <span className="field-error">{errors.procedure_type.message}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="procedure_date">{t('medical_procedure.date')} <span className="required">*</span></label>
                    <input type="date" id="procedure_date" {...register('procedure_date')} />
                    {errors.procedure_date && <span className="field-error">{errors.procedure_date.message}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="result">{t('medical_procedure.result')}</label>
                    <textarea id="result" rows={5} {...register('result')} />
                </div>

                <div className="form-group">
                    <label htmlFor="attachments">{t('medical_procedure.attachments')}</label>
                    <input
                        type="file"
                        id="attachments"
                        onChange={e => setAttachment(e.target.files?.[0] ?? null)}
                    />
                </div>
            </form>
        </Drawer>
    );
};

export default MedicalProcedureForm;
