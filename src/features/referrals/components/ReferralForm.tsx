import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/hooks/useAuth';
import { type DoctorProfile } from '../../../shared/types';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import { createReferral, updateReferral, submitDraft } from '../services/referralService';
import { referralSchema, type ReferralFormData, SPECIALTY_VALUES } from '../referralSchema';

const SPECIALTY_LABELS: Record<string, string> = {
    general_practice: 'General Practice', cardiology: 'Cardiology',
    dermatology: 'Dermatology', endocrinology: 'Endocrinology',
    gastroenterology: 'Gastroenterology', hematology: 'Hematology',
    infectious_disease: 'Infectious Disease', internal_medicine: 'Internal Medicine',
    nephrology: 'Nephrology', neurology: 'Neurology', oncology: 'Oncology',
    ophthalmology: 'Ophthalmology', orthopedics: 'Orthopedics',
    pediatrics: 'Pediatrics', psychiatry: 'Psychiatry', pulmonology: 'Pulmonology',
    radiology: 'Radiology', rheumatology: 'Rheumatology',
    surgery_general: 'General Surgery', urology: 'Urology',
    gynecology: 'Gynecology & Obstetrics', ent: 'ENT (Ear, Nose & Throat)',
    emergency_medicine: 'Emergency Medicine', anesthesiology: 'Anesthesiology',
    pathology: 'Pathology', other: 'Other',
};

interface ReferralRecord {
    id?: number;
    status?: string;
    referred_to?: number | null;
    referred_to_details?: { id: number; full_name: string; specialty?: string } | null;
    specialty_requested?: string;
    reason_for_referral?: string;
    comments?: string | null;
    urgency?: string;
    referral_type?: string;
    care_relationship_type?: string;
    is_external?: boolean;
    external_doctor_name?: string;
    external_doctor_email?: string;
}

interface ReferralFormProps {
    patientId: string;
    onSuccess: () => void;
    onClose: () => void;
    referralToEdit?: ReferralRecord | null;
    sourceEncounterId?: string;
}

const ReferralForm = ({
    patientId, onSuccess, onClose, referralToEdit, sourceEncounterId,
}: ReferralFormProps) => {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [specialtyFilter, setSpecialtyFilter] = useState('');
    const [acceptingOnly, setAcceptingOnly] = useState(true);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [specialtyAutoFilled, setSpecialtyAutoFilled] = useState(false);

    const isEditing     = !!referralToEdit;
    const isDraftEdit   = referralToEdit?.status === 'draft';
    const isReturnedEdit = referralToEdit?.status === 'returned';
    // Can edit destination only while draft (or new)
    const canChangeDestination = !isEditing || isDraftEdit;

    const {
        register, handleSubmit, reset, watch, setValue,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<ReferralFormData>({
        resolver: zodResolver(referralSchema),
        defaultValues: {
            is_external: false, referred_to: null,
            external_doctor_name: '', external_doctor_email: '',
            specialty_requested: undefined,
            urgency: 'routine',
            referral_type: 'consultation_required',
            care_relationship_type: 'consultation_only',
            reason_for_referral: '', comments: '', is_draft: false,
        },
    });

    const isExternal       = watch('is_external');
    const watchedReferredTo = watch('referred_to');
    const filterTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setAttachmentFile(e.target.files?.[0] ?? null);
    }, []);

    const fetchDoctors = async (specialty?: string, accepting?: boolean) => {
        if (!isAuthenticated) return;
        try {
            const params: Record<string, string> = {};
            if (specialty) params.specialty = specialty;
            if (accepting) params.accepting_referrals = 'true';
            const { default: api } = await import('../../../shared/services/api');
            const response = await api.get('/doctors/', { params });
            setDoctors(response.data.results ?? response.data);
        } catch {
            toast.error(t('referrals.form.error.load_doctors'));
        }
    };

    useEffect(() => {
        fetchDoctors(undefined, acceptingOnly);
        return () => { if (filterTimerRef.current) clearTimeout(filterTimerRef.current); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-fill specialty when doctor is selected
    useEffect(() => {
        if (!watchedReferredTo || !doctors.length) return;
        const selected = doctors.find(d => d.id === watchedReferredTo);
        if (selected?.specialty) {
            const sp = selected.specialty as typeof SPECIALTY_VALUES[number];
            if (SPECIALTY_VALUES.includes(sp)) {
                setValue('specialty_requested', sp, { shouldDirty: false });
                setSpecialtyAutoFilled(true);
            }
        }
    }, [watchedReferredTo, doctors, setValue]);

    // Clear auto-fill indicator when user manually changes specialty
    const handleSpecialtyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSpecialtyAutoFilled(false);
        setValue('specialty_requested', e.target.value as ReferralFormData['specialty_requested'], {
            shouldDirty: true,
        });
    };

    const handleSpecialtyFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSpecialtyFilter(val);
        setValue('referred_to', null);
        setSpecialtyAutoFilled(false);
        fetchDoctors(val || undefined, acceptingOnly);
    };

    const handleAcceptingToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setAcceptingOnly(checked);
        setValue('referred_to', null);
        setSpecialtyAutoFilled(false);
        fetchDoctors(specialtyFilter || undefined, checked);
    };

    useEffect(() => {
        if (referralToEdit) {
            const refId = referralToEdit.referred_to != null ? Number(referralToEdit.referred_to) : null;
            reset({
                is_external:          referralToEdit.is_external ?? false,
                referred_to:          refId,
                specialty_requested:  (referralToEdit.specialty_requested as ReferralFormData['specialty_requested']) || undefined,
                urgency:              (referralToEdit.urgency as ReferralFormData['urgency']) ?? 'routine',
                referral_type:        (referralToEdit.referral_type as ReferralFormData['referral_type']) ?? 'consultation_required',
                care_relationship_type: (referralToEdit.care_relationship_type as ReferralFormData['care_relationship_type']) ?? 'consultation_only',
                reason_for_referral:  referralToEdit.reason_for_referral || '',
                comments:             referralToEdit.comments || '',
                external_doctor_name: referralToEdit.external_doctor_name || '',
                external_doctor_email: referralToEdit.external_doctor_email || '',
                is_draft: false,
            });
        } else {
            reset({
                is_external: false, referred_to: null,
                external_doctor_name: '', external_doctor_email: '',
                specialty_requested: undefined,
                urgency: 'routine',
                referral_type: 'consultation_required',
                care_relationship_type: 'consultation_only',
                reason_for_referral: '', comments: '', is_draft: false,
            });
        }
    }, [referralToEdit, reset]);

    const buildFormData = (data: ReferralFormData): FormData => {
        const fd = new FormData();
        fd.append('patient', patientId);
        if (sourceEncounterId) fd.append('source_encounter', sourceEncounterId);
        Object.entries(data).forEach(([key, value]) => {
            if (key === 'is_draft') return; // handled separately
            if (value != null && value !== '') fd.append(key, String(value));
        });
        if (attachmentFile) fd.append('attached_documents', attachmentFile);
        return fd;
    };

    const onSubmit = async (data: ReferralFormData, { isDraftSave = false } = {}) => {
        if (!isAuthenticated) { toast.error(t('referrals.form.error.auth')); return; }
        try {
            const fd = buildFormData(data);

            if ((isDraftEdit || isReturnedEdit) && !isDraftSave) {
                // Draft submit OR returned resubmit → PATCH content then /submit/ to transition to pending
                await updateReferral(referralToEdit!.id!, fd);
                await submitDraft(referralToEdit!.id!);
                toast.success(isReturnedEdit ? 'Referral resubmitted to specialist.' : 'Referral submitted successfully.');
            } else if (isEditing && !isDraftSave) {
                await updateReferral(referralToEdit!.id!, fd);
                toast.success(t('referrals.form.submit_edit'));
            } else if (isEditing && isDraftSave) {
                await updateReferral(referralToEdit!.id!, fd);
                toast.success('Draft saved.');
            } else if (isDraftSave) {
                fd.append('status', 'draft');
                await createReferral(fd);
                toast.success('Draft saved.');
            } else {
                await createReferral(fd);
                toast.success(t('referrals.form.submit_add'));
            }
            onSuccess();
        } catch (err) {
            toast.error(parseApiError(err, t('referrals.form.error.save')));
        }
    };

    const urgencyHint: Record<string, string> = {
        urgent:    'Specialist will be flagged as high priority.',
        emergency: 'Emergency — SLA is 1 hour. Specialist is notified immediately.',
    };
    const watchedUrgency = watch('urgency');

    return (
        <Drawer
            open
            onClose={onClose}
            title={
                isDraftEdit ? 'Submit Referral' :
                isReturnedEdit ? 'Edit & Resubmit Referral' :
                isEditing ? t('referrals.form.title_edit') :
                t('referrals.form.title_add')
            }
            size="md"
            dirty={isDirty}
            footer={
                <>
                    <button type="button" onClick={onClose} className="cancel-button" disabled={isSubmitting}>
                        {t('referrals.form.cancel')}
                    </button>
                    {/* Save as draft — only for new or draft-edit */}
                    {(!isEditing || isDraftEdit) && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={isSubmitting}
                            onClick={handleSubmit(data => onSubmit(data, { isDraftSave: true }))}
                        >
                            {isSubmitting ? 'Saving…' : 'Save Draft'}
                        </button>
                    )}
                    <button
                        type="submit"
                        form="referral-form"
                        className="btn btn-primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? t('referrals.form.loading') :
                            isDraftEdit ? t('referrals.form.send_referral') :
                            isReturnedEdit ? t('referrals.form.resubmit_referral') :
                            isEditing ? t('referrals.form.submit_edit') :
                            t('referrals.form.submit_add')}
                    </button>
                </>
            }
        >
            <form id="referral-form" onSubmit={handleSubmit(data => onSubmit(data))}>

                {/* Referral mode toggle — only available when destination can change */}
                {canChangeDestination && (
                    <div className="referral-mode-toggle">
                        <button
                            type="button"
                            className={!isExternal ? 'active' : ''}
                            onClick={() => setValue('is_external', false, { shouldDirty: true })}
                        >{t('referrals.form.refer_internal')}</button>
                        <button
                            type="button"
                            className={isExternal ? 'active' : ''}
                            onClick={() => setValue('is_external', true, { shouldDirty: true })}
                        >{t('referrals.form.external_specialist')}</button>
                    </div>
                )}

                {!isExternal ? (
                    canChangeDestination ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <input
                                    type="checkbox" id="accepting_only"
                                    checked={acceptingOnly} onChange={handleAcceptingToggle}
                                    style={{ cursor: 'pointer' }}
                                />
                                <label htmlFor="accepting_only" style={{ margin: 0, fontSize: '0.875rem', cursor: 'pointer' }}>
                                    {t('referrals.form.accepting_only')}
                                </label>
                            </div>

                            <div className="form-group">
                                <label htmlFor="specialty_filter">{t('referrals.form.filter_specialty')}</label>
                                <select id="specialty_filter" className="select-input" value={specialtyFilter} onChange={handleSpecialtyFilter}>
                                    <option value="">{t('referrals.form.all_specialties')}</option>
                                    {SPECIALTY_VALUES.map(v => (
                                        <option key={v} value={v}>{t(`specialties.${v}`, SPECIALTY_LABELS[v] ?? v)}</option>
                                    ))}
                                </select>
                                {specialtyFilter && <small className="form-hint">{t('referrals.form.doctors_in_specialty', { count: doctors.length })}</small>}
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
                                            Dr. {doctor.full_name} - {t(`specialties.${doctor.specialty ?? 'general_practice'}`, SPECIALTY_LABELS[doctor.specialty ?? ''] ?? doctor.specialty ?? 'General')}
                                        </option>
                                    ))}
                                </select>
                                {errors.referred_to && <span className="field-error">{errors.referred_to.message}</span>}
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label>{t('referrals.form.referred_to')}</label>
                            <p style={{ padding: '0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                Dr. {referralToEdit?.referred_to_details?.full_name ?? referralToEdit?.referred_to ?? '—'}
                                <span className="form-hint" style={{ marginLeft: 8 }}>{t('referrals.form.cannot_change')}</span>
                            </p>
                        </div>
                    )
                ) : (
                    <>
                        <div className="form-group">
                            <label htmlFor="external_doctor_name">{t('referrals.form.external_name')} <span className="required">*</span></label>
                            <input type="text" id="external_doctor_name" className="input" placeholder={t('referrals.form.external_name_placeholder')} {...register('external_doctor_name')} />
                            {errors.external_doctor_name && <span className="field-error">{errors.external_doctor_name.message}</span>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="external_doctor_email">{t('referrals.form.external_email')} <span className="required">*</span> <span className="form-hint" style={{ display: 'inline' }}>{t('referrals.form.sends_invite')}</span></label>
                            <input type="email" id="external_doctor_email" className="input" placeholder={t('referrals.form.external_email_placeholder')} {...register('external_doctor_email')} />
                            {errors.external_doctor_email && <span className="field-error">{errors.external_doctor_email.message}</span>}
                        </div>
                    </>
                )}

                {/* Referral Type */}
                <div className="form-group">
                    <label htmlFor="referral_type">{t('referrals.form.type_label')} <span className="required">*</span></label>
                    <select id="referral_type" className="select-input" {...register('referral_type')}>
                        <option value="consultation_required">{t('referrals.type.consultation_required')}</option>
                        <option value="second_opinion_only">{t('referrals.type.second_opinion_only')}</option>
                        <option value="transfer_of_care">{t('referrals.type.transfer_of_care')}</option>
                        <option value="procedure_request">{t('referrals.type.procedure_request')}</option>
                        <option value="diagnostic_request">{t('referrals.type.diagnostic_request')}</option>
                    </select>
                </div>

                {/* Urgency */}
                <div className="form-group">
                    <label htmlFor="urgency">{t('referrals.form.urgency_label')} <span className="required">*</span></label>
                    <select id="urgency" className="select-input" {...register('urgency')}>
                        <option value="routine">{t('common.status.routine')}</option>
                        <option value="urgent">{t('common.status.urgent')}</option>
                        <option value="emergency">{t('common.status.emergency')}</option>
                    </select>
                    {urgencyHint[watchedUrgency] && (
                        <small className="form-hint" style={{ color: watchedUrgency === 'emergency' ? 'var(--color-danger)' : undefined }}>
                            {urgencyHint[watchedUrgency]}
                        </small>
                    )}
                </div>

                {/* Specialty */}
                <div className="form-group">
                    <label htmlFor="specialty_requested">{t('referrals.form.specialty_label')} <span className="required">*</span></label>
                    <select
                        id="specialty_requested"
                        className="select-input"
                        value={watch('specialty_requested') ?? ''}
                        onChange={handleSpecialtyChange}
                    >
                        <option value="">{t('referrals.form.select_specialty')}</option>
                        {SPECIALTY_VALUES.map(v => (
                            <option key={v} value={v}>{t(`specialties.${v}`, SPECIALTY_LABELS[v] ?? v)}</option>
                        ))}
                    </select>
                    {specialtyAutoFilled && (
                        <small className="form-hint">{t('referrals.form.specialty_autofilled')}</small>
                    )}
                    {errors.specialty_requested && <span className="field-error">{errors.specialty_requested.message}</span>}
                </div>

                {/* Reason */}
                <div className="form-group">
                    <label htmlFor="reason_for_referral">{t('referrals.form.reason_label')}</label>
                    <textarea id="reason_for_referral" className="textarea" rows={4} {...register('reason_for_referral')} />
                    {errors.reason_for_referral && <span className="field-error">{errors.reason_for_referral.message}</span>}
                </div>

                {/* Comments */}
                <div className="form-group">
                    <label htmlFor="comments">{t('referrals.form.comments_label')}</label>
                    <textarea id="comments" className="textarea" rows={3} {...register('comments')} />
                </div>

                {/* Attachment */}
                <div className="form-group">
                    <label htmlFor="attached_documents">
                        {t('referrals.form.attachment_label', 'Attachment')}{' '}
                        <span className="form-hint" style={{ display: 'inline' }}>{t('common.optional_parenthetical')}</span>
                    </label>
                    <input
                        type="file" id="attached_documents" className="input"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={handleFileChange}
                    />
                    {attachmentFile && <small className="form-hint">{attachmentFile.name}</small>}
                </div>

                {/* Returned banner — show what specialist asked for */}
                {isReturnedEdit && referralToEdit && (referralToEdit as { return_requested_info?: string }).return_requested_info && (
                    <div style={{ background: 'var(--color-warning-bg, #fffbeb)', border: '1px solid var(--color-warning, #f59e0b)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem', color: 'var(--color-warning-text, #b45309)' }}>
                            Specialist requests:
                        </div>
                        <div style={{ fontSize: '0.875rem' }}>
                            {(referralToEdit as { return_requested_info?: string }).return_requested_info}
                        </div>
                    </div>
                )}

            </form>
        </Drawer>
    );
};

export default ReferralForm;
