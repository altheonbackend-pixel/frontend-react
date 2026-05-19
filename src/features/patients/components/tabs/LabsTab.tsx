import { type LabResult } from '../../../../shared/types';
import { useTranslation } from 'react-i18next';
import { TabSkeleton } from '../../../../shared/components/SectionCard';
import AttachmentList from '../../../../shared/components/AttachmentList';
import { useFormatDateTime } from '../../../../shared/hooks/useUserTimezone';

const LAB_STATUS_COLORS_MAP: Record<string, string> = {
    normal: '#38a169', abnormal: '#d69e2e', critical: '#e53e3e', pending: '#718096',
};

interface LabsTabProps {
    labResults: LabResult[];
    labsLoading: boolean;
    labOrders: any[];
    labOrdersLoading: boolean;
    labSubTab: 'orders' | 'results';
    setLabSubTab: (v: 'orders' | 'results') => void;
    showUnreleasedOnly: boolean;
    setShowUnreleasedOnly: (v: boolean) => void;
    showLabForm: boolean;
    setShowLabForm: (v: boolean) => void;
    editingLabId: number | null;
    setEditingLabId: (id: number | null) => void;
    labForm: { test_name: string; test_date: string; result_value: string; unit: string; reference_range: string; status: string; notes: string };
    setLabForm: (f: any) => void;
    labFormLoading: boolean;
    handleLabSubmit: (e: React.FormEvent) => void;
    showLabOrderForm: boolean;
    setShowLabOrderForm: (v: boolean) => void;
    labOrderForm: { test_name: string; order_date: string; priority: string; notes: string };
    setLabOrderForm: (f: any) => void;
    labOrderFormLoading: boolean;
    handleLabOrderSubmit: (e: React.FormEvent) => void;
    handleCancelLabOrder: (id: number) => void;
    canWrite: boolean;
    setConfirmDeleteLabId: (id: number | null) => void;
    setReviewLabId: (id: number | null) => void;
    setReviewAction: (a: 'accept' | 'reject') => void;
    setReviewRejectionReason: (r: string) => void;
    setShareLabId: (id: number | null) => void;
    setShareLabNote: (n: string) => void;
    setPreviewLabId: (id: number | null) => void;
}

const LabsTab = ({
    labResults,
    labsLoading,
    labOrders,
    labOrdersLoading,
    labSubTab,
    setLabSubTab,
    showUnreleasedOnly,
    setShowUnreleasedOnly,
    showLabForm,
    setShowLabForm,
    editingLabId,
    setEditingLabId,
    labForm,
    setLabForm,
    labFormLoading,
    handleLabSubmit,
    showLabOrderForm,
    setShowLabOrderForm,
    labOrderForm,
    setLabOrderForm,
    labOrderFormLoading,
    handleLabOrderSubmit,
    handleCancelLabOrder,
    canWrite,
    setConfirmDeleteLabId,
    setReviewLabId,
    setReviewAction,
    setReviewRejectionReason,
    setShareLabId,
    setShareLabNote,
    setPreviewLabId,
}: LabsTabProps) => {
    const { t } = useTranslation();
    const { formatDate } = useFormatDateTime();
    const pendingOrders = labOrders.filter(o => o.order_status !== 'cancelled' && o.order_status !== 'resulted');

    const renderLabRow = (lab: LabResult) => (
        <li key={lab.id} className="detail-list-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                    <strong>{lab.test_name}</strong>
                    <span style={{ marginLeft: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {formatDate(lab.test_date)}
                    </span>
                    {lab.submitted_by_patient && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: 'var(--color-info-light)', color: 'var(--color-info-dark)' }}>
                            {t('patient_record.labs.patient_upload')}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {lab.submitted_by_patient && lab.review_status === 'pending_review' && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: 'var(--color-warning-light)', color: 'var(--color-warning-dark)', border: '1px solid var(--color-warning-border)' }}>
                            {t('patient_record.labs.pending_review')}
                        </span>
                    )}
                    {lab.submitted_by_patient && lab.review_status === 'accepted' && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: 'var(--color-success-light)', color: 'var(--color-success-dark)', border: '1px solid var(--color-success-border)' }}>
                            {t('common.status.accepted')}
                        </span>
                    )}
                    {lab.submitted_by_patient && lab.review_status === 'rejected' && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: 'var(--color-danger-light)', color: 'var(--color-danger-dark)', border: '1px solid var(--color-danger-border)' }}>
                            {t('common.status.rejected')}
                        </span>
                    )}
                    {!lab.submitted_by_patient && (
                        <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px',
                            background: LAB_STATUS_COLORS_MAP[lab.status] + '22',
                            color: LAB_STATUS_COLORS_MAP[lab.status],
                            border: `1px solid ${LAB_STATUS_COLORS_MAP[lab.status]}`,
                        }}>
                            {lab.status_display || lab.status}
                        </span>
                    )}
                </div>
            </div>
            {!lab.submitted_by_patient && (lab.result_value || lab.unit) && (
                <div className="info-item">
                    <strong>{t('consultation.view.result')}:</strong> {lab.result_value} {lab.unit}
                    {lab.reference_range && <span className="muted" style={{ marginLeft: '8px' }}>{t('patient_record.labs.ref_range_short', { range: lab.reference_range })}</span>}
                </div>
            )}
            {lab.notes && <p className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>{lab.notes}</p>}
            {lab.file_attachments && lab.file_attachments.length > 0 && (
                <AttachmentList attachments={lab.file_attachments} />
            )}
            <div className="entry-actions">
                {lab.submitted_by_patient && lab.review_status === 'pending_review' && (
                    <button
                        onClick={() => { setReviewLabId(lab.id); setReviewAction('accept'); setReviewRejectionReason(''); }}
                        className="action-button"
                        style={{ color: 'var(--accent)', fontWeight: 600 }}
                    >
                        {t('patient_record.labs.review')}
                    </button>
                )}
                {!lab.submitted_by_patient && (
                    <>
                        <button onClick={() => {
                            setEditingLabId(lab.id);
                            setLabForm({ test_name: lab.test_name, test_date: lab.test_date, result_value: lab.result_value, unit: lab.unit, reference_range: lab.reference_range, status: lab.status, notes: lab.notes });
                            setShowLabForm(true);
                        }} className="edit-button action-button">{t('common.edit')}</button>
                        <button onClick={() => setConfirmDeleteLabId(lab.id)} className="delete-button action-button">{t('common.delete')}</button>
                        <button
                            onClick={() => setPreviewLabId(lab.id)}
                            className="action-button"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            {t('patient_record.labs.preview_as_patient')}
                        </button>
                        <button
                            onClick={() => { setShareLabId(lab.id); setShareLabNote(lab.patient_note || ''); }}
                            className="action-button"
                            style={{ color: lab.visible_to_patient ? 'var(--success)' : 'var(--accent)' }}
                        >
                            {lab.visible_to_patient ? t('patient_record.labs.released') : t('patient_record.labs.release_to_patient')}
                        </button>
                    </>
                )}
            </div>
        </li>
    );

    return (
        <div className="tab-panel">
            <div className="tab-panel-header">
                <h3>{t('patient_record.labs.title')}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div className="view-toggle">
                        <button type="button" className={`view-toggle-btn${labSubTab === 'results' ? ' active' : ''}`} onClick={() => setLabSubTab('results')}>{t('patient_record.labs.results')}</button>
                        <button type="button" className={`view-toggle-btn${labSubTab === 'orders' ? ' active' : ''}`} onClick={() => setLabSubTab('orders')}>
                            {t('patient_record.labs.orders')} {labOrders.filter(o => o.order_status !== 'cancelled' && o.order_status !== 'resulted').length > 0 && (
                                <span style={{ marginLeft: '4px', background: 'var(--accent)', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '11px' }}>
                                    {labOrders.filter(o => o.order_status !== 'cancelled' && o.order_status !== 'resulted').length}
                                </span>
                            )}
                        </button>
                    </div>
                    {labSubTab === 'results' && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div className="view-toggle">
                                <button type="button" className={`view-toggle-btn${!showUnreleasedOnly ? ' active' : ''}`} onClick={() => setShowUnreleasedOnly(false)}>{t('patient_record.medications.all_filter')}</button>
                                <button type="button" className={`view-toggle-btn${showUnreleasedOnly ? ' active' : ''}`} onClick={() => setShowUnreleasedOnly(true)}>
                                    {t('patient_record.labs.unreleased')} {!showUnreleasedOnly && labResults.filter(l => !l.submitted_by_patient && !l.visible_to_patient).length > 0 && (
                                        <span style={{ marginLeft: '4px', background: 'var(--accent)', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '11px' }}>
                                            {labResults.filter(l => !l.submitted_by_patient && !l.visible_to_patient).length}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <button
                                className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                                disabled={!canWrite}
                                title={!canWrite ? t('patient_record.read_only') : undefined}
                                onClick={() => {
                                    if (!canWrite) return;
                                    setEditingLabId(null);
                                    setLabForm({ test_name: '', test_date: '', result_value: '', unit: '', reference_range: '', status: 'pending', notes: '' });
                                    setShowLabForm(true);
                                }}
                            >{t('patient_record.labs.add_result')}</button>
                        </div>
                    )}
                    {labSubTab === 'orders' && (
                        <button
                            className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                            disabled={!canWrite}
                            title={!canWrite ? t('patient_record.read_only') : undefined}
                            onClick={() => { if (!canWrite) return; setShowLabOrderForm(true); }}
                        >{t('patient_record.labs.add_order')}</button>
                    )}
                </div>
            </div>

            {/* Lab Orders sub-tab */}
            {labSubTab === 'orders' && (
                <>
                    {pendingOrders.length > 0 && (
                        <div className="pt-draft-notice">
                            {t('patient_record.labs.pending_orders_notice', { count: pendingOrders.length })}
                        </div>
                    )}
                    {showLabOrderForm && (
                        <form onSubmit={handleLabOrderSubmit} className="inline-form" style={{ marginBottom: 'var(--space-4)' }}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('patient_record.labs.test_name_required')}</label>
                                    <input required value={labOrderForm.test_name} onChange={e => setLabOrderForm((p: any) => ({ ...p, test_name: e.target.value }))} placeholder={t('patient_record.labs.order_test_placeholder')} />
                                </div>
                                <div className="form-group">
                                    <label>{t('patient_record.labs.order_date_required')}</label>
                                    <input type="date" required value={labOrderForm.order_date} onChange={e => setLabOrderForm((p: any) => ({ ...p, order_date: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('patient_record.labs.priority')}</label>
                                    <select value={labOrderForm.priority} onChange={e => setLabOrderForm((p: any) => ({ ...p, priority: e.target.value }))}>
                                        <option value="routine">{t('common.status.routine')}</option>
                                        <option value="urgent">{t('common.status.urgent')}</option>
                                        <option value="stat">STAT</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t('consultation.notes_optional_placeholder')}</label>
                                    <input value={labOrderForm.notes} onChange={e => setLabOrderForm((p: any) => ({ ...p, notes: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" disabled={labOrderFormLoading}>{labOrderFormLoading ? t('common.saving') : t('patient_record.labs.save_order')}</button>
                                <button type="button" onClick={() => setShowLabOrderForm(false)} className="cancel-button">{t('common.cancel')}</button>
                            </div>
                        </form>
                    )}
                    {labOrdersLoading ? <TabSkeleton rows={3} /> : labOrders.length === 0 ? (
                        <p className="muted">{t('patient_record.labs.no_orders')}</p>
                    ) : (
                        <ul className="detail-list">
                            {labOrders.map(order => (
                                <li key={order.id} className="detail-list-item">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <div>
                                            <strong>{order.test_name}</strong>
                                            <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{order.order_date}</span>
                                            <span style={{ marginLeft: 8, fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: order.order_status === 'resulted' ? 'var(--success-bg)' : order.order_status === 'cancelled' ? 'var(--error-bg)' : 'var(--warning-bg)' }}>{order.order_status_display || order.order_status}</span>
                                            {order.priority !== 'routine' && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--warning)' }}>{order.priority_display || order.priority}</span>}
                                        </div>
                                        {order.order_status !== 'cancelled' && order.order_status !== 'resulted' && canWrite && (
                                            <button className="btn-secondary btn-sm" onClick={() => handleCancelLabOrder(order.id)}>{t('common.cancel')}</button>
                                        )}
                                    </div>
                                    {order.notes && <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.notes}</p>}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {/* Lab Results sub-tab */}
            {labSubTab === 'results' && (<>
                {showLabForm && (
                    <form onSubmit={handleLabSubmit} className="inline-form" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('patient_record.labs.test_name_required')}</label>
                                <input required value={labForm.test_name} onChange={e => setLabForm((p: any) => ({ ...p, test_name: e.target.value }))} placeholder={t('patient_record.labs.result_test_placeholder')} />
                            </div>
                            <div className="form-group">
                                <label>{t('patient_record.labs.date_required')}</label>
                                <input type="date" required value={labForm.test_date} onChange={e => setLabForm((p: any) => ({ ...p, test_date: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('patient_record.labs.result_value')}</label>
                                <input value={labForm.result_value} onChange={e => setLabForm((p: any) => ({ ...p, result_value: e.target.value }))} placeholder={t('patient_record.labs.result_value_placeholder')} />
                            </div>
                            <div className="form-group">
                                <label>{t('patient_record.labs.unit')}</label>
                                <input value={labForm.unit} onChange={e => setLabForm((p: any) => ({ ...p, unit: e.target.value }))} placeholder={t('patient_record.labs.unit_placeholder')} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('patient_record.labs.reference_range')}</label>
                                <input value={labForm.reference_range} onChange={e => setLabForm((p: any) => ({ ...p, reference_range: e.target.value }))} placeholder={t('patient_record.labs.reference_range_placeholder')} />
                            </div>
                            <div className="form-group">
                                <label>{t('profile.activity.status')}</label>
                                <select value={labForm.status} onChange={e => setLabForm((p: any) => ({ ...p, status: e.target.value }))}>
                                    <option value="pending">{t('common.status.pending')}</option>
                                    <option value="normal">{t('common.status.normal')}</option>
                                    <option value="abnormal">{t('common.status.abnormal')}</option>
                                    <option value="critical">{t('common.status.critical')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>{t('consultation.notes_optional_placeholder')}</label>
                            <textarea rows={2} value={labForm.notes} onChange={e => setLabForm((p: any) => ({ ...p, notes: e.target.value }))} />
                        </div>
                        <div className="form-actions">
                            <button type="submit" disabled={labFormLoading}>{labFormLoading ? t('common.saving') : (editingLabId ? t('referrals.form.submit_edit') : t('common.save'))}</button>
                            <button type="button" onClick={() => setShowLabForm(false)} className="cancel-button">{t('common.cancel')}</button>
                        </div>
                    </form>
                )}
                {labsLoading ? (
                    <TabSkeleton rows={3} />
                ) : (() => {
                    const filteredLabs = showUnreleasedOnly
                        ? labResults.filter(l => !l.submitted_by_patient && !l.visible_to_patient)
                        : labResults;
                    if (filteredLabs.length === 0) {
                        return <p className="muted">{showUnreleasedOnly ? t('patient_record.labs.no_unreleased') : t('patient_record.labs.no_results')}</p>;
                    }
                    return (
                        <>
                            {!showUnreleasedOnly && (() => {
                                const pending = filteredLabs.filter(l => l.submitted_by_patient && l.review_status === 'pending_review');
                                if (!pending.length) return null;
                                return (
                                    <div className="pending-review-section">
                                        <div className="pending-review-header">{t('patient_record.labs.needs_review', { count: pending.length })}</div>
                                        <ul className="detail-list" style={{ margin: 0 }}>
                                            {pending.map(lab => renderLabRow(lab))}
                                        </ul>
                                    </div>
                                );
                            })()}
                            <ul className="detail-list">
                                {filteredLabs
                                    .filter(l => showUnreleasedOnly || !(l.submitted_by_patient && l.review_status === 'pending_review'))
                                    .map(lab => renderLabRow(lab))}
                            </ul>
                        </>
                    );
                })()}
            </>)}
        </div>
    );
};

export default LabsTab;
