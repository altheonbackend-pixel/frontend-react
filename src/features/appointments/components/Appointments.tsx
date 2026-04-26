// src/features/appointments/components/Appointments.tsx
// Phase 8: Calendar + appointment list side-by-side on desktop

import { useState, useEffect } from 'react';
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

const CONSULTATION_STARTABLE = ['scheduled', 'confirmed', 'in_progress'];

interface AppointmentWithDetails extends Appointment {
    patient_details: Patient;
}

function toYYYYMM(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function toYYYYMMDD(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Status → CSS class suffix for left border color
function apptStatusClass(status: string) {
    return `appt-card appt-card--${status.replace('_', '-')}`;
}

const Appointments = () => {
    const { t } = useTranslation();
    usePageTitle(t('pages.appointments', 'Appointments'));
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

    const patientIdParam = searchParams.get('patient_id') ?? undefined;

    useEffect(() => {
        if (patientIdParam) {
            setSelectedAppointment(null);
            setIsFormVisible(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientIdParam]);

    const [date, setDate] = useState<Date>(new Date());
    const [currentMonth, setCurrentMonth] = useState<string>(toYYYYMM(new Date()));
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [lifecycleConfirm, setLifecycleConfirm] = useState<{ id: number; action: 'confirm' | 'complete' | 'cancel' | 'no_show' } | null>(null);
    const [rescheduleTarget, setRescheduleTarget] = useState<{ id: number } | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
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

    const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ['appointments'] });

    const executeReschedule = async () => {
        if (!rescheduleTarget || !rescheduleDate) return;
        try {
            await api.post(`/appointments/${rescheduleTarget.id}/reschedule/`, {
                appointment_date: new Date(rescheduleDate).toISOString(),
            });
            toast.success('Appointment rescheduled. A new scheduled appointment has been created.');
            setRescheduleTarget(null);
            setRescheduleDate('');
            invalidateAll();
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to reschedule appointment.'));
        }
    };

    const handleStartConsultation = async (appt: AppointmentWithDetails) => {
        try {
            const res = await api.post(`/appointments/${appt.id}/start-consultation/`);
            const { consultation_id } = res.data;
            const patientId = appt.patient_details?.unique_id ?? appt.patient;
            toast.success('Consultation started.');
            navigate(`/patients/${patientId}?tab=consultations&open_consultation=${consultation_id}`);
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
                <div className="section-card" style={{ marginBottom: '1.25rem', border: '1px solid var(--color-warning)' }}>
                    <div className="section-card-header">
                        <span className="section-card-title" style={{ color: 'var(--color-warning-text)' }}>
                            Patient Appointment Requests ({pendingRequests.length})
                        </span>
                    </div>
                    <div className="section-card-body" style={{ display: 'grid', gap: '0.75rem' }}>
                        {pendingRequests.map(req => (
                            <div key={req.id} className="request-card">
                                <div className="request-card__info">
                                    <div className="request-card__name">{req.patient_name}</div>
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

            {/* Side-by-side layout on desktop */}
            <div className="appt-layout">
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
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => { setSelectedAppointment(null); setIsFormVisible(true); }}
                        >
                            + {t('appointments.create_button', 'New Appointment')}
                        </button>
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

                        {appointments.map(appt => {
                            const apptDate = new Date(appt.appointment_date);
                            const patientName = appt.patient_details
                                ? `${appt.patient_details.first_name} ${appt.patient_details.last_name}`
                                : 'Patient';

                            return (
                                <div key={appt.id} className={apptStatusClass(appt.status)} style={{ margin: '0.75rem' }}>
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
                                            <div className="card-meta">
                                                🕐 {apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>

                                    {appt.reason_for_appointment && (
                                        <p className="card-reason">{appt.reason_for_appointment}</p>
                                    )}

                                    {/* Action buttons */}
                                    <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                                        {CONSULTATION_STARTABLE.includes(appt.status) && appt.patient_details && (
                                            <button
                                                onClick={() => handleStartConsultation(appt)}
                                                className="btn btn-primary btn-sm"
                                                aria-label="Start consultation"
                                            >
                                                + Consult
                                            </button>
                                        )}
                                        {(appt.status === 'scheduled' || appt.status === 'pending') && (
                                            <button
                                                onClick={() => setLifecycleConfirm({ id: appt.id, action: 'confirm' })}
                                                className="btn btn-success btn-sm"
                                                aria-label="Confirm appointment"
                                            >
                                                Confirm
                                            </button>
                                        )}
                                        {(appt.status === 'confirmed' || appt.status === 'in_progress') && (
                                            <button
                                                onClick={() => setLifecycleConfirm({ id: appt.id, action: 'complete' })}
                                                className="btn btn-secondary btn-sm"
                                                aria-label="Mark as completed"
                                            >
                                                Complete
                                            </button>
                                        )}
                                        {!['cancelled', 'completed', 'no_show'].includes(appt.status) && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        const dt = new Date(appt.appointment_date);
                                                        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                                        setRescheduleDate(local);
                                                        setRescheduleTarget({ id: appt.id });
                                                    }}
                                                    className="btn btn-muted btn-sm"
                                                    aria-label="Reschedule appointment"
                                                >
                                                    Reschedule
                                                </button>
                                                <button
                                                    onClick={() => setLifecycleConfirm({ id: appt.id, action: 'cancel' })}
                                                    className="btn-danger-outline btn-sm"
                                                    aria-label="Cancel appointment"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        )}
                                        {(appt.status === 'confirmed' || appt.status === 'scheduled') && (
                                            <button
                                                onClick={() => setLifecycleConfirm({ id: appt.id, action: 'no_show' })}
                                                className="btn btn-muted btn-sm"
                                                aria-label="Mark as no-show"
                                            >
                                                No Show
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setSelectedAppointment(appt); setIsFormVisible(true); }}
                                            className="btn btn-ghost btn-sm"
                                            aria-label="Edit appointment"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => { setSelectedAppointment(appt); setIsDeleteModalVisible(true); }}
                                            className="btn-danger-outline btn-sm"
                                            aria-label="Delete appointment"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Forms & Modals */}
            {isFormVisible && (
                <AppointmentForm
                    initialDate={date}
                    appointment={selectedAppointment}
                    initialPatientId={!selectedAppointment ? patientIdParam : undefined}
                    onSuccess={() => { setIsFormVisible(false); setSelectedAppointment(null); invalidateAll(); }}
                    onCancel={() => { setIsFormVisible(false); setSelectedAppointment(null); }}
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
                    ? t(`appointments.lifecycle.${lifecycleConfirm.action}_title`, { defaultValue: `${lifecycleConfirm.action.charAt(0).toUpperCase() + lifecycleConfirm.action.slice(1).replace('_', ' ')} appointment?` })
                    : ''}
                message={lifecycleConfirm
                    ? t(`appointments.lifecycle.${lifecycleConfirm.action}_message`, { defaultValue: 'This action will update the appointment status. Are you sure?' })
                    : ''}
                tone={lifecycleConfirm?.action === 'cancel' || lifecycleConfirm?.action === 'no_show' ? 'danger' : 'warning'}
                confirmLabel={lifecycleConfirm ? lifecycleConfirm.action.charAt(0).toUpperCase() + lifecycleConfirm.action.slice(1).replace('_', ' ') : ''}
            />

            {/* BUG-07 fix: Reschedule now uses shared Modal pattern */}
            {rescheduleTarget && (
                <div className="modal-overlay" onClick={() => setRescheduleTarget(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <h3 className="modal-title">Reschedule Appointment</h3>
                        <p className="modal-desc" style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            Select a new date and time. The current appointment will be marked as rescheduled.
                        </p>
                        <div className="form-field">
                            <label htmlFor="reschedule-date">New Date &amp; Time</label>
                            <input
                                id="reschedule-date"
                                type="datetime-local"
                                className="input"
                                value={rescheduleDate}
                                onChange={e => setRescheduleDate(e.target.value)}
                            />
                        </div>
                        <div className="btn-row btn-row--mt">
                            <button className="btn btn-secondary btn-full" onClick={() => setRescheduleTarget(null)}>Cancel</button>
                            <button className="btn btn-primary btn-full" onClick={executeReschedule} disabled={!rescheduleDate}>
                                Reschedule
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
