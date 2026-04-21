import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../auth/hooks/useAuth';
import { type DoctorProfile, type DoctorScheduleDay } from '../../../shared/types';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';
import { profileSchema, type ProfileFormData } from '../profileSchema';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EditProfile = () => {
    const { t } = useTranslation();
    const { profile, updateProfileData, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [schedule, setSchedule] = useState<DoctorScheduleDay[]>([]);
    const [savingDay, setSavingDay] = useState<number | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            first_name: '',
            last_name: '',
            email: '',
            specialty: '',
            license_number: '',
            phone_number: '',
            address: '',
            next_available: '',
            timezone: 'UTC',
        },
    });

    useEffect(() => {
        api.get<DoctorScheduleDay[]>('/schedule/').then(r => setSchedule(r.data)).catch(() => {});
    }, []);

    const handleScheduleChange = (dayOfWeek: number, field: keyof DoctorScheduleDay, value: string | boolean) => {
        setSchedule(prev => prev.map(d => d.day_of_week === dayOfWeek ? { ...d, [field]: value } : d));
    };

    const handleSaveDay = async (day: DoctorScheduleDay) => {
        setSavingDay(day.day_of_week);
        try {
            await api.patch(`/schedule/${day.day_of_week}/`, {
                is_available: day.is_available,
                start_time: day.start_time,
                end_time: day.end_time,
            });
            toast.success(`${DAY_NAMES[day.day_of_week]} schedule saved.`);
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to save schedule.'));
        } finally {
            setSavingDay(null);
        }
    };

    useEffect(() => {
        if (!isAuthenticated) {
            toast.error(t('edit_profile.error.auth'));
            return;
        }
        if (profile) {
            const nameParts = profile.full_name.split(' ');
            const firstName = nameParts.shift() || '';
            const lastName = nameParts.join(' ');
            reset({
                first_name: firstName,
                last_name: lastName,
                email: profile.email,
                specialty: profile.specialty || '',
                license_number: profile.license_number || '',
                phone_number: profile.phone_number || '',
                address: profile.address || '',
                next_available: profile.next_available ? profile.next_available.slice(0, 16) : '',
                timezone: (profile as any).timezone || 'UTC',
            });
        }
    }, [profile, isAuthenticated, reset, t]);

    const handleClose = () => navigate('/profile');

    const onSubmit = async (data: ProfileFormData) => {
        try {
            const response = await api.patch('/profile/update/', data);
            const updatedProfile: DoctorProfile = {
                id: response.data.id,
                full_name: `${response.data.first_name} ${response.data.last_name}`,
                email: response.data.email,
                specialty: response.data.specialty,
                license_number: response.data.license_number,
                phone_number: response.data.phone_number,
                address: response.data.address,
                access_level: response.data.access_level || 1,
                next_available: response.data.next_available ?? null,
            };
            updateProfileData(updatedProfile);
            toast.success(t('edit_profile.success', { defaultValue: 'Profile updated.' }));
            navigate('/profile');
        } catch (err) {
            toast.error(parseApiError(err, t('edit_profile.error.save')));
        }
    };

    if (!profile) {
        return (
            <Modal open onClose={handleClose} title={t('edit_profile.title')} size="lg">
                <div>{t('edit_profile.error.load')}</div>
            </Modal>
        );
    }

    return (
        <Modal
            open
            onClose={handleClose}
            title={t('edit_profile.title')}
            size="lg"
            dirty={isDirty}
            footer={
                <>
                    <button type="button" onClick={handleClose} className="cancel-button" disabled={isSubmitting}>
                        {t('edit_profile.cancel')}
                    </button>
                    <button type="submit" form="edit-profile-form" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? t('edit_profile.saving') : t('edit_profile.save')}
                    </button>
                </>
            }
        >
            <form id="edit-profile-form" onSubmit={handleSubmit(onSubmit)} className="form">
                <div className="form-group">
                    <label htmlFor="first_name">{t('edit_profile.labels.first_name')}</label>
                    <input type="text" id="first_name" {...register('first_name')} />
                    {errors.first_name && <span className="field-error">{errors.first_name.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="last_name">{t('edit_profile.labels.last_name')}</label>
                    <input type="text" id="last_name" {...register('last_name')} />
                    {errors.last_name && <span className="field-error">{errors.last_name.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="email">{t('edit_profile.labels.email')}</label>
                    <input type="email" id="email" {...register('email')} />
                    {errors.email && <span className="field-error">{errors.email.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="specialty">{t('edit_profile.labels.specialty')}</label>
                    <input type="text" id="specialty" {...register('specialty')} />
                </div>
                <div className="form-group">
                    <label htmlFor="license_number">{t('edit_profile.labels.license')}</label>
                    <input type="text" id="license_number" {...register('license_number')} />
                </div>
                <div className="form-group">
                    <label htmlFor="phone_number">{t('edit_profile.labels.phone')}</label>
                    <input type="text" id="phone_number" {...register('phone_number')} />
                    {errors.phone_number && <span className="field-error">{errors.phone_number.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="address">{t('edit_profile.labels.address')}</label>
                    <textarea id="address" {...register('address')} />
                    {errors.address && <span className="field-error">{errors.address.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="next_available">Next available slot</label>
                    <input type="datetime-local" id="next_available" {...register('next_available')} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Shown to patients as a scheduling hint when they request appointments.</span>
                </div>
                <div className="form-group">
                    <label htmlFor="timezone">Timezone</label>
                    <select id="timezone" {...register('timezone')}>
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                        <option value="Asia/Karachi">Pakistan (UTC+5)</option>
                        <option value="Asia/Kolkata">India (UTC+5:30)</option>
                        <option value="Asia/Dhaka">Bangladesh (UTC+6)</option>
                        <option value="Asia/Dubai">UAE (UTC+4)</option>
                        <option value="Asia/Riyadh">Saudi Arabia (UTC+3)</option>
                        <option value="Asia/Baghdad">Iraq (UTC+3)</option>
                        <option value="Asia/Istanbul">Turkey (UTC+3)</option>
                        <option value="Europe/London">United Kingdom (UTC+0/+1)</option>
                        <option value="Europe/Paris">France / Central Europe (UTC+1/+2)</option>
                        <option value="Europe/Berlin">Germany (UTC+1/+2)</option>
                        <option value="Africa/Cairo">Egypt (UTC+2)</option>
                        <option value="Africa/Lagos">Nigeria (UTC+1)</option>
                        <option value="Africa/Nairobi">Kenya / East Africa (UTC+3)</option>
                        <option value="America/New_York">US Eastern (UTC-5/-4)</option>
                        <option value="America/Chicago">US Central (UTC-6/-5)</option>
                        <option value="America/Los_Angeles">US Pacific (UTC-8/-7)</option>
                        <option value="Australia/Sydney">Australia Eastern (UTC+10/+11)</option>
                    </select>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sets the timezone for your working hours schedule. Patient appointment slots are shown in their local time.</span>
                </div>
            </form>

            {schedule.length > 0 && (
                <section className="schedule-section">
                    <h3 className="schedule-heading">{t('edit_profile.working_hours', 'Working Hours')}</h3>
                    <div className="schedule-list">
                        {schedule.map(day => (
                            <div key={day.day_of_week} className="schedule-row">
                                <span className="schedule-day">{DAY_NAMES[day.day_of_week]}</span>
                                <label className="schedule-available-label">
                                    <input
                                        type="checkbox"
                                        checked={day.is_available}
                                        onChange={e => handleScheduleChange(day.day_of_week, 'is_available', e.target.checked)}
                                    />
                                    {t('edit_profile.available', 'Available')}
                                </label>
                                <input
                                    type="time"
                                    className="schedule-time-input"
                                    value={day.start_time.slice(0, 5)}
                                    disabled={!day.is_available}
                                    onChange={e => handleScheduleChange(day.day_of_week, 'start_time', e.target.value + ':00')}
                                />
                                <span className="schedule-to">{t('edit_profile.to', 'to')}</span>
                                <input
                                    type="time"
                                    className="schedule-time-input"
                                    value={day.end_time.slice(0, 5)}
                                    disabled={!day.is_available}
                                    onChange={e => handleScheduleChange(day.day_of_week, 'end_time', e.target.value + ':00')}
                                />
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleSaveDay(day)}
                                    disabled={savingDay === day.day_of_week}
                                >
                                    {savingDay === day.day_of_week ? t('edit_profile.saving', 'Saving…') : t('edit_profile.save_day', 'Save')}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </Modal>
    );
};

export default EditProfile;
