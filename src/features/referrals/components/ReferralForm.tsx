import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { type DoctorProfile } from '../../../shared/types';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';

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

const ReferralForm: React.FC<ReferralFormProps> = ({ patientId, onSuccess, onClose, referralToEdit }) => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [specialtyFilter, setSpecialtyFilter] = useState('');
    const [formData, setFormData] = useState({
        referred_to: '',
        specialty_requested: '',
        reason_for_referral: '',
        comments: '',
    });
    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchDoctors = async (specialty?: string) => {
        if (!token) return;
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
        setFormData(prev => ({ ...prev, referred_to: '' }));
        if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        filterTimerRef.current = setTimeout(() => fetchDoctors(val || undefined), 300);
    };

    useEffect(() => {
        if (referralToEdit) {
            const ref = referralToEdit.referred_to;
            const refStr = typeof ref === 'object' && ref !== null
                ? String(ref.id)
                : ref != null ? String(ref) : '';
            setFormData({
                referred_to: refStr,
                specialty_requested: referralToEdit.specialty_requested || '',
                reason_for_referral: referralToEdit.reason_for_referral || '',
                comments: referralToEdit.comments || '',
            });
        } else {
            setFormData({
                referred_to: '',
                specialty_requested: '',
                reason_for_referral: '',
                comments: '',
            });
        }
    }, [referralToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setDirty(true);
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!token) {
            toast.error(t('referrals.form.error.auth'));
            setLoading(false);
            return;
        }

        if (!formData.referred_to) {
            toast.error(t('referrals.form.error.select_doctor'));
            setLoading(false);
            return;
        }

        const referredToId = parseInt(formData.referred_to, 10);
        if (isNaN(referredToId)) {
            toast.error(t('referrals.form.error.invalid_id'));
            setLoading(false);
            return;
        }

        const payload = {
            ...formData,
            patient: patientId,
            referred_to: referredToId,
        };

        try {
            if (referralToEdit && referralToEdit.id) {
                await api.put(`/referrals/${referralToEdit.id}/`, payload);
                toast.success(t('referrals.form.submit_edit'));
            } else {
                await api.post(`/referrals/`, payload);
                toast.success(t('referrals.form.submit_add'));
            }
            setDirty(false);
            onSuccess();
        } catch (err) {
            toast.error(parseApiError(err, t('referrals.form.error.save')));
        } finally {
            setLoading(false);
        }
    };

    const isEditing = !!referralToEdit;

    return (
        <Drawer
            open
            onClose={onClose}
            title={isEditing ? t('referrals.form.title_edit') : t('referrals.form.title_add')}
            size="md"
            dirty={dirty}
            footer={
                <>
                    <button type="button" onClick={onClose} className="cancel-button" disabled={loading}>{t('referrals.form.cancel')}</button>
                    <button type="submit" form="referral-form" className="submit-button" disabled={loading}>
                        {loading ? t('referrals.form.loading') : (isEditing ? t('referrals.form.submit_edit') : t('referrals.form.submit_add'))}
                    </button>
                </>
            }
        >
                <form id="referral-form" onSubmit={handleSubmit}>
                    {/* Specialty filter to narrow doctor list */}
                    <div className="form-group">
                        <label htmlFor="specialty_filter">Filter by Specialty</label>
                        <input
                            type="text"
                            id="specialty_filter"
                            placeholder="e.g. cardiology, neurology..."
                            value={specialtyFilter}
                            onChange={handleSpecialtyFilter}
                        />
                        {specialtyFilter && <small className="form-hint">{doctors.length} doctor(s) found</small>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="referred_to">{t('referrals.form.doctor_label')}</label>
                        <select
                            id="referred_to"
                            name="referred_to"
                            value={formData.referred_to}
                            onChange={handleChange}
                            required
                        >
                            <option value="">{t('referrals.form.select_doctor')}</option>
                            {doctors.map(doctor => (
                                <option key={doctor.id} value={doctor.id}>
                                    Dr. {doctor.full_name} - {doctor.specialty || 'General'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="specialty_requested">{t('referrals.form.specialty_label')}</label>
                        <input
                            type="text"
                            id="specialty_requested"
                            name="specialty_requested"
                            value={formData.specialty_requested}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reason_for_referral">{t('referrals.form.reason_label')}</label>
                        <textarea
                            id="reason_for_referral"
                            name="reason_for_referral"
                            value={formData.reason_for_referral}
                            onChange={handleChange}
                            rows={4}
                            required
                        ></textarea>
                    </div>
                    <div className="form-group">
                        <label htmlFor="comments">{t('referrals.form.comments_label')}</label>
                        <textarea
                            id="comments"
                            name="comments"
                            value={formData.comments}
                            onChange={handleChange}
                            rows={4}
                        ></textarea>
                    </div>
                </form>
        </Drawer>
    );
};

export default ReferralForm;