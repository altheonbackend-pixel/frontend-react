import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../../shared/services/api';
import { toast, parseApiError } from '../../../../shared/components/ui';
import { formatTime } from '../../../../shared/utils/datetime';
import { useDoctorProfile } from '../../hooks/useDoctorProfile';
import { DAY_KEYS, TIMEZONES, SLOT_DURATIONS, type DayOff } from '../../settingsConstants';
import type { DoctorScheduleDay } from '../../../../shared/types';

const now = () => new Date();

export default function ScheduleSection() {
    const { t } = useTranslation();
    const { profile, saveProfile } = useDoctorProfile();

    const [tz, setTz] = useState(profile?.timezone || 'UTC');
    const [tzSaving, setTzSaving] = useState(false);
    const [nowInTz, setNowInTz] = useState('');

    const [schedule, setSchedule] = useState<DoctorScheduleDay[]>([]);
    const [original, setOriginal] = useState<DoctorScheduleDay[]>([]);
    const [savingSchedule, setSavingSchedule] = useState(false);

    const [daysOff, setDaysOff] = useState<DayOff[]>([]);
    const [newDayOff, setNewDayOff] = useState({ date: '', reason: '' });
    const [savingDayOff, setSavingDayOff] = useState(false);
    const [deletingDayOff, setDeletingDayOff] = useState<number | null>(null);

    useEffect(() => { setTz(profile?.timezone || 'UTC'); }, [profile?.timezone]);

    // Live "current time in selected timezone" — ticks every 30s.
    useEffect(() => {
        const update = () => setNowInTz(formatTime(now(), { timeZone: tz }));
        update();
        const id = setInterval(update, 30_000);
        return () => clearInterval(id);
    }, [tz]);

    useEffect(() => {
        api.get<DoctorScheduleDay[]>('/schedule/').then(r => {
            setSchedule(r.data);
            setOriginal(r.data);
        }).catch(() => {});
        api.get<DayOff[]>('/schedule/days-off/').then(r => setDaysOff(r.data)).catch(() => {});
    }, []);

    const dirtyDays = useMemo(() => {
        const map = new Map(original.map(d => [d.day_of_week, d]));
        return schedule.filter(d => {
            const o = map.get(d.day_of_week);
            return o && (
                o.is_available !== d.is_available ||
                o.start_time !== d.start_time ||
                o.end_time !== d.end_time ||
                o.slot_duration !== d.slot_duration
            );
        });
    }, [schedule, original]);

    const change = (day: number, field: keyof DoctorScheduleDay, value: string | boolean | number) => {
        setSchedule(prev => prev.map(d => d.day_of_week === day ? { ...d, [field]: value } : d));
    };

    const handleTzChange = async (value: string) => {
        setTz(value);
        setTzSaving(true);
        try {
            await saveProfile({ timezone: value });
            toast.success(t('settings.schedule.timezone_saved'));
        } catch (err) {
            toast.error(parseApiError(err, t('settings.schedule.timezone_error')));
        } finally {
            setTzSaving(false);
        }
    };

    const handleSaveSchedule = async () => {
        if (dirtyDays.length === 0) return;
        setSavingSchedule(true);
        try {
            await Promise.all(dirtyDays.map(d => api.patch(`/schedule/${d.day_of_week}/`, {
                is_available: d.is_available,
                start_time: d.start_time,
                end_time: d.end_time,
                slot_duration: d.slot_duration,
            })));
            setOriginal(schedule);
            toast.success(t('settings.schedule.saved'));
        } catch (err) {
            toast.error(parseApiError(err, t('edit_profile.error.save_schedule')));
        } finally {
            setSavingSchedule(false);
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* ── Timezone ── */}
            <div className="settings-card">
                <div className="settings-card-head">
                    <h2 className="settings-card-title">{t('settings.schedule.timezone_title')}</h2>
                    <p className="settings-card-subtitle">{t('settings.schedule.timezone_subtitle')}</p>
                </div>
                <div className="settings-card-body">
                    <div className="form-group" style={{ marginBottom: 0, maxWidth: 380 }}>
                        <label htmlFor="timezone">{t('register.timezone')}</label>
                        <select
                            id="timezone"
                            className="select-input"
                            value={tz}
                            disabled={tzSaving}
                            onChange={e => handleTzChange(e.target.value)}
                        >
                            {TIMEZONES.map(z => (
                                <option key={z.value} value={z.value}>{t(z.labelKey)}</option>
                            ))}
                        </select>
                        {nowInTz && (
                            <span className="tz-now-pill">
                                {t('edit_profile.current_time_in', { timezone: tz })}: <strong>{nowInTz}</strong>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Weekly working hours ── */}
            <div className="settings-card">
                <div className="settings-card-head">
                    <h2 className="settings-card-title">{t('settings.schedule.hours_title')}</h2>
                    <p className="settings-card-subtitle">{t('settings.schedule.hours_subtitle')}</p>
                </div>
                <div className="settings-card-body">
                    {/* At-a-glance weekly summary */}
                    <div className="schedule-summary" aria-hidden="true">
                        {schedule.map(d => (
                            <div key={d.day_of_week} className={`schedule-chip${d.is_available ? ' on' : ''}`}>
                                <span className="schedule-chip-day">{t(`datetime.weekday.${DAY_KEYS[d.day_of_week]}`).slice(0, 3)}</span>
                                <span className="schedule-chip-time">
                                    {d.is_available ? `${d.start_time.slice(0, 5)}–${d.end_time.slice(0, 5)}` : t('settings.schedule.off')}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="schedule-grid">
                        {schedule.map(day => {
                            const isDirty = dirtyDays.some(d => d.day_of_week === day.day_of_week);
                            return (
                                <div
                                    key={day.day_of_week}
                                    className={`schedule-day-card${day.is_available ? '' : ' is-off'}${isDirty ? ' is-dirty' : ''}`}
                                >
                                    <label className="schedule-day-name">
                                        <input
                                            type="checkbox"
                                            checked={day.is_available}
                                            onChange={e => change(day.day_of_week, 'is_available', e.target.checked)}
                                        />
                                        {t(`datetime.weekday.${DAY_KEYS[day.day_of_week]}`)}
                                    </label>

                                    {day.is_available ? (
                                        <div className="schedule-day-hours">
                                            <input
                                                type="time"
                                                className="schedule-time-input"
                                                value={day.start_time.slice(0, 5)}
                                                onChange={e => change(day.day_of_week, 'start_time', e.target.value + ':00')}
                                                aria-label={t('settings.schedule.start_time')}
                                            />
                                            <span className="schedule-sep">{t('edit_profile.to')}</span>
                                            <input
                                                type="time"
                                                className="schedule-time-input"
                                                value={day.end_time.slice(0, 5)}
                                                onChange={e => change(day.day_of_week, 'end_time', e.target.value + ':00')}
                                                aria-label={t('settings.schedule.end_time')}
                                            />
                                            <select
                                                className="schedule-slot-select"
                                                value={day.slot_duration}
                                                onChange={e => change(day.day_of_week, 'slot_duration', Number(e.target.value))}
                                                aria-label={t('edit_profile.slot_duration')}
                                            >
                                                {SLOT_DURATIONS.map(m => (
                                                    <option key={m} value={m}>{t('settings.schedule.minutes', { count: m })}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <span className="schedule-off-label">{t('settings.schedule.day_off_label')}</span>
                                    )}
                                    <span />
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="settings-card-footer">
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={dirtyDays.length === 0 || savingSchedule}
                        onClick={handleSaveSchedule}
                    >
                        {savingSchedule
                            ? t('common.saving')
                            : dirtyDays.length > 0
                                ? t('settings.schedule.save_count', { count: dirtyDays.length })
                                : t('settings.schedule.save')}
                    </button>
                </div>
            </div>

            {/* ── Days off ── */}
            <div className="settings-card">
                <div className="settings-card-head">
                    <h2 className="settings-card-title">{t('edit_profile.days_off')}</h2>
                    <p className="settings-card-subtitle">{t('edit_profile.days_off_hint')}</p>
                </div>
                <div className="settings-card-body">
                    {daysOff.length > 0 && (
                        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {daysOff.map(d => (
                                <div key={d.id} className="dayoff-row">
                                    <span className="dayoff-date">{d.date}</span>
                                    <span className="dayoff-reason">{d.reason || '—'}</span>
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
                        >
                            {savingDayOff ? t('edit_profile.adding') : t('edit_profile.add_day_off')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
