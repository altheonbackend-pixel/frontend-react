import { useState, useEffect, useRef } from 'react';
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
    const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            external_hospital: '',
            specialty_requested: '',
            urgency: 'routine',
            reason_for_referral: '',
            comments: '',
        },
    });

    const isExternal = watch('is_external');

    const fetchDoctors = async (specialty?: string) => {
        if (!isAuthenticated) return;
        try {
            const params: Record<string, string> = {};
            if (specialty) params.specialty = specialty;
            const response = await api.get('/doctors/', { params });
            setDoctors(response.data.results ?? response.data);
        } catch {
            toast.error(t('referrals.form.error.load_doctors'));
        }
    };

    useEffect(() => {
        fetchDoctors();
        return () => {
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSpecialtyFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSpecialtyFilter(val);
        setValue('referred_to', null);
        if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        filterTimerRef.current = setTimeout(() => fetchDoctors(val || undefined), 300);
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
                specialty_requested: referralToEdit.specialty_requested || '',
                urgency: 'routine',
                reason_for_referral: referralToEdit.reason_for_referral || '',
                comments: referralToEdit.comments || '',
                external_doctor_name: '',
                external_hospital: '',
            });
        } else {
            reset({
                is_external: false,
                referred_to: null,
                external_doctor_name: '',
                external_hospital: '',
                specialty_requested: '',
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
            const payload = { ...data, patient: patientId };
            if (referralToEdit?.id) {
                await api.put(`/referrals/${referralToEdit.id}/`, payload);
                toast.success(t('referrals.form.submit_edit'));
            } else {
                await api.post('/referrals/', payload);
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
                        <div className="form-group">
                            <label htmlFor="specialty_filter">Filter by Specialty</label>
                            <input
                                type="text"
                                id="specialty_filter"
                                className="input"
                                placeholder="e.g. cardiology, neurology..."
                                value={specialtyFilter}
                                onChange={handleSpecialtyFilter}
                            />
                            {specialtyFilter && <small className="form-hint">{doctors.length} doctor(s) found</small>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="referred_to">{t('referrals.form.doctor_label')}</label>
                            <select id="referred_to" className="select-input" {...register('referred_to')}>
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
                    <label htmlFor="specialty_requested">{t('referrals.form.specialty_label')}</label>
                    <input
                        type="text"
                        id="specialty_requested"
                        className="input"
                        {...register('specialty_requested')}
                    />
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
            </form>
        </Drawer>
    );
};

export default ReferralForm;
