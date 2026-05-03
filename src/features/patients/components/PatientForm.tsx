import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/hooks/useAuth';
import { type Patient } from '../../../shared/types';
import { useTranslation } from 'react-i18next';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import { useFormDraft } from '../../../shared/hooks/useFormDraft';
import api from '../../../shared/services/api';

const patientSchema = z.object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    date_of_birth: z.string().optional(),
    age: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone_number: z.string().optional(),
    address: z.string().optional(),
    medical_history: z.string().optional(),
    blood_group: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_number: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
    onSuccess: (patient: Patient) => void;
    patientToEdit?: Patient | null;
    onCancel: () => void;
}

const PatientForm = ({ onSuccess, patientToEdit, onCancel }: PatientFormProps) => {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();
    const [duplicates, setDuplicates] = useState<{ unique_id: string; first_name: string; last_name: string; date_of_birth: string | null }[]>([]);
    const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<PatientFormData>({
        resolver: zodResolver(patientSchema),
        defaultValues: {
            first_name: '',
            last_name: '',
            date_of_birth: '',
            age: '',
            email: '',
            phone_number: '',
            address: '',
            medical_history: '',
            blood_group: '',
            emergency_contact_name: '',
            emergency_contact_number: '',
        },
    });

    // Pre-fill form when editing
    useEffect(() => {
        if (patientToEdit) {
            reset({
                first_name: patientToEdit.first_name || '',
                last_name: patientToEdit.last_name || '',
                date_of_birth: patientToEdit.date_of_birth || '',
                age: patientToEdit.age !== null ? String(patientToEdit.age) : '',
                email: patientToEdit.email || '',
                phone_number: patientToEdit.phone_number || '',
                address: patientToEdit.address || '',
                medical_history: patientToEdit.medical_history || '',
                blood_group: patientToEdit.blood_group || '',
                emergency_contact_name: patientToEdit.emergency_contact_name || '',
                emergency_contact_number: patientToEdit.emergency_contact_number || '',
            });
        }
    }, [patientToEdit, reset]);

    // Draft auto-save for new patient forms only (editing uses server data)
    const { loadDraft, saveDraft, clearDraft } = useFormDraft<PatientFormData>('patient_new');
    const draftTimerRef2 = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (patientToEdit) return;
        const entry = loadDraft();
        if (entry) {
            reset(entry.data);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Duplicate detection for new patients — watches name + DOB fields
    const firstName = watch('first_name');
    const lastName = watch('last_name');
    const dateOfBirth = watch('date_of_birth');

    useEffect(() => {
        if (patientToEdit) return;
        if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
        if (firstName && firstName.length >= 2 && lastName && lastName.length >= 2) {
            dupTimerRef.current = setTimeout(async () => {
                try {
                    const params: Record<string, string> = { first_name: firstName, last_name: lastName };
                    if (dateOfBirth) params.date_of_birth = dateOfBirth;
                    const res = await api.get('/patients/check-duplicate/', { params });
                    setDuplicates(res.data.duplicates || []);
                } catch {
                    setDuplicates([]);
                }
            }, 600);
        } else {
            setDuplicates([]);
        }
        return () => { if (dupTimerRef.current) clearTimeout(dupTimerRef.current); };
    }, [firstName, lastName, dateOfBirth, patientToEdit]);

    // Debounce-save draft on form changes (new patients only)
    useEffect(() => {
        if (patientToEdit) return;
        if (draftTimerRef2.current) clearTimeout(draftTimerRef2.current);
        if (isDirty) {
            draftTimerRef2.current = setTimeout(() => saveDraft(watch()), 1500);
        }
        return () => { if (draftTimerRef2.current) clearTimeout(draftTimerRef2.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firstName, lastName, dateOfBirth, isDirty]);

    const onSubmit = async (data: PatientFormData) => {
        if (!isAuthenticated) {
            toast.error(t('patient_form.error.auth'));
            return;
        }

        const dataToSend = {
            first_name: data.first_name,
            last_name: data.last_name,
            date_of_birth: data.date_of_birth || null,
            medical_history: data.medical_history || null,
            blood_group: data.blood_group || null,
            address: data.address || null,
            email: data.email || null,
            phone_number: data.phone_number || null,
            emergency_contact_name: data.emergency_contact_name || null,
            emergency_contact_number: data.emergency_contact_number || null,
            age: data.age ? parseInt(data.age, 10) : null,
        };

        try {
            let response;
            if (patientToEdit?.unique_id) {
                response = await api.put(`/patients/${patientToEdit.unique_id}/`, dataToSend);
            } else {
                response = await api.post('/patients/', dataToSend);
            }

            if (response.status === 201 || response.status === 200) {
                toast.success(patientToEdit ? t('patient_form.success.edit') : t('patient_form.success.add'));
                clearDraft();
                onSuccess(response.data);
                onCancel();
            }
        } catch (err) {
            toast.error(parseApiError(err, t('patient_form.error.general')));
        }
    };

    const buttonText = patientToEdit ? t('patient_form.submit.edit') : t('patient_form.submit.add');

    return (
        <Modal
            open
            onClose={onCancel}
            title={patientToEdit ? t('patient_form.title_edit') : t('patient_form.title_add')}
            size="lg"
            dirty={isDirty}
            footer={
                <>
                    <button type="button" onClick={onCancel} className="cancel-button" disabled={isSubmitting}>
                        {t('patient_form.cancel')}
                    </button>
                    <button type="submit" form="patient-form" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? t('patient_form.submit.loading') : buttonText}
                    </button>
                </>
            }
        >
            <form id="patient-form" onSubmit={handleSubmit(onSubmit)} className="form" noValidate>
                {!patientToEdit && (
                    <div style={{ background: 'var(--info-bg, #eff6ff)', border: '1px solid var(--info-border, #bfdbfe)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--info-text, #1e40af)', lineHeight: 1.5 }}>
                        <strong>Patient portal accuracy notice:</strong> Date of birth, email, and phone number are used to verify the patient's identity when they claim their portal account. Make sure this information is accurate before saving.
                    </div>
                )}
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
                    <input type="text" id="first_name" className="input" {...register('first_name')} />
                    {errors.first_name && <span className="field-error">{errors.first_name.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="last_name">{t('patient_form.label.last_name')} <span className="required">*</span></label>
                    <input type="text" id="last_name" className="input" {...register('last_name')} />
                    {errors.last_name && <span className="field-error">{errors.last_name.message}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="date_of_birth" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {t('patient_form.label.dob')}
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, background: 'var(--accent-light, #dbeafe)', color: 'var(--accent)', padding: '0.1rem 0.45rem', borderRadius: '999px', letterSpacing: '0.02em' }}>Portal verification</span>
                    </label>
                    <input type="date" id="date_of_birth" className="input" {...register('date_of_birth')} />
                </div>
                <div className="form-group">
                    <label htmlFor="age">{t('patient_form.label.age')}</label>
                    <input type="number" id="age" className="input" {...register('age')} />
                </div>

                <div className="form-group">
                    <label htmlFor="email" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {t('patient_form.label.email')}
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, background: 'var(--accent-light, #dbeafe)', color: 'var(--accent)', padding: '0.1rem 0.45rem', borderRadius: '999px', letterSpacing: '0.02em' }}>Portal access</span>
                    </label>
                    <input type="email" id="email" className="input" {...register('email')} />
                    {errors.email && <span className="field-error">{errors.email.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="phone_number" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {t('patient_form.label.phone')}
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, background: 'var(--accent-light, #dbeafe)', color: 'var(--accent)', padding: '0.1rem 0.45rem', borderRadius: '999px', letterSpacing: '0.02em' }}>Portal verification</span>
                    </label>
                    <input type="tel" id="phone_number" className="input" {...register('phone_number')} />
                </div>
                <div className="form-group">
                    <label htmlFor="address">{t('patient_form.label.address')}</label>
                    <textarea id="address" className="textarea" rows={3} {...register('address')} />
                </div>
                <div className="form-group">
                    <label htmlFor="medical_history">{t('patient_form.label.medical_history')}</label>
                    <textarea id="medical_history" className="textarea" rows={5} {...register('medical_history')} />
                </div>
                <div className="form-group">
                    <label htmlFor="blood_group">{t('patient_form.label.blood_group')}</label>
                    <input type="text" id="blood_group" className="input" {...register('blood_group')} />
                </div>
                <div className="form-group">
                    <label htmlFor="emergency_contact_name">{t('patient_form.label.emergency_name')}</label>
                    <input type="text" id="emergency_contact_name" className="input" {...register('emergency_contact_name')} />
                </div>
                <div className="form-group">
                    <label htmlFor="emergency_contact_number">{t('patient_form.label.emergency_phone')}</label>
                    <input type="tel" id="emergency_contact_number" className="input" {...register('emergency_contact_number')} />
                </div>
            </form>
        </Modal>
    );
};

export default PatientForm;
