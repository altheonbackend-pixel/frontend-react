// src/features/appointments/components/Appointments.tsx
// Phase 8: Calendar + appointment list side-by-side on desktop

import { useState, useEffect, useRef, useCallback } from 'react';
import Calendar from 'react-calendar';
import { useTranslation } from 'react-i18next';
import 'react-calendar/dist/Calendar.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Appointment, type Patient } from '../../../shared/types';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';
import AppointmentForm from './AppointmentForm';
import DeleteAppointmentModal from './DeleteAppointmentModal';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../../../shared/services/api';
import { Dialog, Modal, toast, parseApiError } from '../../../shared/components/ui';
import { queryKeys } from '../../../shared/queryKeys';
import { PageHeader } from '../../../shared/components/PageHeader';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { TelehealthJoinButton } from './TelehealthJoinButton';
import { Avatar } from '../../../shared/components/Avatar';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import '../styles/Appointments.css';
import '../styles/AppointmentForm.css';

// Start consultation only from confirmed — scheduled needs explicit confirm first
const TERMINAL_STATUSES = ['cancelled', 'rejected', 'completed', 'no_show', 'rescheduled', 'expired'];
const ACTIVE_STATUSES   = ['scheduled', 'confirmed', 'in_progress'];

interface AppointmentWithDetails extends Appointment {
    patient_details: Patient;
}

function toYYYYMM(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function toYYYYMMDD(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Status → CSS class suffix for left border color + muted for terminal states
function apptStatusClass(status: string) {
    const base = `appt-card appt-card--${status.replace('_', '-')}`;
    if (['cancelled', 'rejected', 'no_show', 'rescheduled', 'expired'].includes(status)) return `${base} appt-card--archived`;
    return base;
}

const Appointments = () => {
    const { t, i18n } = useTranslation();
    usePageTitle(t('pages.appointments', 'Appointments'));
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const { formatDate, formatDateLong, formatDayMonth, formatTime, formatDateTime, toIsoDateInTz } = useFormatDateTime();

    const patientIdParam = searchParams.get('patient_id') ?? undefined;
    const sectionParam = searchParams.get('section');
    const requestsSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (patientIdParam) {
            setSelectedAppointment(null);
            setIsFormVisible(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientIdParam]);

    const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
    const [date, setDate] = useState<Date>(new Date());
    const [currentMonth, setCurrentMonth] = useState<string>(toYYYYMM(new Date()));
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [lifecycleConfirm, setLifecycleConfirm] = useState<{ id: number; action: 'no_show' } | null>(null);
    const [cancelTarget, setCancelTarget] = useState<{ id: number } | null>(null);
    const [rescheduleTarget, setRescheduleTarget] = useState<{ id: number; patientName: string } | null>(null);
    const [rsDate, setRsDate] = useState('');
    const [rsSlots, setRsSlots] = useState<{ time: string; datetime: string; status: string; patient_name?: string }[]>([]);
    const [rsDayOff, setRsDayOff] = useState(false);
    const [rsSlotsLoading, setRsSlotsLoading] = useState(false);
    const [rsSelected, setRsSelected] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [rebookPatientId, setRebookPatientId] = useState<string | undefined>(undefined);
    const [filterFollowUpOnly, setFilterFollowUpOnly] = useState(false);
    const [approveTarget, setApproveTarget] = useState<{ id: number; patientName: string } | null>(null);
    const [rejectTarget, setRejectTarget] = useState<{ id: number; patientName: string } | null>(null);

    const selectedDate = toYYYYMMDD(date);

    interface PendingRequest {
        id: number;
        appointment_date: string;
        reason: string;
        appointment_type?: string;
        patient_id: string;
        patient_name: string;
        notes?: string;
    }

    const { data: pendingRequests = [] } = useQuery<PendingRequest[]>({
        queryKey: ['appointments', 'pending-requests'],
        queryFn: async () => {
            const res = await api.get('/doctor/appointment-requests/');
            return res.data.results ?? res.data;
        },
        staleTime: 30_000,
    });

    useEffect(() => {
        if (sectionParam === 'requests' && pendingRequests.length > 0 && requestsSectionRef.current) {
            setTimeout(() => requestsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
        }
    }, [sectionParam, pendingRequests.length]);

    const handleApprove = async (instructions?: string) => {
        if (!approveTarget) return;
        try {
            await api.post(`/appointments/${approveTarget.id}/approve/`, { portal_instructions: instructions ?? '' });
            toast.success(t('appointments.toast.approved'));
            setApproveTarget(null);
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, t('appointments.toast.approve_failed')));
            throw err;
        }
    };

    const handleReject = async (reason?: string) => {
        if (!rejectTarget) return;
        try {
            await api.post(`/appointments/${rejectTarget.id}/reject/`, { reason: reason ?? '' });
            toast.success(t('appointments.toast.rejected'));
            setRejectTarget(null);
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, t('appointments.toast.reject_failed')));
            throw err;
        }
    };

    const { data: dotDates = [] } = useQuery({
        queryKey: queryKeys.appointments.dots(currentMonth),
        queryFn: async () => {
            const res = await api.get('/appointments/dots/', { params: { month: currentMonth } });
            return res.data as string[];
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: appointments = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.appointments.list(selectedDate),
        queryFn: async () => {
            const res = await api.get('/appointments/', { params: { date: selectedDate } });
            const list: AppointmentWithDetails[] = res.data.results ?? res.data;
            return list.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
        },
        staleTime: 60 * 1000,
    });

    // Week view helpers
    const getWeekStart = (d: Date) => {
        const day = d.getDay(); // 0=Sun
        const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
        const mon = new Date(d);
        mon.setDate(d.getDate() + diff);
        mon.setHours(0, 0, 0, 0);
        return mon;
    };
    const weekStart = getWeekStart(date);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });
    const weekMonthParam = toYYYYMM(weekStart);
    const weekMonthParam2 = toYYYYMM(weekDays[6]); // may span two months

    const { data: weekAppointments = [], isLoading: weekLoading } = useQuery({
        queryKey: ['appointments', 'week', toYYYYMMDD(weekStart)],
        queryFn: async () => {
            const month = weekMonthParam;
            const res = await api.get('/appointments/', { params: { month } });
            const list: AppointmentWithDetails[] = res.data.results ?? res.data;
            // If week spans two months, fetch second month too
            if (weekMonthParam2 !== weekMonthParam) {
                const res2 = await api.get('/appointments/', { params: { month: weekMonthParam2 } });
                const list2: AppointmentWithDetails[] = res2.data.results ?? res2.data;
                return [...list, ...list2].sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
            }
            return list.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
        },
        enabled: viewMode === 'week',
        staleTime: 60 * 1000,
    });

    const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ['appointments'] });

    // Close 3-dot menu on any outside click (document listener — avoids z-index battles with overlay divs)
    useEffect(() => {
        if (openMenuId === null) return;
        const handler = () => setOpenMenuId(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [openMenuId]);

    const fetchRsSlots = useCallback(async (date: string, apptId: number) => {
        if (!date) return;
        setRsSlotsLoading(true);
        setRsSlots([]);
        setRsDayOff(false);
        setRsSelected(null);
        try {
            const res = await api.get<{ slots: { time: string; datetime: string; status: string; patient_name?: string }[]; day_off: boolean }>(
                `/appointments/day-slots/?date=${date}&exclude_id=${apptId}`
            );
            if (res.data.day_off) {
                setRsDayOff(true);
            } else {
                setRsSlots(res.data.slots);
            }
        } catch {
            toast.error(t('appointments.toast.slots_failed'));
        } finally {
            setRsSlotsLoading(false);
        }
    }, [t]);

    const closeReschedule = () => { setRescheduleTarget(null); setRsDate(''); setRsSlots([]); setRsDayOff(false); setRsSelected(null); };

    const executeReschedule = async () => {
        if (!rescheduleTarget || !rsSelected) return;
        try {
            await api.post(`/appointments/${rescheduleTarget.id}/reschedule/`, {
                appointment_date: new Date(rsSelected).toISOString(),
            });
            toast.success(t('appointments.toast.rescheduled'));
            closeReschedule();
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, t('appointments.toast.reschedule_failed')));
        }
    };

    const todayStr = new Date().toISOString().slice(0, 10);

    const handleStartConsultation = async (appt: AppointmentWithDetails) => {
        try {
            const res = await api.post(`/appointments/${appt.id}/start-consultation/`);
            const { consultation_id } = res.data;
            const patientId = appt.patient_details?.unique_id ?? appt.patient;
            const isResume = res.status === 200;
            if (!isResume) toast.success(t('appointments.toast.consultation_started'));
            navigate(`/patients/${patientId}?tab=consultations&open_consultation=${consultation_id}&draft=true`);
        } catch (err) {
            toast.error(parseApiError(err, t('appointments.toast.consultation_start_failed')));
        }
    };

    const executeLifecycleAction = async () => {
        if (!lifecycleConfirm) return;
        try {
            await api.post(`/appointments/${lifecycleConfirm.id}/${lifecycleConfirm.action}/`);
            toast.success(t(`appointments.lifecycle.${lifecycleConfirm.action}_success`, { defaultValue: 'Appointment updated.' }));
            setLifecycleConfirm(null);
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, t('appointments.error.action')));
            setLifecycleConfirm(null);
        }
    };

    const executeCancelWithReason = async (reason?: string) => {
        if (!cancelTarget) return;
        try {
            await api.post(`/appointments/${cancelTarget.id}/cancel/`, { reason: reason ?? '' });
            toast.success(t('appointments.toast.cancelled'));
            setCancelTarget(null);
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, t('appointments.toast.cancel_failed')));
            throw err;
        }
    };

    const tileClassName = ({ date: td, view }: { date: Date; view: string }) => {
        if (view === 'month' && dotDates.includes(toYYYYMMDD(td))) return 'has-appointment';
        return null;
    };

    const dateHeading = formatDateLong(date);

    return (
        <>
            <PageHeader
                title={t('appointments.title', 'Appointments')}
                actions={
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate('/deleted-appointments')}
                    >
                        {t('appointments.deleted')}
                    </button>
                }
            />

            {/* Pending patient appointment requests */}
            {pendingRequests.length > 0 && (
                <div ref={requestsSectionRef} className="section-card" style={{ marginBottom: '1.25rem', border: '1px solid var(--color-warning)' }}>
                    <div className="section-card-header">
                        <span className="section-card-title" style={{ color: 'var(--color-warning-text)' }}>
                            {t('appointments.requests.title', { count: pendingRequests.length })}
                        </span>
                    </div>
                    <div className="section-card-body" style={{ display: 'grid', gap: '0.75rem' }}>
                        {pendingRequests.map(req => (
                            <div key={req.id} className="request-card">
                                <div className="request-card__info">
                                    <div className="request-card__name">
                                        {req.patient_name}
                                        {req.patient_id && (
                                            <Link
                                                to={`/patients/${req.patient_id}`}
                                                style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 400 }}
                                            >
                                                {t('appointments.requests.view_record')}
                                            </Link>
                                        )}
                                    </div>
                                    <div className="request-card__meta">
                                        {formatDateTime(req.appointment_date)}
                                        {' · '}{t(`appointments.type.${req.appointment_type ?? 'in_person'}`, req.appointment_type?.replace(/_/g, ' ') ?? '')}
                                    </div>
                                    {req.reason && (
                                        <div className="request-card__reason">{req.reason}</div>
                                    )}
                                </div>
                                <div className="request-card__actions">
                                    <button
                                        className="btn btn-success btn-sm"
                                        onClick={() => setApproveTarget({ id: req.id, patientName: req.patient_name })}
                                    >
                                        {t('appointments.actions.approve')}
                                    </button>
                                    <button
                                        className="btn-danger-outline btn-sm"
                                        onClick={() => setRejectTarget({ id: req.id, patientName: req.patient_name })}
                                    >
                                        {t('appointments.actions.reject')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* View mode toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                    className={`btn btn-sm ${viewMode === 'day' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('day')}
                >
                    {t('appointments.view.day')}
                </button>
                <button
                    className={`btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('week')}
                >
                    {t('appointments.view.week')}
                </button>
            </div>

            {/* Week view */}
            {viewMode === 'week' && (
                <div className="section-card" style={{ marginBottom: '1.25rem' }}>
                    <div className="section-card-header">
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setDate(d); }}
                        >{t('common.previous')}</button>
                        <span className="section-card-title" style={{ fontSize: '0.95rem' }}>
                            {formatDayMonth(weekStart)}
                            {' — '}
                            {formatDate(weekDays[6])}
                        </span>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setDate(d); }}
                        >{t('common.next')}</button>
                    </div>
                    <div className="section-card-body" style={{ padding: '0.5rem' }}>
                        {weekLoading && <div style={{ padding: '1rem' }}><TabSkeleton rows={3} /></div>}
                        {!weekLoading && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                                {weekDays.map(day => {
                                    const dayStr = toYYYYMMDD(day);
                                    const isToday = dayStr === toYYYYMMDD(new Date());
                                    // Bucket appointments into calendar cells using the *user's*
                                    // timezone (doctor's clinic tz when set, else browser tz) so a
                                    // 22:00 appointment doesn't slide into the next day's column.
                                    const dayAppts = weekAppointments.filter(a =>
                                        toIsoDateInTz(a.appointment_date) === dayStr
                                    );
                                    return (
                                        <div
                                            key={dayStr}
                                            style={{
                                                border: isToday ? '2px solid var(--accent)' : '1px solid var(--border-default)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: '0.5rem',
                                                minHeight: '120px',
                                                cursor: 'pointer',
                                                background: isToday ? 'var(--accent-lighter)' : 'var(--bg-card)',
                                            }}
                                            onClick={() => { setDate(day); setViewMode('day'); }}
                                        >
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                {new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(day).toUpperCase()}
                                                <br />
                                                <span style={{ fontSize: '1rem', color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}>
                                                    {day.getDate()}
                                                </span>
                                            </div>
                                            {dayAppts.map(appt => {
                                                const pName = appt.patient_details
                                                    ? `${appt.patient_details.first_name} ${appt.patient_details.last_name}`
                                                    : t('common.patient');
                                                return (
                                                    <div
                                                        key={appt.id}
                                                        className={`appt-card appt-card--${appt.status.replace('_', '-')}`}
                                                        style={{ marginBottom: '0.3rem', padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}
                                                        onClick={e => { e.stopPropagation(); setDate(day); setViewMode('day'); }}
                                                    >
                                                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pName}</div>
                                                        <div style={{ opacity: 0.75 }}>
                                                            {formatTime(appt.appointment_date)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {dayAppts.length === 0 && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>—</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Side-by-side layout on desktop (day view) */}
            {viewMode === 'day' && <div className="appt-layout">
                {/* Calendar panel */}
                <div className="section-card">
                    <div className="section-card-body" style={{ padding: '1rem' }}>
                        <Calendar
                            onChange={(v) => { if (v instanceof Date) setDate(v); }}
                            value={date}
                            tileClassName={tileClassName}
                            onActiveStartDateChange={({ activeStartDate }) => {
                                if (activeStartDate) setCurrentMonth(toYYYYMM(activeStartDate));
                            }}
                        />
                    </div>
                </div>

                {/* Appointments list panel */}
                <div className="section-card">
                    <div className="section-card-header">
                        <span className="section-card-title">{dateHeading}</span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                                type="button"
                                className={`btn btn-sm ${filterFollowUpOnly ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFilterFollowUpOnly(f => !f)}
                                title={t('appointments.followups_filter_title')}
                            >
                                {t('appointments.followups')}{filterFollowUpOnly ? ' x' : ''}
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => { setSelectedAppointment(null); setIsFormVisible(true); }}
                            >
                                {t('appointments.create_new')}
                            </button>
                        </div>
                    </div>

                    <div className="section-card-body section-card-body--flush">
                        {isLoading && <div style={{ padding: '1.25rem' }}><TabSkeleton rows={4} /></div>}
                        {isError && <div className="error-message" style={{ margin: '1rem' }}>{t('appointments.error.load')}</div>}

                        {!isLoading && !isError && appointments.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">📅</div>
                                <div className="empty-state-title">{t('appointments.no_appointments', 'No appointments on this day')}</div>
                                <div className="empty-state-subtitle">{t('appointments.empty.create_hint')}</div>
                            </div>
                        )}
                        {!isLoading && !isError && filterFollowUpOnly && appointments.length > 0 && appointments.filter(a => a.is_follow_up).length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-title">{t('appointments.empty.no_followups_title')}</div>
                                <div className="empty-state-subtitle">{t('appointments.empty.no_followups_subtitle')}</div>
                            </div>
                        )}

                        {(filterFollowUpOnly ? appointments.filter(a => a.is_follow_up) : appointments).map(appt => {
                            const apptDate = new Date(appt.appointment_date);
                            const patientName = appt.patient_details
                                ? `${appt.patient_details.first_name} ${appt.patient_details.last_name}`
                                : t('common.patient');

                            return (
                                <div key={appt.id} className={apptStatusClass(appt.status)} style={{ margin: '0.75rem' }}>
                                    {/* Pending request banner */}
                                    {appt.status === 'pending' && (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                                            background: 'var(--color-warning-light)',
                                            border: '1px solid var(--color-warning-border)',
                                            borderRadius: '6px', padding: '0.3rem 0.6rem',
                                            marginBottom: '0.5rem', fontSize: '0.78rem',
                                            color: 'var(--color-warning-dark)', fontWeight: 500,
                                        }}>
                                            {t('appointments.requests.awaiting_approval')}
                                            {appt.patient_details && (
                                                <Link
                                                    to={`/patients/${appt.patient_details.unique_id}`}
                                                    style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none' }}
                                                >
                                                    {t('appointments.requests.view_record')}
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                    {/* Card header row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                        <Avatar name={patientName} src={appt.patient_details?.avatar_url} size="sm" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="btn-row" style={{ marginBottom: '0.15rem' }}>
                                                <span className="card-name">
                                                    {appt.patient_details
                                                        ? <Link to={`/patients/${appt.patient_details.unique_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{patientName}</Link>
                                                        : patientName}
                                                </span>
                                                <StatusBadge status={appt.status} label={appt.status_display} />
                                            </div>
                                            <div className="card-meta" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <span>🕐 {formatTime(apptDate)}</span>
                                                {appt.appointment_type === 'telemedicine'
                                                    ? <span style={{ fontSize: '0.72rem', background: 'var(--color-info-light)', color: 'var(--color-info-dark)', borderRadius: '4px', padding: '1px 6px', fontWeight: 500 }}>📹 {t('appointments.type.video')}</span>
                                                    : <span style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', borderRadius: '4px', padding: '1px 6px', fontWeight: 500 }}>🏥 {t('appointments.type.in_person')}</span>
                                                }
                                                {appt.appointment_type === 'telemedicine'
                                                    && ['scheduled', 'confirmed', 'in_progress'].includes(appt.status) && (
                                                    <TelehealthJoinButton
                                                        appointmentId={appt.id}
                                                        onJoin={() => navigate(`/telehealth/${appt.id}`)}
                                                    />
                                                )}
                                                {appt.is_follow_up && (
                                                    <span
                                                        style={{ fontSize: '0.72rem', background: 'var(--color-success-light)', color: 'var(--color-success-dark)', borderRadius: '4px', padding: '1px 6px', fontWeight: 500, cursor: appt.follow_up_source_info ? 'help' : undefined }}
                                                        title={appt.follow_up_source_info ? t('appointments.followup_from', { date: formatDate(appt.follow_up_source_info.consultation_date) }) : t('appointments.followup_appointment')}
                                                    >
                                                        ↩ {t('appointments.followup')}
                                                    </span>
                                                )}
                                                {appt.rescheduled_from_date && (
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
                                                        title={t('appointments.rescheduled_from', { date: formatDayMonth(appt.rescheduled_from_date) })}>
                                                        ↩ {t('common.status.rescheduled')}
                                                    </span>
                                                )}
                                                {appt.referral && (
                                                    <span style={{ fontSize: '0.72rem', background: 'var(--accent-lighter)', color: 'var(--accent)', borderRadius: '4px', padding: '1px 6px', fontWeight: 500 }}
                                                        title={t('appointments.referral_title')}>
                                                        {t('appointments.referral')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {/* 3-dot overflow menu for Edit / Delete — toggle stops propagation so the document listener doesn't immediately close */}
                                        {!TERMINAL_STATUSES.includes(appt.status) && appt.status !== 'pending' && (
                                        <div className="appt-menu-wrap">
                                            <button
                                                className="appt-menu-btn"
                                                onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === appt.id ? null : appt.id); }}
                                                aria-label={t('appointments.more_options')}
                                            >⋯</button>
                                            {openMenuId === appt.id && (
                                                <div className="appt-menu-dropdown">
                                                    <button onClick={e => { e.stopPropagation(); setSelectedAppointment(appt); setIsFormVisible(true); setOpenMenuId(null); }}>
                                                        {t('common.edit')}
                                                    </button>
                                                    <button
                                                        className="danger"
                                                        onClick={e => { e.stopPropagation(); setSelectedAppointment(appt); setIsDeleteModalVisible(true); setOpenMenuId(null); }}
                                                    >
                                                        {t('appointments.delete_record')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        )}
                                    </div>

                                    {appt.reason_for_appointment && (
                                        <p className="card-reason">{appt.reason_for_appointment}</p>
                                    )}

                                    {/* ── Lifecycle actions ── */}

                                    {/* PENDING: approve or reject */}
                                    {appt.status === 'pending' && (
                                        <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                                            <button onClick={() => setApproveTarget({ id: appt.id, patientName })} className="btn btn-success btn-sm">
                                                {t('appointments.actions.approve')}
                                            </button>
                                            <button onClick={() => setRejectTarget({ id: appt.id, patientName })} className="btn-danger-outline btn-sm">
                                                {t('appointments.actions.reject')}
                                            </button>
                                        </div>
                                    )}

                                    {/* SCHEDULED: patient must confirm — show status hint only */}
                                    {appt.status === 'scheduled' && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            {t('appointments.awaiting_patient_confirmation')}
                                        </div>
                                    )}

                                    {/* CONFIRMED: start the consultation */}
                                    {appt.status === 'confirmed' && appt.patient_details && (
                                        <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                                            <button onClick={() => handleStartConsultation(appt)} className="btn btn-primary btn-sm">
                                                {t('appointments.start_consultation')}
                                            </button>
                                        </div>
                                    )}

                                    {/* IN_PROGRESS: resume the consultation */}
                                    {appt.status === 'in_progress' && appt.patient_details && (
                                        <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                                            <button
                                                onClick={() => handleStartConsultation(appt)}
                                                className="btn btn-primary btn-sm"
                                            >
                                                {t('appointments.resume_consultation')}
                                            </button>
                                        </div>
                                    )}

                                    {/* COMPLETED: view the linked consultation */}
                                    {appt.status === 'completed' && appt.patient_details && (
                                        <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                                            <button
                                                onClick={() => navigate(`/patients/${appt.patient_details!.unique_id}?tab=consultations${appt.consultation_id ? `&open_consultation=${appt.consultation_id}` : ''}`)}
                                                className="btn btn-secondary btn-sm"
                                            >
                                                {t('appointments.view_consultation')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Cancelled cards: show rescheduled badge or cancellation reason */}
                                    {appt.status === 'cancelled' && (
                                        appt.cancel_reason_code === 'rescheduled'
                                            ? <p style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>↩ {t('appointments.rescheduled_slot_hint')}</p>
                                            : appt.cancellation_reason
                                                ? <p style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('appointments.cancel_reason', { reason: appt.cancellation_reason })}</p>
                                                : null
                                    )}
                                    {/* Expired: patient request was never approved before slot passed */}
                                    {appt.status === 'expired' && (
                                        <p style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('appointments.expired_hint')}</p>
                                    )}

                                    {/* Rebook shortcut on dead cards (not for rescheduled — they already have a new appointment) */}
                                    {TERMINAL_STATUSES.includes(appt.status) && appt.status !== 'completed' && !(appt.status === 'cancelled' && appt.cancel_reason_code === 'rescheduled') && appt.patient_details && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => { setRebookPatientId(appt.patient_details!.unique_id); setSelectedAppointment(null); setIsFormVisible(true); }}
                                            >
                                                {t('appointments.rebook_patient')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Secondary row: reschedule / cancel / no-show for active appointments */}
                                    {ACTIVE_STATUSES.includes(appt.status) && (() => {
                                        const apptTime = new Date(appt.appointment_date);
                                        // 15-minute grace period — patient may still arrive; backend enforces same rule
                                        const apptHasPassed = Date.now() >= apptTime.getTime() + 15 * 60 * 1000;
                                        return (
                                            <div className="btn-row" style={{ marginTop: '0.35rem' }}>
                                                {/* Reschedule not available mid-consultation */}
                                                {appt.status !== 'in_progress' && (
                                                    <button
                                                        onClick={() => {
                                                            const dateStr = appt.appointment_date.slice(0, 10);
                                                            setRsDate(dateStr);
                                                            setRescheduleTarget({ id: appt.id, patientName });
                                                            fetchRsSlots(dateStr, appt.id);
                                                        }}
                                                        className="btn btn-muted btn-sm"
                                                    >
                                                        {t('appointments.actions.reschedule')}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setCancelTarget({ id: appt.id })}
                                                    className="btn-danger-outline btn-sm"
                                                >
                                                    {t('appointments.actions.cancel_visit')}
                                                </button>
                                                {/* No Show: confirmed only (patient was notified) + 15-min grace */}
                                                {appt.status === 'confirmed' && apptHasPassed && (
                                                    <button
                                                        onClick={() => setLifecycleConfirm({ id: appt.id, action: 'no_show' })}
                                                        className="btn btn-muted btn-sm"
                                                    >
                                                        {t('appointments.actions.no_show')}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>}

            {/* Forms & Modals */}
            {isFormVisible && (
                <AppointmentForm
                    initialDate={date}
                    appointment={selectedAppointment}
                    initialPatientId={!selectedAppointment ? (rebookPatientId ?? patientIdParam) : undefined}
                    onSuccess={() => { setIsFormVisible(false); setSelectedAppointment(null); setRebookPatientId(undefined); invalidateAll(); }}
                    onCancel={() => { setIsFormVisible(false); setSelectedAppointment(null); setRebookPatientId(undefined); }}
                />
            )}

            {isDeleteModalVisible && selectedAppointment && (
                <DeleteAppointmentModal
                    appointment={selectedAppointment}
                    onSuccess={() => { setIsDeleteModalVisible(false); setSelectedAppointment(null); invalidateAll(); }}
                    onCancel={() => { setIsDeleteModalVisible(false); setSelectedAppointment(null); }}
                />
            )}

            <Dialog
                open={lifecycleConfirm !== null}
                onClose={() => setLifecycleConfirm(null)}
                onConfirm={executeLifecycleAction}
                title={t('appointments.no_show.title')}
                message={t('appointments.no_show.message')}
                tone="danger"
                confirmLabel={t('appointments.no_show.confirm')}
            />

            {/* Reschedule modal — slot picker */}
            <Modal
                open={!!rescheduleTarget}
                onClose={closeReschedule}
                title={t('appointments.reschedule.title', { name: rescheduleTarget?.patientName ?? '' })}
                size="md"
                footer={
                    <>
                        <button type="button" className="cancel-button" onClick={closeReschedule}>{t('common.cancel')}</button>
                        <button type="button" className="btn btn-primary" onClick={executeReschedule} disabled={!rsSelected}>
                            {t('appointments.reschedule.confirm')}
                        </button>
                    </>
                }
            >
                <div className="appointment-form">
                    <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {t('appointments.reschedule.help')}
                    </p>
                    <div className="form-group">
                        <label htmlFor="rs-date">{t('appointments.reschedule.new_date')}</label>
                        <input
                            id="rs-date"
                            type="date"
                            className="input"
                            min={todayStr}
                            value={rsDate}
                            onChange={e => {
                                setRsDate(e.target.value);
                                if (rescheduleTarget) fetchRsSlots(e.target.value, rescheduleTarget.id);
                            }}
                        />
                    </div>
                    {rsDate && rsSlotsLoading && <div className="slots-loading">{t('appointments.form.loading_slots')}</div>}
                    {rsDate && !rsSlotsLoading && rsDayOff && <div className="slots-day-off">{t('appointments.form.day_off')}</div>}
                    {rsDate && !rsSlotsLoading && !rsDayOff && rsSlots.length === 0 && <div className="slots-day-off">{t('appointments.form.no_slots_configured')}</div>}
                    {rsDate && !rsSlotsLoading && rsSlots.length > 0 && (
                        <div className="form-group">
                            <label>{t('appointments.form.time_slot')}</label>
                            <div className="slot-grid">
                                {rsSlots.map(slot => (
                                    <button
                                        key={slot.time}
                                        type="button"
                                        className={['slot-btn', `slot-${slot.status}`, rsSelected === slot.datetime ? 'slot-selected' : ''].join(' ').trim()}
                                        disabled={slot.status !== 'free'}
                                        title={slot.status === 'booked' ? t('appointments.slot.booked_with', { name: slot.patient_name ?? '' }) : slot.time}
                                        onClick={() => setRsSelected(slot.datetime)}
                                    >
                                        <span className="slot-time">{slot.time}</span>
                                        {slot.status === 'booked' && <span className="slot-label">{t('appointments.slot.booked')}</span>}
                                        {slot.status === 'past' && <span className="slot-label">{t('appointments.slot.past')}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
            {/* Approve modal */}
            <Dialog
                open={!!approveTarget}
                onClose={() => setApproveTarget(null)}
                onConfirm={handleApprove}
                title={t('appointments.approve.title', { name: approveTarget?.patientName ?? '' })}
                message={t('appointments.approve.message')}
                confirmLabel={t('appointments.actions.approve')}
                reasonLabel={t('patient_record.portal.instructions_optional')}
                reasonPlaceholder={t('appointments.approve.instructions_placeholder')}
            />

            {/* Cancel appointment reason modal */}
            <Dialog
                open={!!cancelTarget}
                onClose={() => setCancelTarget(null)}
                onConfirm={executeCancelWithReason}
                title={t('appointments.cancel.title')}
                message={t('appointments.cancel.message')}
                confirmLabel={t('appointments.cancel.confirm')}
                cancelLabel={t('appointments.cancel.keep')}
                reasonLabel={t('appointments.cancel.reason_label')}
                reasonPlaceholder={t('appointments.cancel.reason_placeholder')}
                tone="danger"
            />

            {/* Reject modal */}
            <Dialog
                open={!!rejectTarget}
                onClose={() => setRejectTarget(null)}
                onConfirm={handleReject}
                title={t('appointments.reject.title', { name: rejectTarget?.patientName ?? '' })}
                message={t('appointments.reject.message')}
                confirmLabel={t('appointments.actions.reject')}
                reasonLabel={t('appointments.reject.reason_label')}
                reasonPlaceholder={t('appointments.reject.reason_placeholder')}
                requireReason
                tone="danger"
            />

        </>
    );
};

export default Appointments;
