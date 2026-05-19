import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatDate, formatDateTime } = useFormatDateTime();

    return (
        <div className="tab-panel" style={{ display: 'grid', gap: '1.5rem' }}>
            {/* ── Appointment Requests section ── */}
            <div className="tab-section">
                <div className="tab-panel-header">
                    <h3>
                        {t('patient_record.portal.appointment_requests')}
                        {pendingRequests.length > 0 && (
                            <span className="tab-count" style={{ marginLeft: '0.5rem' }}>{pendingRequests.length}</span>
                        )}
                    </h3>
                </div>
                {pendingRequestsLoading ? (
                    <TabSkeleton rows={2} />
                ) : pendingRequests.length === 0 ? (
                    <p className="muted">{t('patient_record.portal.no_pending_requests')}</p>
                ) : (
                    <div style={{ display: 'grid', gap: '0.875rem' }}>
                        {pendingRequests.map(req => (
                            <div key={req.id} style={{ padding: '0.875rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', display: 'grid', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{formatDateTime(req.appointment_date)}</div>
                                        {req.appointment_type && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                                {req.appointment_type === 'telemedicine' ? t('appointments.type.telemedicine') : t('appointments.type.in_person')}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{req.reason}</div>
                                        {req.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{t('patient_record.portal.note')}: {req.notes}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            className="btn btn-success btn-sm"
                                            onClick={() => handleApproveRequest(req.id)}
                                            disabled={requestActionLoading}
                                        >
                                            {t('dashboard.actions.approve')}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-danger-outline btn-sm"
                                            onClick={() => { setRejectRequestId(req.id); setRejectReason(''); }}
                                            disabled={requestActionLoading}
                                        >
                                            {t('dashboard.actions.decline')}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => navigate(`/appointments?patient=${id}`)}
                                        >
                                            {t('dashboard.actions.view')}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                                        {t('patient_record.portal.instructions_optional')}
                                    </label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                                        placeholder={t('patient_record.portal.instructions_placeholder')}
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
                    <h3>{t('nav.appointments')}</h3>
                    <button
                        className="btn-add-primary"
                        onClick={() => navigate(`/appointments?patient_id=${id}`)}
                    >
                        {t('patient_record.portal.book_appointment')}
                    </button>
                </div>
                {appointmentsLoading ? (
                    <TabSkeleton rows={3} />
                ) : patientAppointments.length === 0 ? (
                    <p className="muted">{t('patient_record.portal.no_appointments')}</p>
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
                                                    {appt.appointment_type === 'telemedicine' ? t('appointments.type.video') : t('appointments.type.in_person')}
                                                </span>
                                            )}
                                            {appt.rescheduled_from_date && (
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title={t('patient_record.portal.rescheduled_from', { date: formatDate(appt.rescheduled_from_date) })}>
                                                    {t('patient_record.portal.rescheduled')}
                                                </span>
                                            )}
                                        </div>
                                        <span className={`status-badge status-${appt.status}`}>{appt.status_display || appt.status}</span>
                                    </div>
                                    {appt.reason_for_appointment && (
                                        <div className="info-item"><strong>{t('patient_record.common.reason')}:</strong> {appt.reason_for_appointment}</div>
                                    )}
                                    {appt.cancellation_reason && (
                                        <div className="info-item" style={{ color: 'var(--color-danger)', fontSize: '0.8125rem' }}><strong>{t('patient_record.portal.cancellation_note')}:</strong> {appt.cancellation_reason}</div>
                                    )}
                                </li>
                            ))
                        }
                    </ul>
                )}
            </div>

            {/* ── Patient Portal section ── */}
            <div className="tab-section tab-section--divider" style={{ display: 'grid', gap: '1.25rem' }}>
                <div className="tab-panel-header"><h3>{t('patient_record.portal.title')}</h3></div>
                {portalLoading ? (
                    <TabSkeleton rows={4} />
                ) : (
                    <>
                        {/* Portal Status Card */}
                        <div className="section-card">
                            <div className="section-card-header">
                                <span className="section-card-title">{t('patient_record.portal.access')}</span>
                                {portalStatus && (
                                    <span className={`portal-status-badge ${
                                        portalStatus.claim_status === 'claimed' ? 'portal-status-badge--active'
                                        : portalStatus.claim_status === 'invited' ? 'portal-status-badge--invited'
                                        : portalStatus.portal_enabled ? 'portal-status-badge--pending'
                                        : 'portal-status-badge--inactive'
                                    }`}>
                                        {portalStatus.claim_status === 'claimed' ? t('patient_record.portal.status.active')
                                            : portalStatus.claim_status === 'invited' ? t('patient_record.portal.status.invited')
                                            : portalStatus.portal_enabled ? t('patient_record.portal.status.enabled')
                                            : t('patient_record.portal.status.not_enabled')}
                                    </span>
                                )}
                            </div>
                            <div className="section-card-body">
                                {portalStatus ? (
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        {portalStatus.primary_contact_email && (
                                            <div className="info-item"><strong>{t('patient_record.portal.email')}:</strong> {portalStatus.primary_contact_email}</div>
                                        )}
                                        {portalStatus.invited_at && (
                                            <div className="info-item"><strong>{t('patient_record.portal.invited')}:</strong> {formatDate(portalStatus.invited_at)}</div>
                                        )}
                                        {portalStatus.claimed_at && (
                                            <div className="info-item"><strong>{t('patient_record.portal.claimed')}:</strong> {formatDate(portalStatus.claimed_at)}</div>
                                        )}
                                        {portalStatus.claim_status !== 'claimed' && (
                                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                                <div className="form-group" style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}>
                                                    <label htmlFor="portalInviteEmail" style={{ fontSize: '0.8rem' }}>
                                                        {portalStatus.claim_status === 'invited' ? t('patient_record.portal.resend_invitation_to') : t('patient_record.portal.send_invitation_to')}
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
                                                    {portalInviteSending ? t('common.sending')
                                                        : portalStatus.claim_status === 'invited' ? t('patient_record.portal.resend_invite')
                                                        : t('patient_record.portal.send_invite')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                        <div className="form-group" style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}>
                                            <label htmlFor="portalInviteEmailNew" style={{ fontSize: '0.8rem' }}>{t('patient_record.portal.send_invitation')}</label>
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
                                            {portalInviteSending ? t('common.sending') : t('patient_record.portal.send_invite')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sharing settings */}
                        {portalStatus?.claim_status === 'claimed' && (
                            <div className="section-card">
                                <div className="section-card-header">
                                    <span className="section-card-title">{t('patient_record.portal.sharing_settings')}</span>
                                    {portalSettingsSaving && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('common.saving')}</span>}
                                </div>
                                <div className="section-card-body" style={{ display: 'grid', gap: '0.5rem' }}>
                                    {([
                                        ['share_consultations_by_default', t('patient_record.portal.share_consultations')],
                                        ['share_labs_by_default', t('patient_record.portal.share_labs')],
                                        ['share_prescriptions_by_default', t('patient_record.portal.share_prescriptions')],
                                        ['share_conditions_by_default', t('patient_record.portal.share_conditions')],
                                        ['share_allergies_by_default', t('patient_record.portal.share_allergies')],
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
                                                    {val ? t('common.on') : t('common.off')}
                                                </button>
                                            </div>
                                        );
                                    })}
                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                                        {sharingPreview === null ? (
                                            <button type="button" className="btn btn-sm btn-secondary" onClick={checkSharingDefaults}>
                                                {t('patient_record.portal.check_hidden')}
                                            </button>
                                        ) : sharingPreview.total_hidden === 0 ? (
                                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                                {t('patient_record.portal.all_match_defaults')}
                                            </span>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                                    {t('patient_record.portal.hidden_would_share', { count: sharingPreview.total_hidden })}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-primary"
                                                    onClick={applyAllSharingDefaults}
                                                    disabled={applyingDefaults}
                                                >
                                                    {applyingDefaults ? t('patient_record.portal.applying') : t('patient_record.portal.apply_existing')}
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
                title={t('patient_record.portal.decline_request')}
                message={
                    <div>
                        <p style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {t('patient_record.portal.decline_message')}
                        </p>
                        <textarea
                            rows={3}
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder={t('patient_record.portal.decline_placeholder')}
                            style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontSize: '0.875rem' }}
                        />
                    </div>
                }
                confirmLabel={t('patient_record.portal.decline_confirm')}
                cancelLabel={t('patient_record.portal.keep_pending')}
                onConfirm={() => { if (rejectRequestId) handleRejectRequest(rejectRequestId, rejectReason); }}
                onClose={() => { setRejectRequestId(null); setRejectReason(''); }}
            />
        </div>
    );
};

export default PortalTab;
