import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import Modal from '../../../shared/components/ui/Modal';
import { toast, parseApiError } from '../../../shared/components/ui/toast';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';
import type { PatientLabResult } from '../services/patientPortalService';
import { formatPortalDate } from '../utils/i18n';

function ReviewBadge({ lab }: { lab: PatientLabResult }) {
    const { t } = useTranslation();
    if (!lab.submitted_by_patient) return null;
    const map = {
        pending_review: { labelKey: 'patient_portal.labs.review.pending_review', style: { background: 'var(--color-warning-light)', color: 'var(--color-warning-dark)', border: '1px solid var(--color-warning-border)' } },
        accepted: { labelKey: 'patient_portal.labs.review.accepted', style: { background: 'var(--color-success-light)', color: 'var(--color-success-dark)', border: '1px solid var(--color-success-border)' } },
        rejected: { labelKey: 'patient_portal.labs.review.rejected', style: { background: 'var(--color-danger-light)', color: 'var(--color-danger-dark)', border: '1px solid var(--color-danger-border)' } },
    } as const;
    const entry = map[lab.review_status as keyof typeof map];
    if (!entry) return null;
    return (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', whiteSpace: 'nowrap', ...entry.style }}>
            {t(entry.labelKey)}
        </span>
    );
}

const UPLOAD_FORM_EMPTY = { test_name: '', test_date: '', notes: '' };

export default function PatientLabs({ asTab = false }: { asTab?: boolean }) {
    const { t, i18n } = useTranslation();
    usePageTitle(t('patient_portal.labs.document_title'));

    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const highlightedId = searchParams.get('id') ? Number(searchParams.get('id')) : null;
    const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadForm, setUploadForm] = useState(UPLOAD_FORM_EMPTY);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [downloading, setDownloading] = useState<number | null>(null);

    const { data: labs = [], isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.labResults(),
        queryFn: patientPortalService.getLabResults,
        staleTime: 2 * 60_000,
    });

    useEffect(() => {
        if (highlightedId && !isLoading && labs.length > 0) {
            const el = cardRefs.current[highlightedId];
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [highlightedId, isLoading, labs.length]);

    async function handleDownload(labId: number, attId: number, currentUrl: string) {
        setDownloading(attId);
        try {
            const freshLab = await patientPortalService.getLabResult(labId);
            const freshAtt = freshLab.file_attachments?.find((a: { id: number }) => a.id === attId);
            window.open(freshAtt?.download_url ?? currentUrl, '_blank', 'noopener,noreferrer');
        } catch {
            window.open(currentUrl, '_blank', 'noopener,noreferrer');
        } finally {
            setDownloading(null);
        }
    }

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
            toast.success(t('patient_portal.labs.toast.uploaded'));
        },
        onError: (err) => toast.error(parseApiError(err, t('patient_portal.labs.error.upload'))),
    });

    function handleUploadSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!uploadFile) { toast.error(t('patient_portal.labs.error.select_file')); return; }
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
                {!asTab && <PageHeader title={t('patient_portal.labs.title')} subtitle="" />}
                <SectionCard title={t('patient_portal.common.loading')}><TabSkeleton rows={3} /></SectionCard>
            </>
        );
    }

    if (isError) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.labs.title')} subtitle="" />}
                <div className="error-message" style={{ margin: '1rem' }}>{t('patient_portal.labs.error.load')}</div>
            </>
        );
    }

    return (
        <>
            {asTab ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button className="btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
                        {t('patient_portal.labs.upload_action')}
                    </button>
                </div>
            ) : (
                <PageHeader
                    title={t('patient_portal.labs.title')}
                    subtitle={t('patient_portal.labs.subtitle')}
                    actions={
                        <button className="btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
                            {t('patient_portal.labs.upload_action')}
                        </button>
                    }
                />
            )}

            {labs.length === 0 && (
                <SectionCard empty={{ title: t('patient_portal.labs.empty_title'), subtitle: t('patient_portal.labs.empty_subtitle') }}>{null}</SectionCard>
            )}

            <div style={{ display: 'grid', gap: '1rem' }}>
                {labs.map(lab => {
                    const resultDisplay = lab.result_value
                        ? `${lab.result_value}${lab.unit ? ` ${lab.unit}` : ''}`
                        : lab.result_value_text ?? '—';
                    const isHighlighted = lab.id === highlightedId;

                    return (
                        <div key={lab.id} ref={el => { cardRefs.current[lab.id] = el; }} style={isHighlighted ? { outline: '2px solid var(--accent)', borderRadius: 'var(--radius-lg)' } : undefined}>
                        <SectionCard>
                            <div style={{ display: 'grid', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{lab.test_name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{formatPortalDate(lab.test_date, i18n.resolvedLanguage)}</div>
                                        {lab.submitted_by_patient && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                                                {t('patient_portal.labs.uploaded_by_you')}
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
                                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{t('patient_portal.labs.result')}</div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{resultDisplay}</div>
                                        </div>
                                        {lab.reference_range && (
                                            <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{t('patient_portal.labs.reference_range')}</div>
                                                <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{lab.reference_range}</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {lab.patient_note && (
                                    <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: lab.status === 'abnormal' || lab.status === 'critical' ? 'var(--color-warning-light)' : 'var(--color-info-light)' }}>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{t('patient_portal.labs.doctor_note')}</div>
                                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{lab.patient_note}</div>
                                    </div>
                                )}

                                {lab.submitted_by_patient && lab.review_status === 'rejected' && lab.rejection_reason && (
                                    <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)' }}>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{t('patient_portal.labs.rejection_reason')}</div>
                                        <div style={{ color: 'var(--color-danger-dark)', lineHeight: 1.6 }}>{lab.rejection_reason}</div>
                                    </div>
                                )}

                                {lab.file_attachments?.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{t('patient_portal.common.attachments')}</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {lab.file_attachments.map((att: { id: number; download_url?: string | null; original_filename?: string | null }) => (
                                                att.download_url ? (
                                                    <button
                                                        key={att.id}
                                                        type="button"
                                                        disabled={downloading === att.id}
                                                        onClick={() => handleDownload(lab.id, att.id, att.download_url!)}
                                                        style={{ fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                                    >
                                                        {downloading === att.id ? t('patient_portal.common.opening') : att.original_filename}
                                                    </button>
                                                ) : (
                                                    <span
                                                        key={att.id}
                                                        title={t('patient_portal.common.file_not_available')}
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
                        </div>
                    );
                })}
            </div>

            <Modal
                open={uploadOpen}
                onClose={closeUploadModal}
                title={t('patient_portal.labs.upload_title')}
                size="md"
                dirty={!!(uploadForm.test_name || uploadFile)}
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn-secondary" onClick={closeUploadModal}>
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            form="lab-upload-form"
                            className="btn-primary"
                            disabled={isUploading}
                        >
                            {isUploading ? t('patient_portal.labs.uploading') : t('patient_portal.labs.submit_for_review')}
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
                        <label className="form-label">{t('patient_portal.labs.test_name')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input
                            className="form-input"
                            required
                            value={uploadForm.test_name}
                            onChange={e => setUploadForm(p => ({ ...p, test_name: e.target.value }))}
                            placeholder={t('patient_portal.labs.test_name_placeholder')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('patient_portal.labs.test_date')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
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
                        <label className="form-label">{t('patient_portal.labs.notes_for_doctor')} {t('patient_portal.common.optional_parenthetical')}</label>
                        <textarea
                            className="form-input"
                            rows={3}
                            value={uploadForm.notes}
                            onChange={e => setUploadForm(p => ({ ...p, notes: e.target.value }))}
                            placeholder={t('patient_portal.labs.notes_placeholder')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('patient_portal.labs.document')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input
                            ref={fileInputRef}
                            className="form-input"
                            type="file"
                            required
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            {t('patient_portal.labs.file_hint')}
                        </div>
                    </div>
                </form>
            </Modal>
        </>
    );
}
