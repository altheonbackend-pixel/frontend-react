import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/hooks/useAuth';
import { type DoctorProfile } from '../../../shared/types';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';
import { referralSchema, type ReferralFormData } from '../referralSchema';

interface ReferralRecord {
    id?: number;
    referred_to?: number | { id: number };
    specialty_requested?: string;
    reason_for_referral?: string;
    comments?: string;
}

interface ReferralFormProps {
    patientId: string;
    onSuccess: () => void;
    onClose: () => void;
    referralToEdit?: ReferralRecord | null;
}

const ReferralForm = ({ patientId, onSuccess, onClose, referralToEdit }: ReferralFormProps) => {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [specialtyFilter, setSpecialtyFilter] = useState('');
    const [acceptingOnly, setAcceptingOnly] = useState(true);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<ReferralFormData>({
        resolver: zodResolver(referralSchema),
        defaultValues: {
            is_external: false,
            referred_to: null,
            external_doctor_name: '',
            external_doctor_email: '',
            external_hospital: '',
            specialty_requested: undefined,
            urgency: 'routine',
            reason_for_referral: '',
            comments: '',
        },
    });

    const isExternal = watch('is_external');
    const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setAttachmentFile(e.target.files?.[0] ?? null);
    }, []);

    const fetchDoctors = async (specialty?: string, accepting?: boolean) => {
        if (!isAuthenticated) return;
        try {
            const params: Record<string, string> = {};
            if (specialty) params.specialty = specialty;
            if (accepting) params.accepting_referrals = 'true';
            const response = await api.get('/doctors/', { params });
            setDoctors(response.data.results ?? response.data);
        } catch {
            toast.error(t('referrals.form.error.load_doctors'));
        }
    };

    useEffect(() => {
        fetchDoctors(undefined, acceptingOnly);
        return () => {
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSpecialtyFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSpecialtyFilter(val);
        setValue('referred_to', null);
        fetchDoctors(val || undefined, acceptingOnly);
    };

    const handleAcceptingToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setAcceptingOnly(checked);
        setValue('referred_to', null);
        fetchDoctors(specialtyFilter || undefined, checked);
    };

    useEffect(() => {
        if (referralToEdit) {
            const ref = referralToEdit.referred_to;
            const refId = typeof ref === 'object' && ref !== null
                ? ref.id
                : ref != null ? Number(ref) : null;
            reset({
                is_external: false,
                referred_to: refId,
                specialty_requested: (referralToEdit.specialty_requested as ReferralFormData['specialty_requested']) || undefined,
                urgency: 'routine',
                reason_for_referral: referralToEdit.reason_for_referral || '',
                comments: referralToEdit.comments || '',
                external_doctor_name: '',
                external_doctor_email: '',
                external_hospital: '',
            });
        } else {
            reset({
                is_external: false,
                referred_to: null,
                external_doctor_name: '',
                external_hospital: '',
                specialty_requested: undefined,
                urgency: 'routine',
                reason_for_referral: '',
                comments: '',
            });
        }
    }, [referralToEdit, reset]);

    const onSubmit = async (data: ReferralFormData) => {
        if (!isAuthenticated) {
            toast.error(t('referrals.form.error.auth'));
            return;
        }
        try {
            const formData = new FormData();
            formData.append('patient', patientId);
            Object.entries(data).forEach(([key, value]) => {
                if (value != null && value !== '') formData.append(key, String(value));
            });
            if (attachmentFile) formData.append('attached_documents', attachmentFile);

            if (referralToEdit?.id) {
                await api.put(`/referrals/${referralToEdit.id}/`, formData);
                toast.success(t('referrals.form.submit_edit'));
            } else {
                await api.post('/referrals/', formData);
                toast.success(t('referrals.form.submit_add'));
            }
            onSuccess();
        } catch (err) {
            toast.error(parseApiError(err, t('referrals.form.error.save')));
        }
    };

    const isEditing = !!referralToEdit;

    return (
        <Drawer
            open
            onClose={onClose}
            title={isEditing ? t('referrals.form.title_edit') : t('referrals.form.title_add')}
            size="md"
            dirty={isDirty}
            footer={
                <>
                    <button type="button" onClick={onClose} className="cancel-button" disabled={isSubmitting}>
                        {t('referrals.form.cancel')}
                    </button>
                    <button type="submit" form="referral-form" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? t('referrals.form.loading') : (isEditing ? t('referrals.form.submit_edit') : t('referrals.form.submit_add'))}
                    </button>
                </>
            }
        >
            <form id="referral-form" onSubmit={handleSubmit(onSubmit)}>
                {/* Referral mode toggle */}
                <div className="referral-mode-toggle">
                    <button
                        type="button"
                        className={!isExternal ? 'active' : ''}
                        onClick={() => setValue('is_external', false, { shouldDirty: true })}
                    >
                        Refer to Altheon doctor
                    </button>
                    <button
                        type="button"
                        className={isExternal ? 'active' : ''}
                        onClick={() => setValue('is_external', true, { shouldDirty: true })}
                    >
                        External specialist
                    </button>
                </div>

                {!isExternal ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <input
                                type="checkbox"
                                id="accepting_only"
                                checked={acceptingOnly}
                                onChange={handleAcceptingToggle}
                                style={{ cursor: 'pointer' }}
                            />
                            <label htmlFor="accepting_only" style={{ margin: 0, fontSize: '0.875rem', cursor: 'pointer' }}>
                                Accepting referrals only
                            </label>
                        </div>

                        <div className="form-group">
                            <label htmlFor="specialty_filter">Filter by Specialty</label>
                            <select
                                id="specialty_filter"
                                className="select-input"
                                value={specialtyFilter}
                                onChange={handleSpecialtyFilter}
                            >
                                <option value="">All specialties</option>
                                <option value="general_practice">General Practice</option>
                                <option value="cardiology">Cardiology</option>
                                <option value="dermatology">Dermatology</option>
                                <option value="endocrinology">Endocrinology</option>
                                <option value="gastroenterology">Gastroenterology</option>
                                <option value="neurology">Neurology</option>
                                <option value="oncology">Oncology</option>
                                <option value="ophthalmology">Ophthalmology</option>
                                <option value="orthopaedics">Orthopaedics</option>
                                <option value="paediatrics">Paediatrics</option>
                                <option value="psychiatry">Psychiatry</option>
                                <option value="pulmonology">Pulmonology</option>
                                <option value="radiology">Radiology</option>
                                <option value="rheumatology">Rheumatology</option>
                                <option value="urology">Urology</option>
                                <option value="nephrology">Nephrology</option>
                                <option value="haematology">Haematology</option>
                                <option value="infectious_disease">Infectious Disease</option>
                                <option value="emergency_medicine">Emergency Medicine</option>
                                <option value="anaesthesiology">Anaesthesiology</option>
                                <option value="pathology">Pathology</option>
                                <option value="other">Other</option>
                            </select>
                            {specialtyFilter && <small className="form-hint">{doctors.length} doctor(s) in this specialty</small>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="referred_to">{t('referrals.form.doctor_label')}</label>
                            <select
                                id="referred_to"
                                className="select-input"
                                {...register('referred_to', { setValueAs: (v: string) => v === '' ? null : Number(v) })}
                            >
                                <option value="">{t('referrals.form.select_doctor')}</option>
                                {doctors.map(doctor => (
                                    <option key={doctor.id} value={doctor.id}>
                                        Dr. {doctor.full_name} - {doctor.specialty || 'General'}
                                    </option>
                                ))}
                            </select>
                            {errors.referred_to && <span className="field-error">{errors.referred_to.message}</span>}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="form-group">
                            <label htmlFor="external_doctor_name">
                                Doctor Name <span className="form-hint" style={{ display: 'inline' }}>(optional)</span>
                            </label>
                            <input
                                type="text"
                                id="external_doctor_name"
                                className="input"
                                placeholder="e.g. Dr. Ahmed Khan"
                                {...register('external_doctor_name')}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="external_doctor_email">
                                Doctor's Email{' '}
                                <span className="form-hint" style={{ display: 'inline' }}>
                                    — sends a platform invite to this doctor
                                </span>
                            </label>
                            <input
                                type="email"
                                id="external_doctor_email"
                                className="input"
                                placeholder="e.g. dr.specialist@hospital.com"
                                {...register('external_doctor_email')}
                            />
                            {errors.external_doctor_email && (
                                <span className="field-error">{errors.external_doctor_email.message}</span>
                            )}
                        </div>
                        <div className="form-group">
                            <label htmlFor="external_hospital">Hospital / Clinic <span className="required">*</span></label>
                            <input
                                type="text"
                                id="external_hospital"
                                className="input"
                                placeholder="e.g. Aga Khan Hospital"
                                {...register('external_hospital')}
                            />
                            {errors.external_hospital && <span className="field-error">{errors.external_hospital.message}</span>}
                        </div>
                    </>
                )}

                <div className="form-group">
                    <label htmlFor="specialty_requested">{t('referrals.form.specialty_label')} <span className="required">*</span></label>
                    <select id="specialty_requested" className="select-input" {...register('specialty_requested')}>
                        <option value="">Select specialty…</option>
                        <option value="general_practice">General Practice</option>
                        <option value="cardiology">Cardiology</option>
                        <option value="dermatology">Dermatology</option>
                        <option value="endocrinology">Endocrinology</option>
                        <option value="gastroenterology">Gastroenterology</option>
                        <option value="hematology">Hematology</option>
                        <option value="infectious_disease">Infectious Disease</option>
                        <option value="internal_medicine">Internal Medicine</option>
                        <option value="nephrology">Nephrology</option>
                        <option value="neurology">Neurology</option>
                        <option value="oncology">Oncology</option>
                        <option value="ophthalmology">Ophthalmology</option>
                        <option value="orthopedics">Orthopedics</option>
                        <option value="pediatrics">Pediatrics</option>
                        <option value="psychiatry">Psychiatry</option>
                        <option value="pulmonology">Pulmonology</option>
                        <option value="radiology">Radiology</option>
                        <option value="rheumatology">Rheumatology</option>
                        <option value="surgery_general">General Surgery</option>
                        <option value="urology">Urology</option>
                        <option value="gynecology">Gynecology &amp; Obstetrics</option>
                        <option value="ent">ENT (Ear, Nose &amp; Throat)</option>
                        <option value="emergency_medicine">Emergency Medicine</option>
                        <option value="anesthesiology">Anesthesiology</option>
                        <option value="pathology">Pathology</option>
                        <option value="other">Other</option>
                    </select>
                    {errors.specialty_requested && <span className="field-error">{errors.specialty_requested.message}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="reason_for_referral">{t('referrals.form.reason_label')}</label>
                    <textarea
                        id="reason_for_referral"
                        className="textarea"
                        rows={4}
                        {...register('reason_for_referral')}
                    />
                    {errors.reason_for_referral && <span className="field-error">{errors.reason_for_referral.message}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="comments">{t('referrals.form.comments_label')}</label>
                    <textarea
                        id="comments"
                        className="textarea"
                        rows={4}
                        {...register('comments')}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="attached_documents">{t('referrals.form.attachment_label', 'Attachment')} <span className="form-hint" style={{ display: 'inline' }}>(optional)</span></label>
                    <input
                        type="file"
                        id="attached_documents"
                        className="input"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={handleFileChange}
                    />
                    {attachmentFile && (
                        <small className="form-hint">{attachmentFile.name}</small>
                    )}
                </div>
            </form>
        </Drawer>
    );
};

export default ReferralForm;
