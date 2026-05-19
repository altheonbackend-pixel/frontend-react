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
import { formatTime } from '../../../shared/utils/datetime';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const TIMEZONES = [
    { value: 'UTC',                  labelKey: 'patient_portal.timezones.utc' },
    { value: 'Africa/Dakar',         labelKey: 'timezones.africa_dakar' },
    { value: 'Asia/Karachi',         labelKey: 'patient_portal.timezones.asia_karachi' },
    { value: 'Asia/Kolkata',         labelKey: 'patient_portal.timezones.asia_kolkata' },
    { value: 'Asia/Dhaka',           labelKey: 'patient_portal.timezones.asia_dhaka' },
    { value: 'Asia/Dubai',           labelKey: 'patient_portal.timezones.asia_dubai' },
    { value: 'Asia/Riyadh',          labelKey: 'patient_portal.timezones.asia_riyadh' },
    { value: 'Asia/Baghdad',         labelKey: 'patient_portal.timezones.asia_baghdad' },
    { value: 'Asia/Istanbul',        labelKey: 'patient_portal.timezones.asia_istanbul' },
    { value: 'Europe/London',        labelKey: 'patient_portal.timezones.europe_london' },
    { value: 'Europe/Paris',         labelKey: 'patient_portal.timezones.europe_paris' },
    { value: 'Europe/Berlin',        labelKey: 'patient_portal.timezones.europe_berlin' },
    { value: 'Africa/Cairo',         labelKey: 'patient_portal.timezones.africa_cairo' },
    { value: 'Africa/Lagos',         labelKey: 'patient_portal.timezones.africa_lagos' },
    { value: 'Africa/Nairobi',       labelKey: 'patient_portal.timezones.africa_nairobi' },
    { value: 'America/New_York',     labelKey: 'patient_portal.timezones.america_new_york' },
    { value: 'America/Chicago',      labelKey: 'patient_portal.timezones.america_chicago' },
    { value: 'America/Los_Angeles',  labelKey: 'patient_portal.timezones.america_los_angeles' },
    { value: 'Australia/Sydney',     labelKey: 'patient_portal.timezones.australia_sydney' },
];

function getCurrentTimeInTz(tz: string) {
    return formatTime(new Date(), { timeZone: tz });
}

interface DayOff { id: number; date: string; reason: string }

const EditProfile = () => {
    const { t } = useTranslation();
    const { profile, updateProfileData, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [schedule, setSchedule] = useState<DoctorScheduleDay[]>([]);
    const [savingDay, setSavingDay] = useState<number | null>(null);
    const [daysOff, setDaysOff] = useState<DayOff[]>([]);
    const [newDayOff, setNewDayOff] = useState({ date: '', reason: '' });
    const [savingDayOff, setSavingDayOff] = useState(false);
    const [deletingDayOff, setDeletingDayOff] = useState<number | null>(null);

    const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
    const [pwSaving, setPwSaving] = useState(false);
    const [pwError, setPwError] = useState('');

    const [selectedTz, setSelectedTz] = useState('UTC');
    const [nowInTz, setNowInTz] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isDirty, isSubmitting },
    } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            first_name: '', last_name: '', email: '', specialty: '',
            license_number: '', phone_number: '', address: '', next_available: '', timezone: 'UTC',
        },
    });

    const watchedTz = watch('timezone');

    useEffect(() => {
        setSelectedTz(watchedTz || 'UTC');
        setNowInTz(getCurrentTimeInTz(watchedTz || 'UTC'));
    }, [watchedTz]);

    useEffect(() => {
        api.get<DoctorScheduleDay[]>('/schedule/').then(r => setSchedule(r.data)).catch(() => {});
        api.get<DayOff[]>('/schedule/days-off/').then(r => setDaysOff(r.data)).catch(() => {});
    }, []);

    const handleScheduleChange = (dayOfWeek: number, field: keyof DoctorScheduleDay, value: string | boolean | number) => {
        setSchedule(prev => prev.map(d => d.day_of_week === dayOfWeek ? { ...d, [field]: value } : d));
    };

    const handleSaveDay = async (day: DoctorScheduleDay) => {
        setSavingDay(day.day_of_week);
        try {
            await api.patch(`/schedule/${day.day_of_week}/`, {
                is_available: day.is_available,
                start_time: day.start_time,
                end_time: day.end_time,
                slot_duration: day.slot_duration,
            });
            toast.success(t('edit_profile.toast.schedule_saved', { day: t(`datetime.weekday.${DAY_KEYS[day.day_of_week]}`) }));
        } catch (err) {
            toast.error(parseApiError(err, t('edit_profile.error.save_schedule')));
        } finally {
            setSavingDay(null);
        }
    };

    const handleAddDayOff = async () => {
        if (!newDayOff.date) { toast.error(t('edit_profile.error.select_date')); return; }
        setSavingDayOff(true);
        try {
            const res = await api.post<DayOff>('/schedule/days-off/', newDayOff);
            setDaysOff(prev => [...prev, res.data].sort((a, b) => a.date.localeCompare(b.date)));
            setNewDayOff({ date: '', reason: '' });
            toast.success(t('edit_profile.toast.day_off_added'));
        } catch (err) {
            toast.error(parseApiError(err, t('edit_profile.error.add_day_off')));
        } finally {
            setSavingDayOff(false);
        }
    };

    const handleDeleteDayOff = async (id: number) => {
        setDeletingDayOff(id);
        try {
            await api.delete(`/schedule/days-off/${id}/`);
            setDaysOff(prev => prev.filter(d => d.id !== id));
            toast.success(t('edit_profile.toast.day_off_removed'));
        } catch (err) {
            toast.error(parseApiError(err, t('edit_profile.error.remove_day_off')));
        } finally {
            setDeletingDayOff(null);
        }
    };

    const handlePasswordChange = async () => {
        setPwError('');
        if (pwForm.new_password !== pwForm.confirm_password) {
            setPwError(t('profile.password.error.mismatch'));
            return;
        }
        if (pwForm.new_password.length < 8) {
            setPwError(t('profile.password.error.too_short'));
            return;
        }
        setPwSaving(true);
        try {
            await api.post('/change-password/', {
                current_password: pwForm.current_password,
                new_password: pwForm.new_password,
                confirm_password: pwForm.confirm_password,
            });
            toast.success(t('profile.password.success'));
            setPwForm({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
            setPwError(parseApiError(err, t('profile.password.error.failed')));
        } finally {
            setPwSaving(false);
        }
    };

    useEffect(() => {
        if (!isAuthenticated) { toast.error(t('edit_profile.error.auth')); return; }
        if (profile) {
            const nameParts = profile.full_name.split(' ');
            const firstName = nameParts.shift() || '';
            const lastName = nameParts.join(' ');
            const tz = (profile as any).timezone || 'UTC';
            reset({
                first_name: firstName, last_name: lastName, email: profile.email,
                specialty: profile.specialty || '', license_number: profile.license_number || '',
                phone_number: profile.phone_number || '', address: profile.address || '',
                next_available: profile.next_available ? profile.next_available.slice(0, 16) : '',
                timezone: tz,
            });
            setSelectedTz(tz);
            setNowInTz(getCurrentTimeInTz(tz));
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

    const sectionStyle: React.CSSProperties = { marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' };
    const sectionTitle: React.CSSProperties = { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' };

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
            {/* ── Personal Information ── */}
            <form id="edit-profile-form" onSubmit={handleSubmit(onSubmit)} className="form">
                <p style={sectionTitle}>{t('profile.section.personal_information')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                    <div className="form-group">
                        <label htmlFor="first_name">{t('edit_profile.labels.first_name')}</label>
                        <input type="text" id="first_name" className="input" {...register('first_name')} />
                        {errors.first_name && <span className="field-error">{errors.first_name.message}</span>}
                    </div>
                    <div className="form-group">
                        <label htmlFor="last_name">{t('edit_profile.labels.last_name')}</label>
                        <input type="text" id="last_name" className="input" {...register('last_name')} />
                        {errors.last_name && <span className="field-error">{errors.last_name.message}</span>}
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="email">{t('edit_profile.labels.email')}</label>
                    <input type="email" id="email" className="input" {...register('email')} />
                    {errors.email && <span className="field-error">{errors.email.message}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                    <div className="form-group">
                        <label htmlFor="specialty">{t('edit_profile.labels.specialty')}</label>
                        <input type="text" id="specialty" className="input" {...register('specialty')} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="license_number">{t('edit_profile.labels.license')}</label>
                        <input type="text" id="license_number" className="input" {...register('license_number')} />
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="phone_number">{t('edit_profile.labels.phone')}</label>
                    <input type="text" id="phone_number" className="input" {...register('phone_number')} />
                    {errors.phone_number && <span className="field-error">{errors.phone_number.message}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="address">{t('edit_profile.labels.address')}</label>
                    <textarea id="address" className="textarea" rows={2} {...register('address')} />
                    {errors.address && <span className="field-error">{errors.address.message}</span>}
                </div>

                {/* ── Availability & Timezone ── */}
                <div style={sectionStyle}>
                    <p style={sectionTitle}>{t('profile.section.availability_timezone')}</p>
                    <div className="form-group">
                        <label htmlFor="timezone">{t('register.timezone')}</label>
                        <select id="timezone" className="select-input" {...register('timezone')}>
                            {TIMEZONES.map(tz => (
                                <option key={tz.value} value={tz.value}>{t(tz.labelKey)}</option>
                            ))}
                        </select>
                        {nowInTz && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {t('edit_profile.current_time_in', { timezone: selectedTz })}: <strong>{nowInTz}</strong>
                            </span>
                        )}
                    </div>
                    <div className="form-group">
                        <label htmlFor="next_available">{t('edit_profile.next_available_slot')}</label>
                        <input type="datetime-local" id="next_available" className="input" {...register('next_available')} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('edit_profile.next_available_hint')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                        <input type="checkbox" id="accepting_referrals" {...register('accepting_referrals' as any)} style={{ cursor: 'pointer' }} />
                        <label htmlFor="accepting_referrals" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>
                            {t('edit_profile.accepting_referrals')}
                            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                {t('edit_profile.accepting_referrals_hint')}
                            </span>
                        </label>
                    </div>
                </div>
            </form>

            {/* ── Working Hours ── */}
            {schedule.length > 0 && (
                <section style={sectionStyle}>
                    <p style={sectionTitle}>{t('edit_profile.working_hours', 'Working Hours')}</p>
                    <div className="schedule-list">
                        {schedule.map(day => (
                            <div key={day.day_of_week} className="schedule-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                                <span className="schedule-day" style={{ minWidth: '90px' }}>{t(`datetime.weekday.${DAY_KEYS[day.day_of_week]}`)}</span>
                                <label className="schedule-available-label" style={{ flexShrink: 0 }}>
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
                                <select
                                    className="select-input"
                                    style={{ width: 'auto', minWidth: '90px', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                                    value={day.slot_duration}
                                    disabled={!day.is_available}
                                    onChange={e => handleScheduleChange(day.day_of_week, 'slot_duration', Number(e.target.value))}
                                    title={t('edit_profile.slot_duration')}
                                >
                                    <option value={10}>10 min</option>
                                    <option value={15}>15 min</option>
                                    <option value={20}>20 min</option>
                                    <option value={30}>30 min</option>
                                </select>
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

            {/* ── Days Off ── */}
            <section style={sectionStyle}>
                <p style={sectionTitle}>{t('edit_profile.days_off')}</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {t('edit_profile.days_off_hint')}
                </p>
                {daysOff.length > 0 && (
                    <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {daysOff.map(d => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.35rem 0.5rem', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.875rem', minWidth: '90px' }}>{d.date}</span>
                                <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{d.reason || '—'}</span>
                                <button
                                    type="button"
                                    className="btn-danger-outline btn-sm"
                                    disabled={deletingDayOff === d.id}
                                    onClick={() => handleDeleteDayOff(d.id)}
                                >
                                    {t('common.remove')}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0, flex: '0 0 auto' }}>
                        <label style={{ fontSize: '0.8rem' }}>{t('consultation.date')}</label>
                        <input
                            type="date"
                            className="input"
                            style={{ width: 'auto' }}
                            min={new Date().toISOString().slice(0, 10)}
                            value={newDayOff.date}
                            onChange={e => setNewDayOff(p => ({ ...p, date: e.target.value }))}
                        />
                    </div>
                    <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '140px' }}>
                        <label style={{ fontSize: '0.8rem' }}>{t('edit_profile.reason_optional')}</label>
                        <input
                            type="text"
                            className="input"
                            placeholder={t('edit_profile.reason_placeholder')}
                            value={newDayOff.reason}
                            onChange={e => setNewDayOff(p => ({ ...p, reason: e.target.value }))}
                        />
                    </div>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!newDayOff.date || savingDayOff}
                        onClick={handleAddDayOff}
                        style={{ marginBottom: '0' }}
                    >
                        {savingDayOff ? t('edit_profile.adding') : t('edit_profile.add_day_off')}
                    </button>
                </div>
            </section>

            {/* ── Change Password ── */}
            <section style={sectionStyle}>
                <p style={sectionTitle}>{t('profile.password.change')}</p>
                <div className="form-group">
                    <label>{t('profile.password.current')}</label>
                    <input
                        type="password"
                        className="input"
                        value={pwForm.current_password}
                        onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))}
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                    <div className="form-group">
                        <label>{t('profile.password.new')}</label>
                        <input
                            type="password"
                            className="input"
                            value={pwForm.new_password}
                            onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))}
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('profile.password.confirm_new')}</label>
                        <input
                            type="password"
                            className="input"
                            value={pwForm.confirm_password}
                            onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}
                        />
                    </div>
                </div>
                {pwError && <p style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{pwError}</p>}
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!pwForm.current_password || !pwForm.new_password || pwSaving}
                    onClick={handlePasswordChange}
                >
                    {pwSaving ? t('common.saving') : t('profile.password.update')}
                </button>
            </section>
        </Modal>
    );
};

export default EditProfile;
