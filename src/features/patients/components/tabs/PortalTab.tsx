import { useNavigate } from 'react-router-dom';
import { TabSkeleton } from '../../../../shared/components/SectionCard';
import { Dialog } from '../../../../shared/components/ui';
import { useFormatDateTime } from '../../../../shared/hooks/useUserTimezone';

interface PatientAppointment {
    id: number;
    appointment_date: string;
    status: string;
    status_display?: string;
    reason_for_appointment: string;
    appointment_type?: string;
    rescheduled_from_date?: string | null;
    cancellation_reason?: string;
}

interface PortalTabProps {
    id: string;
    patientEmail?: string;
    patientAppointments: PatientAppointment[];
    appointmentsLoading: boolean;
    pendingRequests: any[];
    pendingRequestsLoading: boolean;
    portalStatus: any;
    portalLoading: boolean;
    portalInviteEmail: string;
    setPortalInviteEmail: (v: string) => void;
    portalInviteSending: boolean;
    portalSettingsSaving: boolean;
    sharingPreview: { total_hidden: number; hidden_counts: Record<string, number> } | null;
    applyingDefaults: boolean;
    approveInstructions: Record<number, string>;
    setApproveInstructions: (v: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
    requestActionLoading: boolean;
    rejectRequestId: number | null;
    setRejectRequestId: (id: number | null) => void;
    rejectReason: string;
    setRejectReason: (r: string) => void;
    handlePortalInvite: () => void;
    handlePortalSettingToggle: (field: string, current: boolean) => void;
    checkSharingDefaults: () => void;
    applyAllSharingDefaults: () => void;
    handleApproveRequest: (id: number) => void;
    handleRejectRequest: (id: number, reason: string) => void;
}

const PortalTab = ({
    id,
    patientEmail,
    patientAppointments,
    appointmentsLoading,
    pendingRequests,
    pendingRequestsLoading,
    portalStatus,
    portalLoading,
    portalInviteEmail,
    setPortalInviteEmail,
    portalInviteSending,
    portalSettingsSaving,
    sharingPreview,
    applyingDefaults,
    approveInstructions,
    setApproveInstructions,
    requestActionLoading,
    rejectRequestId,
    setRejectRequestId,
    rejectReason,
    setRejectReason,
    handlePortalInvite,
    handlePortalSettingToggle,
    checkSharingDefaults,
    applyAllSharingDefaults,
    handleApproveRequest,
    handleRejectRequest,
}: PortalTabProps) => {
    const navigate = useNavigate();
    const { formatDate, formatDateTime } = useFormatDateTime();

    return (
        <div className="tab-panel" style={{ display: 'grid', gap: '1.5rem' }}>
            {/* ── Appointment Requests section ── */}
            <div className="tab-section">
                <div className="tab-panel-header">
                    <h3>
                        Appointment Requests
                        {pendingRequests.length > 0 && (
                            <span className="tab-count" style={{ marginLeft: '0.5rem' }}>{pendingRequests.length}</span>
                        )}
                    </h3>
                </div>
                {pendingRequestsLoading ? (
                    <TabSkeleton rows={2} />
                ) : pendingRequests.length === 0 ? (
                    <p className="muted">No pending appointment requests from this patient.</p>
                ) : (
                    <div style={{ display: 'grid', gap: '0.875rem' }}>
                        {pendingRequests.map(req => (
                            <div key={req.id} style={{ padding: '0.875rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', display: 'grid', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{formatDateTime(req.appointment_date)}</div>
                                        {req.appointment_type && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                                {req.appointment_type === 'telemedicine' ? '📹 Telemedicine' : '🏥 In person'}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{req.reason}</div>
                                        {req.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Note: {req.notes}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            className="btn btn-success btn-sm"
                                            onClick={() => handleApproveRequest(req.id)}
                                            disabled={requestActionLoading}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-danger-outline btn-sm"
                                            onClick={() => { setRejectRequestId(req.id); setRejectReason(''); }}
                                            disabled={requestActionLoading}
                                        >
                                            Decline
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => navigate(`/appointments?patient=${id}`)}
                                        >
                                            View →
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                                        Instructions for patient (optional)
                                    </label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                                        placeholder="e.g. Please fast for 2 hours before the visit"
                                        value={approveInstructions[req.id] ?? ''}
                                        onChange={e => setApproveInstructions(prev => ({ ...prev, [req.id]: e.target.value }))}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Appointments section ── */}
            <div className="tab-section tab-section--divider">
                <div className="tab-panel-header">
                    <h3>Appointments</h3>
                    <button
                        className="btn-add-primary"
                        onClick={() => navigate(`/appointments?patient_id=${id}`)}
                    >
                        + Book Appointment
                    </button>
                </div>
                {appointmentsLoading ? (
                    <TabSkeleton rows={3} />
                ) : patientAppointments.length === 0 ? (
                    <p className="muted">No appointments on record for this patient.</p>
                ) : (
                    <ul className="detail-list">
                        {patientAppointments
                            .slice()
                            .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())
                            .map(appt => (
                                <li key={appt.id} className="detail-list-item">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <strong>{formatDateTime(appt.appointment_date)}</strong>
                                            {appt.appointment_type && (
                                                <span style={{ fontSize: '0.72rem', background: appt.appointment_type === 'telemedicine' ? '#dbeafe' : '#f3f4f6', color: appt.appointment_type === 'telemedicine' ? '#1e40af' : '#374151', borderRadius: '4px', padding: '1px 6px', fontWeight: 500 }}>
                                                    {appt.appointment_type === 'telemedicine' ? '📹 Video' : '🏥 In person'}
                                                </span>
                                            )}
                                            {appt.rescheduled_from_date && (
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title={`Rescheduled from ${formatDate(appt.rescheduled_from_date)}`}>
                                                    ↩ Rescheduled
                                                </span>
                                            )}
                                        </div>
                                        <span className={`status-badge status-${appt.status}`}>{appt.status_display || appt.status}</span>
                                    </div>
                                    {appt.reason_for_appointment && (
                                        <div className="info-item"><strong>Reason:</strong> {appt.reason_for_appointment}</div>
                                    )}
                                    {appt.cancellation_reason && (
                                        <div className="info-item" style={{ color: 'var(--color-danger)', fontSize: '0.8125rem' }}><strong>Cancellation note:</strong> {appt.cancellation_reason}</div>
                                    )}
                                </li>
                            ))
                        }
                    </ul>
                )}
            </div>

            {/* ── Patient Portal section ── */}
            <div className="tab-section tab-section--divider" style={{ display: 'grid', gap: '1.25rem' }}>
                <div className="tab-panel-header"><h3>Patient Portal</h3></div>
                {portalLoading ? (
                    <TabSkeleton rows={4} />
                ) : (
                    <>
                        {/* Portal Status Card */}
                        <div className="section-card">
                            <div className="section-card-header">
                                <span className="section-card-title">Portal access</span>
                                {portalStatus && (
                                    <span className={`portal-status-badge ${
                                        portalStatus.claim_status === 'claimed' ? 'portal-status-badge--active'
                                        : portalStatus.claim_status === 'invited' ? 'portal-status-badge--invited'
                                        : portalStatus.portal_enabled ? 'portal-status-badge--pending'
                                        : 'portal-status-badge--inactive'
                                    }`}>
                                        {portalStatus.claim_status === 'claimed' ? '● Active'
                                            : portalStatus.claim_status === 'invited' ? '⏳ Invited — awaiting claim'
                                            : portalStatus.portal_enabled ? '⏳ Enabled — not yet claimed'
                                            : '○ Not enabled'}
                                    </span>
                                )}
                            </div>
                            <div className="section-card-body">
                                {portalStatus ? (
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        {portalStatus.primary_contact_email && (
                                            <div className="info-item"><strong>Portal email:</strong> {portalStatus.primary_contact_email}</div>
                                        )}
                                        {portalStatus.invited_at && (
                                            <div className="info-item"><strong>Invited:</strong> {formatDate(portalStatus.invited_at)}</div>
                                        )}
                                        {portalStatus.claimed_at && (
                                            <div className="info-item"><strong>Claimed:</strong> {formatDate(portalStatus.claimed_at)}</div>
                                        )}
                                        {portalStatus.claim_status !== 'claimed' && (
                                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                                <div className="form-group" style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}>
                                                    <label htmlFor="portalInviteEmail" style={{ fontSize: '0.8rem' }}>
                                                        {portalStatus.claim_status === 'invited' ? 'Re-send invitation to' : 'Send portal invitation to'}
                                                    </label>
                                                    <input
                                                        id="portalInviteEmail"
                                                        type="email"
                                                        value={portalInviteEmail || portalStatus.primary_contact_email || patientEmail || ''}
                                                        onChange={e => setPortalInviteEmail(e.target.value)}
                                                        placeholder="patient@example.com"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    onClick={handlePortalInvite}
                                                    disabled={portalInviteSending}
                                                    style={{ marginBottom: '1px' }}
                                                >
                                                    {portalInviteSending ? 'Sending…'
                                                        : portalStatus.claim_status === 'invited' ? 'Resend invite'
                                                        : 'Send invite'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                        <div className="form-group" style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}>
                                            <label htmlFor="portalInviteEmailNew" style={{ fontSize: '0.8rem' }}>Send portal invitation</label>
                                            <input
                                                id="portalInviteEmailNew"
                                                type="email"
                                                value={portalInviteEmail || patientEmail || ''}
                                                onChange={e => setPortalInviteEmail(e.target.value)}
                                                placeholder={patientEmail || 'patient@example.com'}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={handlePortalInvite}
                                            disabled={portalInviteSending}
                                            style={{ marginBottom: '1px' }}
                                        >
                                            {portalInviteSending ? 'Sending…' : 'Send invite'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sharing settings */}
                        {portalStatus?.claim_status === 'claimed' && (
                            <div className="section-card">
                                <div className="section-card-header">
                                    <span className="section-card-title">Sharing settings</span>
                                    {portalSettingsSaving && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saving…</span>}
                                </div>
                                <div className="section-card-body" style={{ display: 'grid', gap: '0.5rem' }}>
                                    {([
                                        ['share_consultations_by_default', 'Share visit summaries by default'],
                                        ['share_labs_by_default', 'Share lab results by default'],
                                        ['share_prescriptions_by_default', 'Share medications by default'],
                                        ['share_conditions_by_default', 'Share conditions by default'],
                                        ['share_allergies_by_default', 'Share allergies by default'],
                                    ] as [string, string][]).map(([field, label]) => {
                                        const val = (portalStatus as Record<string, unknown>)[field] as boolean | undefined;
                                        return (
                                            <div key={field} className="portal-toggle-row">
                                                <div>
                                                    <div className="portal-toggle-label">{label}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm ${val ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => handlePortalSettingToggle(field, !!val)}
                                                    disabled={portalSettingsSaving}
                                                >
                                                    {val ? 'On' : 'Off'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                                        {sharingPreview === null ? (
                                            <button type="button" className="btn btn-sm btn-secondary" onClick={checkSharingDefaults}>
                                                Check existing hidden records
                                            </button>
                                        ) : sharingPreview.total_hidden === 0 ? (
                                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                                All existing records already match your sharing defaults.
                                            </span>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                                    <strong>{sharingPreview.total_hidden}</strong> existing record(s) are hidden but would be shared under current defaults.
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-primary"
                                                    onClick={applyAllSharingDefaults}
                                                    disabled={applyingDefaults}
                                                >
                                                    {applyingDefaults ? 'Applying…' : 'Apply to existing records'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Reject request dialog */}
            <Dialog
                open={rejectRequestId !== null}
                tone="danger"
                title="Decline appointment request"
                message={
                    <div>
                        <p style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            The patient will be notified. Optionally provide a reason.
                        </p>
                        <textarea
                            rows={3}
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="e.g. Doctor unavailable on that date — please request another time."
                            style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.875rem' }}
                        />
                    </div>
                }
                confirmLabel="Decline request"
                cancelLabel="Keep pending"
                onConfirm={() => { if (rejectRequestId) handleRejectRequest(rejectRequestId, rejectReason); }}
                onClose={() => { setRejectRequestId(null); setRejectReason(''); }}
            />
        </div>
    );
};

export default PortalTab;
