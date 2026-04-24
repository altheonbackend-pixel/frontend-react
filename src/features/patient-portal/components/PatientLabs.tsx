import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import Modal from '../../../shared/components/ui/Modal';
import { toast, parseApiError } from '../../../shared/components/ui/toast';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import type { PatientLabResult } from '../services/patientPortalService';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

function ReviewBadge({ lab }: { lab: PatientLabResult }) {
    if (!lab.submitted_by_patient) return null;
    const map = {
        pending_review: { label: 'Pending review', style: { background: 'var(--color-warning-light)', color: 'var(--color-warning-dark)', border: '1px solid var(--color-warning-border)' } },
        accepted: { label: 'Accepted', style: { background: 'var(--color-success-light)', color: 'var(--color-success-dark)', border: '1px solid var(--color-success-border)' } },
        rejected: { label: 'Rejected', style: { background: 'var(--color-danger-light)', color: 'var(--color-danger-dark)', border: '1px solid var(--color-danger-border)' } },
    } as const;
    const entry = map[lab.review_status as keyof typeof map];
    if (!entry) return null;
    return (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', whiteSpace: 'nowrap', ...entry.style }}>
            {entry.label}
        </span>
    );
}

const UPLOAD_FORM_EMPTY = { test_name: '', test_date: '', notes: '' };

export default function PatientLabs({ asTab = false }: { asTab?: boolean }) {
    usePageTitle('Patient Labs');

    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadForm, setUploadForm] = useState(UPLOAD_FORM_EMPTY);
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    const { data: labs = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.labResults(),
        queryFn: patientPortalService.getLabResults,
        staleTime: 2 * 60_000,
    });

    const { mutate: uploadLab, isPending: isUploading } = useMutation({
        mutationFn: () => {
            const fd = new FormData();
            fd.append('test_name', uploadForm.test_name);
            fd.append('test_date', uploadForm.test_date);
            if (uploadForm.notes) fd.append('notes', uploadForm.notes);
            fd.append('file', uploadFile!);
            return patientPortalService.uploadLabResult(fd);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.labResults() });
            setUploadOpen(false);
            setUploadForm(UPLOAD_FORM_EMPTY);
            setUploadFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            toast.success('Lab document uploaded. Your doctor will review it shortly.');
        },
        onError: (err) => toast.error(parseApiError(err, 'Failed to upload lab document.')),
    });

    function handleUploadSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!uploadFile) { toast.error('Please select a file to upload.'); return; }
        uploadLab();
    }

    function closeUploadModal() {
        setUploadOpen(false);
        setUploadForm(UPLOAD_FORM_EMPTY);
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    if (isLoading) {
        return (
            <>
                {!asTab && <PageHeader title="Lab results" subtitle="" />}
                <SectionCard title="Loading…"><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                {!asTab && <PageHeader title="Lab results" subtitle="" />}
                <div className="error-message" style={{ margin: '1rem' }}>Failed to load lab results. Please refresh.</div>
            </>
        );
    }

    return (
        <>
            {asTab ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button className="btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
                        + Upload Lab Document
                    </button>
                </div>
            ) : (
                <PageHeader
                    title="Lab results"
                    subtitle="Lab results shared by your doctor, and documents you've uploaded for review."
                    actions={
                        <button className="btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
                            + Upload Lab Document
                        </button>
                    }
                />
            )}

            {labs.length === 0 && (
                <SectionCard empty={{ title: 'No lab results yet', subtitle: 'Lab results shared by your doctor will appear here. You can also upload your own documents above.' }}>{null}</SectionCard>
            )}

            <div style={{ display: 'grid', gap: '1rem' }}>
                {labs.map(lab => {
                    const resultDisplay = lab.result_value
                        ? `${lab.result_value}${lab.unit ? ` ${lab.unit}` : ''}`
                        : lab.result_value_text ?? '—';

                    return (
                        <SectionCard key={lab.id}>
                            <div style={{ display: 'grid', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{lab.test_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{formatDate(lab.test_date)}</div>
                                        {lab.submitted_by_patient && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                                                Uploaded by you
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <ReviewBadge lab={lab} />
                                        {!lab.submitted_by_patient && <StatusBadge status={lab.status} />}
                                    </div>
                                </div>

                                {!lab.submitted_by_patient && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                                        <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Result</div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{resultDisplay}</div>
                                        </div>
                                        {lab.reference_range && (
                                            <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Reference range</div>
                                                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{lab.reference_range}</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {lab.patient_note && (
                                    <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: lab.status === 'abnormal' || lab.status === 'critical' ? 'var(--color-warning-light)' : 'var(--color-info-light)' }}>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Doctor note</div>
                                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{lab.patient_note}</div>
                                    </div>
                                )}

                                {lab.submitted_by_patient && lab.review_status === 'rejected' && lab.rejection_reason && (
                                    <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)' }}>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Rejection reason</div>
                                        <div style={{ color: 'var(--color-danger-dark)', lineHeight: 1.6 }}>{lab.rejection_reason}</div>
                                    </div>
                                )}

                                {lab.file_attachments?.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Attachments</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {lab.file_attachments.map(att => (
                                                att.download_url ? (
                                                    <a
                                                        key={att.id}
                                                        href={att.download_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'underline' }}
                                                    >
                                                        {att.original_filename}
                                                    </a>
                                                ) : (
                                                    <span
                                                        key={att.id}
                                                        title="File not available"
                                                        style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'line-through', cursor: 'not-allowed' }}
                                                    >
                                                        {att.original_filename}
                                                    </span>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </SectionCard>
                    );
                })}
            </div>

            <Modal
                open={uploadOpen}
                onClose={closeUploadModal}
                title="Upload Lab Document"
                size="md"
                dirty={!!(uploadForm.test_name || uploadFile)}
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn-secondary" onClick={closeUploadModal}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="lab-upload-form"
                            className="btn-primary"
                            disabled={isUploading}
                        >
                            {isUploading ? 'Uploading…' : 'Submit for review'}
                        </button>
                    </div>
                }
            >
                <form
                    id="lab-upload-form"
                    onSubmit={handleUploadSubmit}
                    style={{ display: 'grid', gap: '1rem' }}
                >
                    <div className="form-group">
                        <label className="form-label">Test name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input
                            className="form-input"
                            required
                            value={uploadForm.test_name}
                            onChange={e => setUploadForm(p => ({ ...p, test_name: e.target.value }))}
                            placeholder="e.g. CBC, HbA1c, TSH, Lipid panel"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Test date <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input
                            className="form-input"
                            type="date"
                            required
                            value={uploadForm.test_date}
                            onChange={e => setUploadForm(p => ({ ...p, test_date: e.target.value }))}
                            max={new Date().toISOString().slice(0, 10)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notes for your doctor (optional)</label>
                        <textarea
                            className="form-input"
                            rows={3}
                            value={uploadForm.notes}
                            onChange={e => setUploadForm(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Any context your doctor should know…"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Document <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input
                            ref={fileInputRef}
                            className="form-input"
                            type="file"
                            required
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            PDF, JPEG, PNG, or WebP — max 10 MB
                        </div>
                    </div>
                </form>
            </Modal>
        </>
    );
}
