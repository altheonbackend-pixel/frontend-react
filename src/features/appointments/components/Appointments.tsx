// src/features/appointments/components/Appointments.tsx
// Phase 8: Calendar + appointment list side-by-side on desktop

import { useState, useEffect, useRef, useCallback } from 'react';
import Calendar from 'react-calendar';
import { useTranslation } from 'react-i18next';
import 'react-calendar/dist/Calendar.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Appointment, type Patient } from '../../../shared/types';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import AppointmentForm from './AppointmentForm';
import DeleteAppointmentModal from './DeleteAppointmentModal';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../../../shared/services/api';
import { Dialog, toast, parseApiError } from '../../../shared/components/ui';
import { queryKeys } from '../../../shared/queryKeys';
import { PageHeader } from '../../../shared/components/PageHeader';
import { StatusBadge } from '../../../shared/components/StatusBadge';
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
    const { t } = useTranslation();
    usePageTitle(t('pages.appointments', 'Appointments'));
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

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
    const [lifecycleConfirm, setLifecycleConfirm] = useState<{ id: number; action: 'confirm' | 'complete' | 'no_show' } | null>(null);
    const [cancelTarget, setCancelTarget] = useState<{ id: number } | null>(null);
    const [cancelReason, setCancelReason] = useState('');
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
    const [approveInstructions, setApproveInstructions] = useState('');
    const [rejectTarget, setRejectTarget] = useState<{ id: number; patientName: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');

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

    const { data: pendingRequests = [], refetch: refetchRequests } = useQuery<PendingRequest[]>({
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

    const handleApprove = async () => {
        if (!approveTarget) return;
        try {
            await api.post(`/appointments/${approveTarget.id}/approve/`, { portal_instructions: approveInstructions });
            toast.success('Appointment approved.');
            setApproveTarget(null);
            setApproveInstructions('');
            refetchRequests();
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to approve.'));
        }
    };

    const handleReject = async () => {
        if (!rejectTarget) return;
        try {
            await api.post(`/appointments/${rejectTarget.id}/reject/`, { reason: rejectReason });
            toast.success('Request rejected.');
            setRejectTarget(null);
            setRejectReason('');
            refetchRequests();
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to reject.'));
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
            toast.error('Could not load available slots.');
        } finally {
            setRsSlotsLoading(false);
        }
    }, []);

    const closeReschedule = () => { setRescheduleTarget(null); setRsDate(''); setRsSlots([]); setRsDayOff(false); setRsSelected(null); };

    const executeReschedule = async () => {
        if (!rescheduleTarget || !rsSelected) return;
        try {
            await api.post(`/appointments/${rescheduleTarget.id}/reschedule/`, {
                appointment_date: new Date(rsSelected).toISOString(),
            });
            toast.success('Appointment rescheduled. A new scheduled appointment has been created.');
            closeReschedule();
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to reschedule appointment.'));
        }
    };

    const todayStr = new Date().toISOString().slice(0, 10);

    const handleStartConsultation = async (appt: AppointmentWithDetails) => {
        try {
            const res = await api.post(`/appointments/${appt.id}/start-consultation/`);
            const { consultation_id } = res.data;
            const patientId = appt.patient_details?.unique_id ?? appt.patient;
            const isResume = res.status === 200;
            if (!isResume) toast.success('Consultation started.');
            navigate(`/patients/${patientId}?tab=consultations&open_consultation=${consultation_id}&draft=true`);
        } catch (err) {
            toast.error(parseApiError(err, 'Could not start consultation.'));
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

    const executeCancelWithReason = async () => {
        if (!cancelTarget) return;
        try {
            await api.post(`/appointments/${cancelTarget.id}/cancel/`, { reason: cancelReason });
            toast.success('Appointment cancelled.');
            setCancelTarget(null);
            setCancelReason('');
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to cancel appointment.'));
        }
    };

    const tileClassName = ({ date: td, view }: { date: Date; view: string }) => {
        if (view === 'month' && dotDates.includes(toYYYYMMDD(td))) return 'has-appointment';
        return null;
    };

    const dateHeading = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <>
            <PageHeader
                title={t('appointments.title', 'Appointments')}
                actions={
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate('/deleted-appointments')}
                    >
                        Deleted appointments
                    </button>
                }
            />

            {/* Pending patient appointment requests */}
            {pendingRequests.length > 0 && (
                <div ref={requestsSectionRef} className="section-card" style={{ marginBottom: '1.25rem', border: '1px solid var(--color-warning)' }}>
                    <div className="section-card-header">
                        <span className="section-card-title" style={{ color: 'var(--color-warning-text)' }}>
                            Patient Appointment Requests ({pendingRequests.length})
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
                                                View record →
                                            </Link>
                                        )}
                                    </div>
                                    <div className="request-card__meta">
                                        {new Date(req.appointment_date).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        {' · '}{req.appointment_type?.replace(/_/g, ' ')}
                                    </div>
                                    {req.reason && (
                                        <div className="request-card__reason">{req.reason}</div>
                                    )}
                                </div>
                                <div className="request-card__actions">
                                    <button
                                        className="btn btn-success btn-sm"
                                        onClick={() => { setApproveTarget({ id: req.id, patientName: req.patient_name }); setApproveInstructions(''); }}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        className="btn-danger-outline btn-sm"
                                        onClick={() => { setRejectTarget({ id: req.id, patientName: req.patient_name }); setRejectReason(''); }}
                                    >
                                        Reject
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
                    Day view
                </button>
                <button
                    className={`btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setViewMode('week')}
                >
                    Week view
                </button>
            </div>

            {/* Week view */}
            {viewMode === 'week' && (
                <div className="section-card" style={{ marginBottom: '1.25rem' }}>
                    <div className="section-card-header">
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setDate(d); }}
                        >← Prev</button>
                        <span className="section-card-title" style={{ fontSize: '0.95rem' }}>
                            {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {' — '}
                            {weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setDate(d); }}
                        >Next →</button>
                    </div>
                    <div className="section-card-body" style={{ padding: '0.5rem' }}>
                        {weekLoading && <div style={{ padding: '1rem' }}><TabSkeleton rows={3} /></div>}
                        {!weekLoading && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                                {weekDays.map(day => {
                                    const dayStr = toYYYYMMDD(day);
                                    const isToday = dayStr === toYYYYMMDD(new Date());
                                    const dayAppts = weekAppointments.filter(a =>
                                        new Date(a.appointment_date).toLocaleDateString('en-CA') === dayStr
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
                                                {day.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()}
                                                <br />
                                                <span style={{ fontSize: '1rem', color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}>
                                                    {day.getDate()}
                                                </span>
                                            </div>
                                            {dayAppts.map(appt => {
                                                const pName = appt.patient_details
                                                    ? `${appt.patient_details.first_name} ${appt.patient_details.last_name}`
                                                    : 'Patient';
                                                return (
                                                    <div
                                                        key={appt.id}
                                                        className={`appt-card appt-card--${appt.status.replace('_', '-')}`}
                                                        style={{ marginBottom: '0.3rem', padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}
                                                        onClick={e => { e.stopPropagation(); setDate(day); setViewMode('day'); }}
                                                    >
                                                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pName}</div>
                                                        <div style={{ opacity: 0.75 }}>
                                                            {new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                title="Show follow-up appointments only"
                            >
                                Follow-ups{filterFollowUpOnly ? ' ✕' : ''}
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => { setSelectedAppointment(null); setIsFormVisible(true); }}
                            >
                                + Create Appointment
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
                                <div className="empty-state-subtitle">Click "New Appointment" to schedule one.</div>
                            </div>
                        )}
                        {!isLoading && !isError && filterFollowUpOnly && appointments.length > 0 && appointments.filter(a => a.is_follow_up).length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-title">No follow-up appointments today</div>
                                <div className="empty-state-subtitle">Follow-ups are appointments created from consultation follow-up prompts.</div>
                            </div>
                        )}

                        {(filterFollowUpOnly ? appointments.filter(a => a.is_follow_up) : appointments).map(appt => {
                            const apptDate = new Date(appt.appointment_date);
                            const patientName = appt.patient_details
                                ? `${appt.patient_details.first_name} ${appt.patient_details.last_name}`
                                : 'Patient';

                            return (
                                <div key={appt.id} className={apptStatusClass(appt.status)} style={{ margin: '0.75rem' }}>
                                    {/* Pending request banner */}
                                    {appt.status === 'pending' && (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                                            background: 'var(--color-warning-bg, #fffbeb)',
                                            border: '1px solid var(--color-warning-border, #fcd34d)',
                                            borderRadius: '6px', padding: '0.3rem 0.6rem',
                                            marginBottom: '0.5rem', fontSize: '0.78rem',
                                            color: 'var(--color-warning-text, #92400e)', fontWeight: 500,
                                        }}>
                                            ⏳ Patient request — awaiting your approval
                                            {appt.patient_details && (
                                                <Link
                                                    to={`/patients/${appt.patient_details.unique_id}`}
                                                    style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-primary, #6366f1)', textDecoration: 'none' }}
                                                >
                                                    View record →
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                    {/* Card header row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                        <Avatar name={patientName} size="sm" />
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
                                                <span>🕐 {apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {appt.appointment_type === 'telemedicine'
                                                    ? <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', padding: '1px 6px', fontWeight: 500 }}>📹 Video</span>
                                                    : <span style={{ fontSize: '0.72rem', background: '#f3f4f6', color: '#374151', borderRadius: '4px', padding: '1px 6px', fontWeight: 500 }}>🏥 In person</span>
                                                }
                                                {appt.is_follow_up && (
                                                    <span
                                                        style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#065f46', borderRadius: '4px', padding: '1px 6px', fontWeight: 500, cursor: appt.follow_up_source_info ? 'help' : undefined }}
                                                        title={appt.follow_up_source_info ? `Follow-up from consultation on ${new Date(appt.follow_up_source_info.consultation_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Follow-up appointment'}
                                                    >
                                                        ↩ Follow-up
                                                    </span>
                                                )}
                                                {appt.rescheduled_from_date && (
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
                                                        title={`Rescheduled from ${new Date(appt.rescheduled_from_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}>
                                                        ↩ Rescheduled
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
                                                aria-label="More options"
                                            >⋯</button>
                                            {openMenuId === appt.id && (
                                                <div className="appt-menu-dropdown">
                                                    <button onClick={e => { e.stopPropagation(); setSelectedAppointment(appt); setIsFormVisible(true); setOpenMenuId(null); }}>
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="danger"
                                                        onClick={e => { e.stopPropagation(); setSelectedAppointment(appt); setIsDeleteModalVisible(true); setOpenMenuId(null); }}
                                                    >
                                                        Delete Record
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
                                            <button onClick={() => { setApproveTarget({ id: appt.id, patientName }); setApproveInstructions(''); }} className="btn btn-success btn-sm">
                                                ✓ Approve
                                            </button>
                                            <button onClick={() => { setRejectTarget({ id: appt.id, patientName }); setRejectReason(''); }} className="btn-danger-outline btn-sm">
                                                ✕ Reject
                                            </button>
                                        </div>
                                    )}

                                    {/* SCHEDULED: patient must confirm — show status hint only */}
                                    {appt.status === 'scheduled' && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            Awaiting patient confirmation
                                        </div>
                                    )}

                                    {/* CONFIRMED: start the consultation */}
                                    {appt.status === 'confirmed' && appt.patient_details && (
                                        <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                                            <button onClick={() => handleStartConsultation(appt)} className="btn btn-primary btn-sm">
                                                ▶ Start Consultation
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
                                                Resume Consultation →
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
                                                View Consultation →
                                            </button>
                                        </div>
                                    )}

                                    {/* Cancelled cards: show rescheduled badge or cancellation reason */}
                                    {appt.status === 'cancelled' && (
                                        appt.cancel_reason_code === 'rescheduled'
                                            ? <p style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>↩ This slot was rescheduled — see new appointment below.</p>
                                            : appt.cancellation_reason
                                                ? <p style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Reason: {appt.cancellation_reason}</p>
                                                : null
                                    )}
                                    {/* Expired: patient request was never approved before slot passed */}
                                    {appt.status === 'expired' && (
                                        <p style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Slot expired — patient request was not approved in time.</p>
                                    )}

                                    {/* Rebook shortcut on dead cards (not for rescheduled — they already have a new appointment) */}
                                    {TERMINAL_STATUSES.includes(appt.status) && appt.status !== 'completed' && !(appt.status === 'cancelled' && appt.cancel_reason_code === 'rescheduled') && appt.patient_details && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => { setRebookPatientId(appt.patient_details!.unique_id); setSelectedAppointment(null); setIsFormVisible(true); }}
                                            >
                                                + Rebook patient
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
                                                        Reschedule
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setCancelTarget({ id: appt.id }); setCancelReason(''); }}
                                                    className="btn-danger-outline btn-sm"
                                                >
                                                    Cancel Visit
                                                </button>
                                                {/* No Show: confirmed only (patient was notified) + 15-min grace */}
                                                {appt.status === 'confirmed' && apptHasPassed && (
                                                    <button
                                                        onClick={() => setLifecycleConfirm({ id: appt.id, action: 'no_show' })}
                                                        className="btn btn-muted btn-sm"
                                                    >
                                                        No Show
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
                title={lifecycleConfirm
                    ? (lifecycleConfirm.action === 'confirm' ? 'Confirm appointment?'
                       : lifecycleConfirm.action === 'no_show' ? 'Mark as no-show?'
                       : 'Update appointment?')
                    : ''}
                message={lifecycleConfirm
                    ? (lifecycleConfirm.action === 'confirm' ? 'This will confirm the appointment and notify the patient.'
                       : lifecycleConfirm.action === 'no_show' ? 'Mark this appointment as a no-show. The patient was not present.'
                       : 'Are you sure?')
                    : ''}
                tone={lifecycleConfirm?.action === 'no_show' ? 'danger' : 'warning'}
                confirmLabel={lifecycleConfirm?.action === 'confirm' ? 'Confirm' : lifecycleConfirm?.action === 'no_show' ? 'Mark No-Show' : 'Update'}
            />

            {/* Reschedule modal — slot picker */}
            {rescheduleTarget && (
                <div className="modal-overlay" onClick={closeReschedule}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <h3 className="modal-title">Reschedule — {rescheduleTarget.patientName}</h3>
                        <p className="modal-desc" style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            Pick a new date and an available slot. The current appointment will be marked as rescheduled.
                        </p>
                        <div className="form-group">
                            <label htmlFor="rs-date">New Date</label>
                            <input
                                id="rs-date"
                                type="date"
                                className="input"
                                min={todayStr}
                                value={rsDate}
                                onChange={e => { setRsDate(e.target.value); fetchRsSlots(e.target.value, rescheduleTarget.id); }}
                            />
                        </div>
                        {rsDate && rsSlotsLoading && <div className="slots-loading">Loading slots…</div>}
                        {rsDate && !rsSlotsLoading && rsDayOff && <div className="slots-day-off">Doctor is not available on this day.</div>}
                        {rsDate && !rsSlotsLoading && !rsDayOff && rsSlots.length === 0 && rsDate && <div className="slots-day-off">No working hours configured for this day.</div>}
                        {rsDate && !rsSlotsLoading && rsSlots.length > 0 && (
                            <div className="form-group">
                                <label>Available slots</label>
                                <div className="slot-grid">
                                    {rsSlots.map(slot => (
                                        <button
                                            key={slot.time}
                                            type="button"
                                            className={['slot-btn', `slot-${slot.status}`, rsSelected === slot.datetime ? 'slot-selected' : ''].join(' ').trim()}
                                            disabled={slot.status !== 'free'}
                                            title={slot.status === 'booked' ? `Booked — ${slot.patient_name ?? ''}` : slot.time}
                                            onClick={() => setRsSelected(slot.datetime)}
                                        >
                                            <span className="slot-time">{slot.time}</span>
                                            {slot.status === 'booked' && <span className="slot-label">Booked</span>}
                                            {slot.status === 'past' && <span className="slot-label">Past</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="btn-row btn-row--mt">
                            <button className="btn btn-secondary btn-full" onClick={closeReschedule}>Cancel</button>
                            <button className="btn btn-primary btn-full" onClick={executeReschedule} disabled={!rsSelected}>
                                Confirm reschedule
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Approve modal */}
            {approveTarget && (
                <div className="modal-overlay" onClick={() => setApproveTarget(null)}>
                    <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Approve Request — {approveTarget.patientName}</h3>
                        <p className="card-meta" style={{ marginBottom: '1rem' }}>
                            Optionally add instructions for the patient (e.g. what to bring, fasting requirements).
                        </p>
                        <div className="form-group">
                            <label htmlFor="approve-instructions">Portal instructions (optional)</label>
                            <textarea
                                id="approve-instructions"
                                rows={3}
                                value={approveInstructions}
                                onChange={e => setApproveInstructions(e.target.value)}
                                placeholder="e.g. Please bring your home BP log."
                            />
                        </div>
                        <div className="btn-row btn-row--mt">
                            <button className="btn btn-secondary btn-full" onClick={() => setApproveTarget(null)}>Cancel</button>
                            <button className="btn btn-success btn-full" onClick={handleApprove}>Approve</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel appointment reason modal */}
            {cancelTarget && (
                <div className="modal-overlay" onClick={() => setCancelTarget(null)}>
                    <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Cancel Appointment</h3>
                        <p className="card-meta" style={{ marginBottom: '1rem' }}>
                            The patient will be notified. Providing a reason helps them understand what to do next.
                        </p>
                        <div className="form-group">
                            <label htmlFor="cancel-reason">Reason for cancellation (optional)</label>
                            <textarea
                                id="cancel-reason"
                                rows={3}
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                placeholder="e.g. Doctor unavailable. Please call to reschedule."
                            />
                        </div>
                        <div className="btn-row btn-row--mt">
                            <button className="btn btn-secondary btn-full" onClick={() => setCancelTarget(null)}>Keep appointment</button>
                            <button className="btn btn-danger btn-full" onClick={executeCancelWithReason}>Confirm cancellation</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject modal */}
            {rejectTarget && (
                <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
                    <div className="modal-box modal-box--sm" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Reject Request — {rejectTarget.patientName}</h3>
                        <div className="form-group">
                            <label htmlFor="reject-reason">Reason for rejection</label>
                            <textarea
                                id="reject-reason"
                                rows={3}
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                placeholder="e.g. No availability on this day. Please request another date."
                            />
                        </div>
                        <div className="btn-row btn-row--mt">
                            <button className="btn btn-secondary btn-full" onClick={() => setRejectTarget(null)}>Cancel</button>
                            <button className="btn btn-danger btn-full" onClick={handleReject}>Reject</button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
};

export default Appointments;
