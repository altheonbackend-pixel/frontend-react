import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PatientWithHistory, type MedicalProcedure, type Referral } from '../../../../shared/types';
import { TabSkeleton } from '../../../../shared/components/SectionCard';
import { toast, parseApiError } from '../../../../shared/components/ui';
import api from '../../../../shared/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useFormatDateTime } from '../../../../shared/hooks/useUserTimezone';
import ReferralMessageThread from '../../../referrals/components/ReferralMessageThread';
import ReferralSnapshotView from '../../../referrals/components/ReferralSnapshotView';
import ReferralEventTimeline from '../../../referrals/components/ReferralEventTimeline';
import ReferralSLABadge from '../../../referrals/components/ReferralSLABadge';

interface MedicalActTabProps {
    patient: PatientWithHistory;
    id: string;
    canWrite: boolean;
    profile: any;
    proceduresData: MedicalProcedure[];
    proceduresLoading: boolean;
    referralsData: Referral[];
    referralsLoading: boolean;
    setConfirmDeleteProcedureId: (id: number | null) => void;
    setConfirmDeleteReferralId: (id: number | null) => void;
    setProcedureToEdit: (p: MedicalProcedure | null) => void;
    setShowProcedureForm: (v: boolean) => void;
    setReferralToEdit: (r: Referral | null) => void;
    setShowReferralForm: (v: boolean) => void;
    downloadFile: (url: string | null | undefined, name?: string) => void;
    resultFormReferralId: number | null;
    setResultFormReferralId: (id: number | null) => void;
    resultText: string;
    setResultText: (t: string) => void;
    resultSubmitting: boolean;
    setResultSubmitting: (v: boolean) => void;
    cancelFormReferralId: number | null;
    setCancelFormReferralId: (id: number | null) => void;
    cancelReason: string;
    setCancelReason: (r: string) => void;
    cancelSubmitting: boolean;
    setCancelSubmitting: (v: boolean) => void;
    recallFormReferralId: number | null;
    setRecallFormReferralId: (id: number | null) => void;
    recallReason: string;
    setRecallReason: (r: string) => void;
    recallSubmitting: boolean;
    setRecallSubmitting: (v: boolean) => void;
    openThreadReferralId: number | null;
    setOpenThreadReferralId: (id: number | null) => void;
}

type Section = 'procedures' | 'referrals';

const MedicalActTab = ({
    patient,
    id,
    canWrite,
    profile,
    proceduresData,
    proceduresLoading,
    referralsData,
    referralsLoading,
    setConfirmDeleteProcedureId,
    setConfirmDeleteReferralId,
    setProcedureToEdit,
    setShowProcedureForm,
    setReferralToEdit,
    setShowReferralForm,
    downloadFile,
    resultFormReferralId,
    setResultFormReferralId,
    resultText,
    setResultText,
    resultSubmitting,
    setResultSubmitting,
    cancelFormReferralId,
    setCancelFormReferralId,
    cancelReason,
    setCancelReason,
    cancelSubmitting,
    setCancelSubmitting,
    recallFormReferralId,
    setRecallFormReferralId,
    recallReason,
    setRecallReason,
    recallSubmitting,
    setRecallSubmitting,
    openThreadReferralId,
    setOpenThreadReferralId,
}: MedicalActTabProps) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { formatDate } = useFormatDateTime();
    const [section, setSection] = useState<Section>('procedures');

    const procedureCount = patient.medical_procedures?.length ?? proceduresData.length;
    const referralCount = patient.referrals?.length ?? referralsData.length;

    return (
        <div className="tab-panel">
            <p className="muted" style={{ marginTop: 0 }}>
                {t('medical_act.intro', 'Procedures performed and referrals for this patient.')}
            </p>

            {/* Segmented sub-navigation — keeps the long referral list out of the way */}
            <div className="view-toggle" style={{ marginBottom: '1rem' }}>
                <button
                    type="button"
                    className={`view-toggle-btn${section === 'procedures' ? ' active' : ''}`}
                    onClick={() => setSection('procedures')}
                >
                    {t('medical_act.seg.procedures', 'Procedures')} ({procedureCount})
                </button>
                <button
                    type="button"
                    className={`view-toggle-btn${section === 'referrals' ? ' active' : ''}`}
                    onClick={() => setSection('referrals')}
                >
                    {t('medical_act.seg.referrals', 'Referrals')} ({referralCount})
                </button>
            </div>

            {/* ── Procedures section ── */}
            {section === 'procedures' && (
                <div className="tab-section">
                    <div className="tab-panel-header">
                        <h3>{t('medical_act.procedures.title', 'Procedures')} <span className="section-count">({procedureCount})</span></h3>
                        {(profile?.access_level ?? 1) >= 2 && (
                            <button
                                className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                                disabled={!canWrite}
                                title={!canWrite ? t('patient_record.read_only', 'Patient record is read-only') : undefined}
                                onClick={() => { if (canWrite) { setProcedureToEdit(null); setShowProcedureForm(true); } }}
                            >{t('medical_act.procedures.add', '+ Add Procedure')}</button>
                        )}
                    </div>
                    {proceduresLoading ? (
                        <TabSkeleton rows={4} />
                    ) : proceduresData.length > 0 ? (
                        <ul className="detail-list">
                            {proceduresData.map(p => (
                                <li key={p.id} className="procedure-entry detail-list-item">
                                    <h4>{p.procedure_type} — {formatDate(p.procedure_date)}</h4>
                                    {p.result && <div className="info-item"><strong>{t('medical_act.procedures.result', 'Result')}:</strong> {p.result}</div>}
                                    {p.attachments && (
                                        <button onClick={() => downloadFile(p.attachments, `procedure_${p.id}`)} className="download-link">{t('medical_act.procedures.download', 'Download attachment')}</button>
                                    )}
                                    <div className="entry-actions">
                                        <button onClick={() => { setProcedureToEdit(p); setShowProcedureForm(true); }} className="edit-button action-button">{t('common.edit', 'Edit')}</button>
                                        <button onClick={() => setConfirmDeleteProcedureId(p.id)} className="delete-button action-button">{t('common.delete', 'Delete')}</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="muted">{t('medical_act.procedures.none', 'No procedures recorded.')}</p>}
                </div>
            )}

            {/* ── Referrals section ── */}
            {section === 'referrals' && (
                <div className="tab-section">
                    <div className="tab-panel-header">
                        <h3>{t('medical_act.referrals.title', 'Referrals')} <span className="section-count">({referralCount})</span></h3>
                        <button
                            className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                            disabled={!canWrite}
                            title={!canWrite ? t('patient_record.read_only', 'Patient record is read-only') : undefined}
                            onClick={() => { if (canWrite) { setReferralToEdit(null); setShowReferralForm(true); } }}
                        >{t('medical_act.referrals.add', '+ Add Referral')}</button>
                    </div>
                    {referralsLoading ? (
                        <TabSkeleton rows={4} />
                    ) : referralsData.length > 0 ? (
                        <ul className="detail-list">
                            {referralsData.map(r => {
                                const isReferringDoctor = profile?.id === r.referred_by;
                                const isReceivingDoctor = profile?.id === r.referred_to;
                                const canSubmitResult = isReceivingDoctor && ['accepted', 'in_progress'].includes(r.status);
                                const canCancel = isReferringDoctor && ['pending', 'accepted'].includes(r.status);
                                const canRecall = isReferringDoctor && ['pending', 'accepted', 'in_progress', 'returned'].includes(r.status);
                                const canEdit = isReferringDoctor && ['draft', 'pending', 'returned'].includes(r.status);
                                const canDelete = isReferringDoctor && ['draft', 'pending', 'rejected', 'cancelled', 'recalled', 'expired'].includes(r.status);
                                const isReturnedToMe = isReferringDoctor && r.status === 'returned';
                                const showResultForm = resultFormReferralId === r.id;
                                const showCancelForm = cancelFormReferralId === r.id;
                                const showRecallForm = recallFormReferralId === r.id;
                                return (
                                    <li key={r.id} className="referral-entry detail-list-item">
                                        {r.sla_breached && (
                                            <div style={{ background: 'var(--color-danger-bg, #fef2f2)', color: 'var(--color-danger, #dc2626)', fontSize: '0.78rem', fontWeight: 600, padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                                                {t('medical_act.referrals.sla_breached', '⚠ SLA breached — response overdue')}
                                            </div>
                                        )}
                                        {isReturnedToMe && (
                                            <div style={{ background: 'var(--color-warning-bg, #fffbeb)', border: '1px solid var(--color-warning, #f59e0b)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.65rem', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                                                <strong>{t('medical_act.referrals.returned_title', 'Specialist returned for more information.')}</strong>
                                                {r.return_reason && <span> "{r.return_reason}"</span>}
                                                {r.return_requested_info && (
                                                    <div style={{ marginTop: '0.25rem' }}><strong>{t('medical_act.referrals.needs', 'Needs')}:</strong> {r.return_requested_info}</div>
                                                )}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <h4 style={{ margin: 0 }}>{formatDate(r.date_of_referral)}</h4>
                                                {r.is_draft && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('medical_act.referrals.draft', 'Draft')}</span>}
                                                {r.referral_type_display && (
                                                    <span style={{ fontSize: '0.72rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.1rem 0.4rem' }}>
                                                        {r.referral_type_display}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {r.sla_due_at && !r.sla_breached && r.urgency !== 'routine' && (
                                                    <ReferralSLABadge sla_due_at={r.sla_due_at} sla_breached={false} urgency={r.urgency} />
                                                )}
                                                <span className={`status-badge status-${r.status}`}>{r.status_display || r.status}</span>
                                            </div>
                                        </div>

                                        <div className="info-item"><strong>{t('medical_act.referrals.referred_by', 'Referred by')}:</strong> {r.referred_by_details?.full_name || '—'}</div>
                                        <div className="info-item"><strong>{t('medical_act.referrals.referred_to', 'Referred to')}:</strong> {r.referred_to_details?.full_name || (r.is_external ? `${r.external_doctor_name || t('medical_act.referrals.external', 'External')} · ${r.external_hospital}` : '—')}</div>
                                        <div className="info-item"><strong>{t('medical_act.referrals.specialty', 'Specialty')}:</strong> {r.specialty_display || r.specialty_requested}</div>
                                        <div className="info-item"><strong>{t('medical_act.referrals.urgency', 'Urgency')}:</strong> {r.urgency_display || r.urgency}</div>
                                        <div className="info-item"><strong>{t('medical_act.referrals.reason', 'Reason')}:</strong> {r.reason_for_referral}</div>
                                        {r.comments && <div className="info-item"><strong>{t('medical_act.referrals.note', 'Referral note')}:</strong> {r.comments}</div>}

                                        <div className="info-item" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                                            {r.accepted_at && <span>{t('medical_act.referrals.event.accepted', 'Accepted')} {formatDate(r.accepted_at)}</span>}
                                            {r.in_progress_at && <span>{t('medical_act.referrals.event.in_progress', 'In Progress')} {formatDate(r.in_progress_at)}</span>}
                                            {r.returned_at && <span>{t('medical_act.referrals.event.returned', 'Returned')} {formatDate(r.returned_at)}</span>}
                                            {r.completed_at && <span>{t('medical_act.referrals.event.completed', 'Completed')} {formatDate(r.completed_at)}</span>}
                                            {r.rejected_at && <span>{t('medical_act.referrals.event.rejected', 'Rejected')} {formatDate(r.rejected_at)}</span>}
                                            {r.cancelled_at && <span>{t('medical_act.referrals.event.cancelled', 'Cancelled')} {formatDate(r.cancelled_at)}</span>}
                                            {r.recalled_at && <span>{t('medical_act.referrals.event.recalled', 'Recalled')} {formatDate(r.recalled_at)}</span>}
                                            {r.expired_at && <span>{t('medical_act.referrals.event.expired', 'Expired')} {formatDate(r.expired_at)}</span>}
                                        </div>

                                        {r.response_notes && <div className="info-item"><strong>{t('medical_act.referrals.response_note', 'Response note')}:</strong> {r.response_notes}</div>}
                                        {r.cancellation_reason && <div className="info-item" style={{ color: 'var(--text-muted)' }}><strong>{t('medical_act.referrals.cancellation_reason', 'Cancellation reason')}:</strong> {r.cancellation_reason}</div>}
                                        {r.recall_reason && <div className="info-item" style={{ color: 'var(--text-muted)' }}><strong>{t('medical_act.referrals.recall_reason', 'Recall reason')}:</strong> {r.recall_reason}</div>}

                                        {r.result ? (
                                            <div className="info-item" style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '0.625rem 0.875rem', marginTop: '0.5rem' }}>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                                    {t('medical_act.referrals.specialist_result', 'Specialist Result')}
                                                    {r.result_submitted_at && <span style={{ fontWeight: 400, marginLeft: 6 }}>· {formatDate(r.result_submitted_at)}</span>}
                                                </div>
                                                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{r.result}</div>
                                            </div>
                                        ) : (
                                            canSubmitResult && !showResultForm && (
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>{t('medical_act.referrals.no_result', 'No result submitted yet.')}</p>
                                            )
                                        )}

                                        {canSubmitResult && (
                                            <div style={{ marginTop: '0.75rem' }}>
                                                {showResultForm ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <textarea
                                                            className="textarea"
                                                            rows={4}
                                                            placeholder={t('medical_act.referrals.result_placeholder', 'Clinical findings, diagnosis, recommendations…')}
                                                            value={resultText}
                                                            onChange={e => setResultText(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                                                            {t('medical_act.referrals.submit_completes', 'Submitting a result marks this referral as completed.')}
                                                        </p>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                disabled={!resultText.trim() || resultSubmitting}
                                                                onClick={async () => {
                                                                    setResultSubmitting(true);
                                                                    try {
                                                                        await api.post(`/referrals/${r.id}/result/`, { result: resultText.trim() });
                                                                        toast.success(t('medical_act.referrals.toast.result_ok', 'Result submitted. Referral marked as completed.'));
                                                                        setResultFormReferralId(null);
                                                                        setResultText('');
                                                                        queryClient.invalidateQueries({ queryKey: ['patients', id, 'referrals'] });
                                                                    } catch (err) {
                                                                        toast.error(parseApiError(err, t('medical_act.referrals.toast.result_fail', 'Could not submit result.')));
                                                                    } finally {
                                                                        setResultSubmitting(false);
                                                                    }
                                                                }}
                                                            >
                                                                {resultSubmitting ? t('medical_act.referrals.saving', 'Saving…') : t('medical_act.referrals.submit_complete', 'Submit & Complete')}
                                                            </button>
                                                            <button className="btn btn-ghost btn-sm" onClick={() => { setResultFormReferralId(null); setResultText(''); }}>
                                                                {t('common.cancel', 'Cancel')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => { setResultText(r.result || ''); setResultFormReferralId(r.id); }}
                                                    >
                                                        {r.result ? t('medical_act.referrals.update_result', '✎ Update Result') : t('medical_act.referrals.submit_result', '+ Submit Result')}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {canCancel && (
                                            <div style={{ marginTop: '0.75rem' }}>
                                                {showCancelForm ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <textarea
                                                            className="textarea"
                                                            rows={2}
                                                            placeholder={t('medical_act.referrals.cancel_placeholder', 'Cancellation reason (optional)…')}
                                                            value={cancelReason}
                                                            onChange={e => setCancelReason(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button
                                                                className="btn btn-sm"
                                                                style={{ background: 'var(--error)', color: '#fff', border: 'none' }}
                                                                disabled={cancelSubmitting}
                                                                onClick={async () => {
                                                                    setCancelSubmitting(true);
                                                                    try {
                                                                        await api.post(`/referrals/${r.id}/cancel/`, { reason: cancelReason.trim() });
                                                                        toast.success(t('medical_act.referrals.toast.cancel_ok', 'Referral cancelled.'));
                                                                        setCancelFormReferralId(null);
                                                                        setCancelReason('');
                                                                        queryClient.invalidateQueries({ queryKey: ['patients', id, 'referrals'] });
                                                                    } catch (err) {
                                                                        toast.error(parseApiError(err, t('medical_act.referrals.toast.cancel_fail', 'Could not cancel referral.')));
                                                                    } finally {
                                                                        setCancelSubmitting(false);
                                                                    }
                                                                }}
                                                            >
                                                                {cancelSubmitting ? t('medical_act.referrals.cancelling', 'Cancelling…') : t('medical_act.referrals.confirm_cancel', 'Confirm Cancel')}
                                                            </button>
                                                            <button className="btn btn-ghost btn-sm" onClick={() => { setCancelFormReferralId(null); setCancelReason(''); }}>
                                                                {t('medical_act.referrals.keep', 'Keep Referral')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ color: 'var(--error)' }}
                                                        onClick={() => setCancelFormReferralId(r.id)}
                                                    >
                                                        {t('medical_act.referrals.cancel_referral', 'Cancel Referral')}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {canRecall && !showCancelForm && (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                {showRecallForm ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <textarea
                                                            className="textarea"
                                                            rows={2}
                                                            placeholder={t('medical_act.referrals.recall_placeholder', 'Recall reason (optional)…')}
                                                            value={recallReason}
                                                            onChange={e => setRecallReason(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button
                                                                className="btn btn-sm"
                                                                style={{ background: 'var(--color-warning, #f59e0b)', color: '#fff', border: 'none' }}
                                                                disabled={recallSubmitting}
                                                                onClick={async () => {
                                                                    setRecallSubmitting(true);
                                                                    try {
                                                                        const { recallReferral: doRecall } = await import('../../../referrals/services/referralService');
                                                                        await doRecall(r.id, recallReason.trim() || undefined);
                                                                        toast.success(t('medical_act.referrals.toast.recall_ok', 'Referral recalled.'));
                                                                        setRecallFormReferralId(null);
                                                                        setRecallReason('');
                                                                        queryClient.invalidateQueries({ queryKey: ['patients', id, 'referrals'] });
                                                                    } catch (err) {
                                                                        toast.error(parseApiError(err, t('medical_act.referrals.toast.recall_fail', 'Could not recall referral.')));
                                                                    } finally {
                                                                        setRecallSubmitting(false);
                                                                    }
                                                                }}
                                                            >
                                                                {recallSubmitting ? t('medical_act.referrals.recalling', 'Recalling…') : t('medical_act.referrals.confirm_recall', 'Confirm Recall')}
                                                            </button>
                                                            <button className="btn btn-ghost btn-sm" onClick={() => { setRecallFormReferralId(null); setRecallReason(''); }}>
                                                                {t('medical_act.referrals.keep', 'Keep Referral')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ color: 'var(--color-warning, #b45309)' }}
                                                        onClick={() => setRecallFormReferralId(r.id)}
                                                    >
                                                        {t('medical_act.referrals.recall_referral', 'Recall Referral')}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {!r.is_draft && <ReferralSnapshotView referralId={r.id} />}
                                        <ReferralEventTimeline referralId={r.id} />

                                        {!r.is_draft && !r.is_external && (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                                                    onClick={() => setOpenThreadReferralId(openThreadReferralId === r.id ? null : r.id)}
                                                >
                                                    {openThreadReferralId === r.id ? t('medical_act.referrals.hide_messages', '▾ Hide Messages') : t('medical_act.referrals.messages', '▸ Messages')}
                                                </button>
                                                {openThreadReferralId === r.id && profile?.id !== undefined && (
                                                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                                                        <ReferralMessageThread referralId={r.id} currentDoctorId={profile.id} />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="entry-actions">
                                            {canEdit && (
                                                <button onClick={() => { setReferralToEdit(r); setShowReferralForm(true); }} className="edit-button action-button">{t('common.edit', 'Edit')}</button>
                                            )}
                                            {canDelete && (
                                                <button onClick={() => setConfirmDeleteReferralId(r.id)} className="delete-button action-button">{t('common.delete', 'Delete')}</button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : <p className="muted">{t('medical_act.referrals.none', 'No referrals recorded.')}</p>}
                </div>
            )}
        </div>
    );
};

export default MedicalActTab;
