import { type LabResult } from '../../../../shared/types';
import { TabSkeleton } from '../../../../shared/components/SectionCard';
import AttachmentList from '../../../../shared/components/AttachmentList';

const LAB_STATUS_COLORS_MAP: Record<string, string> = {
    normal: '#38a169', abnormal: '#d69e2e', critical: '#e53e3e', pending: '#718096',
};

interface LabsTabProps {
    id: string;
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
    id,
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
    const pendingOrders = labOrders.filter(o => o.order_status !== 'cancelled' && o.order_status !== 'resulted');

    const renderLabRow = (lab: LabResult) => (
        <li key={lab.id} className="detail-list-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                    <strong>{lab.test_name}</strong>
                    <span style={{ marginLeft: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {new Date(lab.test_date).toLocaleDateString()}
                    </span>
                    {lab.submitted_by_patient && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: 'var(--color-info-light)', color: 'var(--color-info-dark)' }}>
                            Patient Upload
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {lab.submitted_by_patient && lab.review_status === 'pending_review' && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: 'var(--color-warning-light)', color: 'var(--color-warning-dark)', border: '1px solid var(--color-warning-border)' }}>
                            Pending Review
                        </span>
                    )}
                    {lab.submitted_by_patient && lab.review_status === 'accepted' && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: 'var(--color-success-light)', color: 'var(--color-success-dark)', border: '1px solid var(--color-success-border)' }}>
                            Accepted
                        </span>
                    )}
                    {lab.submitted_by_patient && lab.review_status === 'rejected' && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: 'var(--color-danger-light)', color: 'var(--color-danger-dark)', border: '1px solid var(--color-danger-border)' }}>
                            Rejected
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
                    <strong>Result:</strong> {lab.result_value} {lab.unit}
                    {lab.reference_range && <span className="muted" style={{ marginLeft: '8px' }}>Ref: {lab.reference_range}</span>}
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
                        Review
                    </button>
                )}
                {!lab.submitted_by_patient && (
                    <>
                        <button onClick={() => {
                            setEditingLabId(lab.id);
                            setLabForm({ test_name: lab.test_name, test_date: lab.test_date, result_value: lab.result_value, unit: lab.unit, reference_range: lab.reference_range, status: lab.status, notes: lab.notes });
                            setShowLabForm(true);
                        }} className="edit-button action-button">Edit</button>
                        <button onClick={() => setConfirmDeleteLabId(lab.id)} className="delete-button action-button">Delete</button>
                        <button
                            onClick={() => setPreviewLabId(lab.id)}
                            className="action-button"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            Preview as patient
                        </button>
                        <button
                            onClick={() => { setShareLabId(lab.id); setShareLabNote(lab.patient_note || ''); }}
                            className="action-button"
                            style={{ color: lab.visible_to_patient ? 'var(--success)' : 'var(--accent)' }}
                        >
                            {lab.visible_to_patient ? '✓ Released' : 'Release to patient'}
                        </button>
                    </>
                )}
            </div>
        </li>
    );

    return (
        <div className="tab-panel">
            <div className="tab-panel-header">
                <h3>Labs</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div className="view-toggle">
                        <button type="button" className={`view-toggle-btn${labSubTab === 'results' ? ' active' : ''}`} onClick={() => setLabSubTab('results')}>Results</button>
                        <button type="button" className={`view-toggle-btn${labSubTab === 'orders' ? ' active' : ''}`} onClick={() => setLabSubTab('orders')}>
                            Orders {labOrders.filter(o => o.order_status !== 'cancelled' && o.order_status !== 'resulted').length > 0 && (
                                <span style={{ marginLeft: '4px', background: 'var(--accent)', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '11px' }}>
                                    {labOrders.filter(o => o.order_status !== 'cancelled' && o.order_status !== 'resulted').length}
                                </span>
                            )}
                        </button>
                    </div>
                    {labSubTab === 'results' && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div className="view-toggle">
                                <button type="button" className={`view-toggle-btn${!showUnreleasedOnly ? ' active' : ''}`} onClick={() => setShowUnreleasedOnly(false)}>All</button>
                                <button type="button" className={`view-toggle-btn${showUnreleasedOnly ? ' active' : ''}`} onClick={() => setShowUnreleasedOnly(true)}>
                                    Unreleased {!showUnreleasedOnly && labResults.filter(l => !l.submitted_by_patient && !l.visible_to_patient).length > 0 && (
                                        <span style={{ marginLeft: '4px', background: 'var(--accent)', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '11px' }}>
                                            {labResults.filter(l => !l.submitted_by_patient && !l.visible_to_patient).length}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <button
                                className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                                disabled={!canWrite}
                                title={!canWrite ? 'Patient record is read-only' : undefined}
                                onClick={() => {
                                    if (!canWrite) return;
                                    setEditingLabId(null);
                                    setLabForm({ test_name: '', test_date: '', result_value: '', unit: '', reference_range: '', status: 'pending', notes: '' });
                                    setShowLabForm(true);
                                }}
                            >+ Add Result</button>
                        </div>
                    )}
                    {labSubTab === 'orders' && (
                        <button
                            className={`btn-add-primary${!canWrite ? ' strip-btn--disabled' : ''}`}
                            disabled={!canWrite}
                            title={!canWrite ? 'Patient record is read-only' : undefined}
                            onClick={() => { if (!canWrite) return; setShowLabOrderForm(true); }}
                        >+ Add Order</button>
                    )}
                </div>
            </div>

            {/* Lab Orders sub-tab */}
            {labSubTab === 'orders' && (
                <>
                    {pendingOrders.length > 0 && (
                        <div className="pt-draft-notice">
                            {pendingOrders.length} pending lab order{pendingOrders.length > 1 ? 's' : ''} awaiting results.
                        </div>
                    )}
                    {showLabOrderForm && (
                        <form onSubmit={handleLabOrderSubmit} className="inline-form" style={{ marginBottom: 'var(--space-4)' }}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Test Name *</label>
                                    <input required value={labOrderForm.test_name} onChange={e => setLabOrderForm((p: any) => ({ ...p, test_name: e.target.value }))} placeholder="e.g. CBC, HbA1c" />
                                </div>
                                <div className="form-group">
                                    <label>Order Date *</label>
                                    <input type="date" required value={labOrderForm.order_date} onChange={e => setLabOrderForm((p: any) => ({ ...p, order_date: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Priority</label>
                                    <select value={labOrderForm.priority} onChange={e => setLabOrderForm((p: any) => ({ ...p, priority: e.target.value }))}>
                                        <option value="routine">Routine</option>
                                        <option value="urgent">Urgent</option>
                                        <option value="stat">STAT</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <input value={labOrderForm.notes} onChange={e => setLabOrderForm((p: any) => ({ ...p, notes: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="submit" disabled={labOrderFormLoading}>{labOrderFormLoading ? 'Saving...' : 'Save Order'}</button>
                                <button type="button" onClick={() => setShowLabOrderForm(false)} className="cancel-button">Cancel</button>
                            </div>
                        </form>
                    )}
                    {labOrdersLoading ? <TabSkeleton rows={3} /> : labOrders.length === 0 ? (
                        <p className="muted">No lab orders on record.</p>
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
                                            <button className="btn-secondary btn-sm" onClick={() => handleCancelLabOrder(order.id)}>Cancel</button>
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
                                <label>Test Name *</label>
                                <input required value={labForm.test_name} onChange={e => setLabForm((p: any) => ({ ...p, test_name: e.target.value }))} placeholder="e.g. CBC, HbA1c, TSH" />
                            </div>
                            <div className="form-group">
                                <label>Date *</label>
                                <input type="date" required value={labForm.test_date} onChange={e => setLabForm((p: any) => ({ ...p, test_date: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Result Value</label>
                                <input value={labForm.result_value} onChange={e => setLabForm((p: any) => ({ ...p, result_value: e.target.value }))} placeholder="e.g. 5.4" />
                            </div>
                            <div className="form-group">
                                <label>Unit</label>
                                <input value={labForm.unit} onChange={e => setLabForm((p: any) => ({ ...p, unit: e.target.value }))} placeholder="e.g. mmol/L, g/dL" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Reference Range</label>
                                <input value={labForm.reference_range} onChange={e => setLabForm((p: any) => ({ ...p, reference_range: e.target.value }))} placeholder="e.g. 3.5–5.5" />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select value={labForm.status} onChange={e => setLabForm((p: any) => ({ ...p, status: e.target.value }))}>
                                    <option value="pending">Pending</option>
                                    <option value="normal">Normal</option>
                                    <option value="abnormal">Abnormal</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Notes</label>
                            <textarea rows={2} value={labForm.notes} onChange={e => setLabForm((p: any) => ({ ...p, notes: e.target.value }))} />
                        </div>
                        <div className="form-actions">
                            <button type="submit" disabled={labFormLoading}>{labFormLoading ? 'Saving...' : (editingLabId ? 'Update' : 'Save')}</button>
                            <button type="button" onClick={() => setShowLabForm(false)} className="cancel-button">Cancel</button>
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
                        return <p className="muted">{showUnreleasedOnly ? 'No unreleased lab results.' : 'No lab results recorded.'}</p>;
                    }
                    return (
                        <>
                            {!showUnreleasedOnly && (() => {
                                const pending = filteredLabs.filter(l => l.submitted_by_patient && l.review_status === 'pending_review');
                                if (!pending.length) return null;
                                return (
                                    <div className="pending-review-section">
                                        <div className="pending-review-header">⏳ Needs Review ({pending.length})</div>
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
