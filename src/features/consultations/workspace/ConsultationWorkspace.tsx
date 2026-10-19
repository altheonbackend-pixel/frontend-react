// Full-page consultation workspace (S1, Concept A v2).
// Replaces the side drawer: one scrolling note with a fixed patient bar,
// a progress strip, inline vital acknowledgement, orders with safety checks,
// a patient preview, review-and-sign and an after-sign panel.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../../shared/services/api';
import { toast, parseApiError } from '../../../shared/components/ui';
import Dialog from '../../../shared/components/ui/Dialog';
import { useAuth } from '../../auth/hooks/useAuth';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';
import { useNavigationBlocker } from '../../../shared/hooks/useNavigationBlocker';
import { VITAL_ALERT_PREFIX, type VitalAlert } from '../vitals';
import {
    alertSignature, alertsFor, canSign, diffAgainstSnapshot, emptyValues, fromConsultation, isEditableStatus,
    readiness, sectionDone, toPayload, type ConsultationDTO, type WorkspaceValues,
} from './model';
import { consultationKey, useInvalidateConsultation, useWorkspaceData } from './useWorkspaceData';
import {
    AcknowledgeSheet, ContextPanel, DiagnosisPicker, PatientBar, PatientPreview, ProgressStrip, Section,
    SoapField, VitalsGrid, Was,
} from './sections';
import { Icon } from './icons';
import { useSmartPhrases } from './helpers';
import { OrdersSection } from './OrdersSection';
import { HelpText } from './help';
import { AfterSign, NoteHistory, SignReview } from './flow';
import './workspace.css';

type SaveState = { state: 'idle' | 'saving' | 'saved' | 'error' | 'waiting'; at?: string };

const AUTOSAVE_MS = 1500;

export default function ConsultationWorkspace() {
    const { id: patientId = '', consultationId: rawId } = useParams();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const { t, i18n } = useTranslation();
    const { profile } = useAuth();
    const { toIsoDateInTz, formatTime, formatDateLong } = useFormatDateTime();
    const today = toIsoDateInTz(new Date());

    const routeId = rawId && rawId !== 'new' ? Number(rawId) : null;
    const idRef = useRef<number | null>(routeId);
    useEffect(() => { idRef.current = routeId; }, [routeId]);

    const { patient, consultation, visits, meds, alerts, labs } = useWorkspaceData(patientId, routeId);
    const invalidate = useInvalidateConsultation(patientId);
    const c = consultation.data;

    const form = useForm<WorkspaceValues>({ defaultValues: emptyValues(today) });
    const { register, reset, watch, setValue, getValues } = form;
    const values = watch();

    const isOwn = !c || c.doctor === profile?.id;
    const editable = isOwn && (!c || isEditableStatus(c));
    const readOnly = !editable;
    const amending = c?.consultation_status === 'amended';
    const voided = !!c && c.record_status !== 'active';

    // ── Load the note into the form (only when the note or its status changes,
    //    so refetches after adding an order never overwrite typing). ──────────
    const loadedKey = useRef<string>('');
    useEffect(() => {
        if (routeId == null) {
            if (loadedKey.current === 'new' || !visits.data) return;
            loadedKey.current = 'new';
            const last = visits.data.find(v => v.consultation_status === 'signed' || v.consultation_status === 'amended') as unknown as ConsultationDTO | undefined;
            const v = emptyValues(today);
            if (last) {
                // Weight and height rarely change between visits; everything else is entered fresh.
                if (last.weight != null) v.weight = String(Number(last.weight));
                if (last.height != null) v.height = String(Number(last.height));
                if (last.height_unit === 'm') v.height_unit = 'm';
            }
            reset(v);
            return;
        }
        if (!c) return;
        const key = `${c.id}:${c.consultation_status}:${c.record_status}`;
        if (loadedKey.current === key) return;
        loadedKey.current = key;
        reset(fromConsultation(c));
    }, [c, routeId, visits.data, reset, today]);

    // A draft opened from an appointment starts empty: carry weight and height
    // over from the last signed visit, like a new note (saved by autosave).
    const carried = useRef(false);
    useEffect(() => {
        if (carried.current || !c || !visits.data || !isOwn || c.consultation_status !== 'draft') return;
        carried.current = true;
        if (getValues('weight') || getValues('height')) return;
        const last = visits.data.find(v => v.id !== c.id && (v.consultation_status === 'signed' || v.consultation_status === 'amended')) as unknown as ConsultationDTO | undefined;
        if (!last) return;
        if (last.weight != null) setValue('weight', String(Number(last.weight)), { shouldDirty: true });
        if (last.height != null) setValue('height', String(Number(last.height)), { shouldDirty: true });
        if (last.height_unit === 'm') setValue('height_unit', 'm', { shouldDirty: true });
    }, [c, visits.data, isOwn, getValues, setValue]);

    // ── Saving ──────────────────────────────────────────────────────────────
    const [save, setSave] = useState<SaveState>({ state: 'idle' });
    const inflight = useRef<Promise<number | null> | null>(null);

    const persist = useCallback(async (): Promise<number | null> => {
        if (inflight.current) await inflight.current.catch(() => null);
        const run = (async () => {
            const sent = getValues();
            if (idRef.current == null) {
                if (sent.reason_for_consultation.trim().length < 5) {
                    setSave({ state: 'waiting' });
                    return null;
                }
                setSave({ state: 'saving' });
                const res = await api.post('/consultations/', { ...toPayload(sent), patient: patientId });
                const created = res.data as ConsultationDTO;
                idRef.current = created.id;
                qc.setQueryData(consultationKey(created.id), created);
                loadedKey.current = `${created.id}:${created.consultation_status}:${created.record_status}`;
                reset(sent, { keepValues: true });
                navigate(`/patients/${patientId}/visit/${created.id}`, { replace: true });
                invalidate(created.id);
            } else {
                const dirty = Object.keys(form.formState.dirtyFields) as Array<keyof WorkspaceValues>;
                if (dirty.length === 0) return idRef.current;
                setSave({ state: 'saving' });
                await api.patch(`/consultations/${idRef.current}/`, toPayload(sent, dirty));
                reset(sent, { keepValues: true });
            }
            setSave({ state: 'saved', at: new Date().toISOString() });
            return idRef.current;
        })();
        inflight.current = run;
        try {
            return await run;
        } catch (err) {
            setSave({ state: 'error' });
            toast.error(parseApiError(err, t('workspace.toast.save_failed')));
            throw err;
        } finally {
            if (inflight.current === run) inflight.current = null;
        }
    }, [form.formState, getValues, invalidate, navigate, patientId, qc, reset, t]);

    // Autosave a moment after the last keystroke.
    useEffect(() => {
        if (!editable) return;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const sub = watch(() => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => { if (form.formState.isDirty) persist().catch(() => {}); }, AUTOSAVE_MS);
        });
        return () => { sub.unsubscribe(); if (timer) clearTimeout(timer); };
    }, [editable, form.formState, persist, watch]);

    const ensureSaved = useCallback(async () => {
        try {
            const id = await persist();
            if (id == null) toast.error(t('workspace.toast.reason_first'));
            return id;
        } catch { return null; }
    }, [persist, t]);

    useNavigationBlocker(editable && (form.formState.isDirty || save.state === 'saving'));

    // ── Vital alerts & acknowledgements ─────────────────────────────────────
    const vitalAlerts = useMemo(() => alertsFor(values), [values]);
    const acknowledged = useMemo(
        () => new Set((c?.vital_alert_dismissals ?? []).map(d => d.alert_text.split('|')[0])),
        [c?.vital_alert_dismissals],
    );
    const [ackAlert, setAckAlert] = useState<VitalAlert | null>(null);
    const confirmAck = async (reason: string) => {
        if (!ackAlert) return;
        const id = await ensureSaved();
        if (id == null) return;
        const english = i18n.t(VITAL_ALERT_PREFIX + ackAlert.key, { value: ackAlert.value, lng: 'en' });
        try {
            await api.post('/vital-alert-dismissals/', {
                consultation: id, alert_text: `${alertSignature(ackAlert)}|${english}`.slice(0, 300), reason,
            });
            setAckAlert(null);
            invalidate(id);
        } catch (err) { toast.error(parseApiError(err, t('workspace.toast.ack_failed'))); }
    };

    // ── Readiness, sign, amend ──────────────────────────────────────────────
    const items = readiness(values, acknowledged);
    const required = items.filter(i => i.required);
    const orderCount = (c?.prescriptions?.filter(r => r.status === 'active').length ?? 0)
        + (c?.lab_orders?.filter(l => l.order_status !== 'cancelled').length ?? 0) + (c?.procedures?.length ?? 0);
    const done = sectionDone(values, orderCount);
    const changes = amending ? diffAgainstSnapshot(values, c?.signed_snapshot) : [];
    const changeFor = (f: string) => changes.find(ch => ch.field === f);

    const [reviewOpen, setReviewOpen] = useState(false);
    const [justSigned, setJustSigned] = useState(false);
    const [amendOpen, setAmendOpen] = useState(false);

    const openReview = async () => {
        try { await persist(); } catch { return; }
        setReviewOpen(true);
    };
    const sign = async () => {
        const id = await persist();
        if (id == null) return;
        try {
            await api.post(`/consultations/${id}/sign/`);
            setReviewOpen(false);
            setJustSigned(true);
            invalidate(id);
            toast.success(amending ? t('consultation.toast.amendment_signed') : t('workspace.toast.signed'));
            // The app scrolls its content area, not the window.
            document.querySelector('.ws-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) { toast.error(parseApiError(err, t('consultation.toast.sign_failed'))); }
    };
    const amend = async (reason?: string) => {
        if (!c) return;
        try {
            await api.post(`/consultations/${c.id}/amend/`, { amendment_reason: reason });
            setAmendOpen(false);
            setJustSigned(false);
            invalidate(c.id);
        } catch (err) { toast.error(parseApiError(err, t('consultation.view.toast.amend_failed'))); }
    };

    // Keyboard: Ctrl/⌘+S saves, Ctrl/⌘+Enter opens review.
    useEffect(() => {
        if (!editable) return;
        const onKey = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey)) return;
            if (e.key === 's') { e.preventDefault(); persist().catch(() => {}); }
            if (e.key === 'Enter') { e.preventDefault(); openReview(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const phrases = useSmartPhrases(editable);
    const patientName = patient.data ? `${patient.data.first_name} ${patient.data.last_name}` : '';
    const backTo = `/patients/${patientId}?tab=consultations`;

    if (routeId != null && consultation.isError) {
        return (
            <div className="ws-page"><div className="ws-card ws-empty-state">
                <h1>{t('workspace.not_found_title')}</h1><p>{t('workspace.not_found_body')}</p>
                <Link className="ws-btn ws-btn--primary" to={backTo}>{t('workspace.back_to_patient')}</Link>
            </div></div>
        );
    }
    const loading = patient.isLoading || (routeId != null && consultation.isLoading);

    const statusPill = (() => {
        if (!c) return <span className="ws-pill ws-pill--draft">{t('workspace.status.new')}</span>;
        if (voided) return <span className="ws-pill ws-pill--voided">{t('patient_record.consultations.status.voided')}</span>;
        const k = c.consultation_status === 'in_progress' ? 'draft' : c.consultation_status;
        return <span className={`ws-pill ws-pill--${k}`}>{t(`patient_record.consultations.status.${k}`)}</span>;
    })();
    const saveLabel = (() => {
        if (!editable) return null;
        switch (save.state) {
            case 'saving': return t('workspace.save.saving');
            case 'saved': return t('workspace.save.saved', { time: save.at ? formatTime(save.at) : '' });
            case 'error': return t('workspace.save.error');
            case 'waiting': return t('workspace.save.waiting');
            default: return routeId == null ? t('workspace.save.waiting') : t('workspace.save.autosave');
        }
    })();

    return (
        <div className={`ws-page${readOnly ? ' is-readonly' : ''}${amending ? ' is-amending' : ''}`}>
            <div className="ws-crumbs">
                <Link to={backTo} className="ws-back">{Icon.back}{patientName || t('workspace.back_to_patient')}</Link>
                <h1>{c ? t('workspace.title_dated', { date: formatDateLong(values.consultation_date || c.consultation_date) }) : t('workspace.title_new')}</h1>
            </div>

            <div className="ws-shell">
                <PatientBar patient={patient.data} right={
                    <>
                        {statusPill}
                        {saveLabel && <span className={`ws-save ws-save--${save.state}`}>{saveLabel}</span>}
                    </>
                } />
                {editable && <ProgressStrip done={done} requiredDone={required.filter(i => i.ok).length} requiredTotal={required.length} patientName={patient.data?.first_name ?? ''} />}
                {amending && (
                    <div className="ws-banner ws-banner--amend" role="status">
                        {Icon.pen}
                        <span>
                            <b>{c?.signed_at ? t('consultation.amend_banner.title_dated', { date: formatDateLong(c.signed_at) }) : t('consultation.amend_banner.title')}</b>
                            {c?.amendment_reason && <> {t('consultation.amend_banner.reason', { reason: c.amendment_reason })}</>}
                            {' '}{t('workspace.amend_patient_sees')}
                        </span>
                    </div>
                )}
                {voided && <div className="ws-banner ws-banner--voided" role="status"><b>{t('workspace.voided_title')}</b> {c?.void_reason}</div>}
                {c?.consultation_status === 'signed' && !voided && !justSigned && (
                    <div className="ws-banner ws-banner--signed" role="status">
                        {Icon.check}
                        <span><b>{t('workspace.signed_by', { name: c.doctor_name ?? '', date: c.signed_at ? formatDateLong(c.signed_at) : '', time: c.signed_at ? formatTime(c.signed_at) : '' })}</b> {t('workspace.signed_locked')}</span>
                    </div>
                )}
                {justSigned && c?.consultation_status === 'signed' && (
                    <AfterSign consultation={c} patientId={patientId} today={today} onLinked={() => invalidate(c.id)} />
                )}

                {loading ? <div className="ws-loading" aria-busy="true">{t('common.loading')}</div> : (
                    <div className="ws-grid">
                        <form className="ws-main" onSubmit={e => e.preventDefault()} noValidate>
                            <Section id="visit" title={t('workspace.section.visit')}>
                                <div className="ws-visit">
                                    <div className="ws-field">
                                        <label htmlFor="ws-date">{t('consultation.date')}</label>
                                        <input id="ws-date" type="date" className="ws-input" max={today} readOnly={readOnly} {...register('consultation_date')} />
                                    </div>
                                    <div className="ws-field">
                                        <span className="ws-flabel" id="ws-type-l">{t('workspace.visit_type')}</span>
                                        <div className="ws-seg" role="radiogroup" aria-labelledby="ws-type-l">
                                            {(['in_person', 'telemedicine', 'home_visit'] as const).map(k => (
                                                <button key={k} type="button" role="radio" aria-checked={values.consultation_type === k} disabled={readOnly}
                                                    className={values.consultation_type === k ? 'is-on' : ''}
                                                    onClick={() => setValue('consultation_type', k, { shouldDirty: true })}>
                                                    {t(`workspace.type.${k}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="ws-field">
                                        <label htmlFor="ws-fu">{t('workspace.follow_up_date')}</label>
                                        <input id="ws-fu" type="date" className="ws-input" min={today} readOnly={readOnly} {...register('follow_up_date')} />
                                    </div>
                                </div>
                                <div className="ws-field">
                                    <label htmlFor="ws-reason">{t('workspace.reason')} <span className="ws-req">*</span>{c?.appointment && <span className="ws-from">{t('workspace.from_appointment')}</span>}</label>
                                    <textarea id="ws-reason" rows={2} className="ws-textarea" readOnly={readOnly} placeholder={t('workspace.reason_placeholder')} {...register('reason_for_consultation')} />
                                    {changeFor('reason_for_consultation') && <Was value={changeFor('reason_for_consultation')!.was} />}
                                </div>
                            </Section>

                            <Section id="vitals" title={t('workspace.section.vitals')} hint={!readOnly ? t('workspace.vitals_hint') : undefined}>
                                <VitalsGrid register={register} watch={watch} alerts={vitalAlerts} acknowledged={acknowledged}
                                    readOnly={readOnly} onAcknowledge={setAckAlert}
                                    last={(visits.data ?? []).find(v => v.id !== routeId && (v.consultation_status === 'signed' || v.consultation_status === 'amended')) as unknown as Record<string, number | string | null> | undefined} />
                            </Section>

                            <Section id="note" title={t('workspace.section.note')} hint={!readOnly && phrases.length ? t('workspace.phrase_tip') : undefined}>
                                {editable && <HelpText topic="note" />}
                                <div className="ws-soapgrid">
                                    {(['subjective', 'objective', 'assessment', 'plan'] as const).map((f, i) => (
                                        <SoapField key={f} name={f} letter={'SOAP'[i]} label={t(`workspace.soap.${f}`)} placeholder={t(`workspace.soap.${f}_ph`)}
                                            register={register} setValue={setValue} watch={watch} readOnly={readOnly} phrases={phrases} changed={changeFor(f)} />
                                    ))}
                                </div>
                            </Section>

                            <Section id="diagnosis" title={t('workspace.section.diagnosis')}>
                                {editable && <HelpText topic="diagnosis" />}
                                <DiagnosisPicker register={register} setValue={setValue} watch={watch} readOnly={readOnly} changes={changes} />
                            </Section>

                            <Section id="orders" title={t('workspace.section.orders')} hint={amending ? t('workspace.orders_amend_hint') : undefined}>
                                {editable && <HelpText topic="orders" />}
                                <OrdersSection patientId={patientId} consultation={c} allergies={patient.data?.allergy_records ?? []}
                                    readOnly={readOnly} ensureSaved={ensureSaved} onChanged={() => invalidate(idRef.current)} />
                            </Section>

                            <Section id="patient" title={t('workspace.section.patient', { name: patient.data?.first_name ?? '' })}>
                                <div className="ws-patient">
                                    <div className="ws-patient__form">
                                        <label className="ws-toggle">
                                            <input type="checkbox" disabled={readOnly} {...register('visible_to_patient')} />
                                            <span className="ws-toggle__ui" aria-hidden="true" />
                                            <span><b>{t('workspace.share_toggle', { name: patient.data?.first_name ?? '' })}</b><span className="ws-muted ws-small">{t('workspace.share_toggle_hint')}</span></span>
                                        </label>
                                        <div className="ws-field">
                                            <label htmlFor="ws-ps">{t('workspace.patient_summary')}</label>
                                            <textarea id="ws-ps" rows={3} className="ws-textarea" readOnly={readOnly} placeholder={t('workspace.patient_summary_ph')} {...register('patient_summary')} />
                                            {changeFor('patient_summary') && <Was value={changeFor('patient_summary')!.was} />}
                                        </div>
                                        <div className="ws-field">
                                            <label htmlFor="ws-pi">{t('workspace.patient_instructions')}</label>
                                            <textarea id="ws-pi" rows={3} className="ws-textarea" readOnly={readOnly} placeholder={t('workspace.patient_instructions_ph')} {...register('patient_instructions')} />
                                        </div>
                                    </div>
                                    <PatientPreview values={values} doctorName={c?.doctor_name ?? profile?.full_name} date={values.consultation_date} />
                                </div>
                            </Section>
                        </form>

                        <div className="ws-side">
                            <ContextPanel currentId={routeId} visits={visits.data ?? []} meds={meds.data ?? []} labs={labs.data ?? []} alerts={alerts.data ?? []}
                                canCopy={editable} onCopyPlan={text => {
                                    const cur = getValues('plan');
                                    setValue('plan', cur ? `${cur}\n${text}` : text, { shouldDirty: true });
                                    document.getElementById('ws-plan')?.focus();
                                }} />
                            {c && <div className="ws-panel"><NoteHistory c={c} /></div>}
                        </div>
                    </div>
                )}

                {editable && !loading && (
                    <div className="ws-bar">
                        <span className="ws-kbd">
                            <kbd>Ctrl</kbd><kbd>S</kbd> {t('workspace.kbd_save')} · <kbd>Ctrl</kbd><kbd>↵</kbd> {t('workspace.kbd_sign')}
                        </span>
                        {amending && <span className="ws-chip ws-chip--amend">{t('workspace.changed_count', { count: changes.length })}</span>}
                        <span className="ws-spacer" />
                        <button type="button" className="ws-btn" onClick={() => navigate(backTo)}>{t('workspace.close')}</button>
                        <button type="button" className="ws-btn ws-btn--ghost" onClick={() => persist().then(id => id && toast.success(t('workspace.toast.saved'))).catch(() => {})}>
                            {t('consultation.save_draft')}
                        </button>
                        <button type="button" className="ws-btn ws-btn--primary" onClick={openReview}>
                            {amending ? t('workspace.review_resign') : t('workspace.review_sign')}
                            {!canSign(items) && <span className="ws-btn__count">{required.filter(i => !i.ok).length}</span>}
                        </button>
                    </div>
                )}
                {!editable && !loading && c && (
                    <div className="ws-bar">
                        <span className="ws-spacer" />
                        <Link className="ws-btn" to={backTo}>{t('workspace.back_to_patient')}</Link>
                        {isOwn && c.consultation_status === 'signed' && !voided && (
                            <button type="button" className="ws-btn ws-btn--ghost" onClick={() => setAmendOpen(true)}>{t('consultation.view.amend_note')}</button>
                        )}
                    </div>
                )}
            </div>

            {ackAlert && <AcknowledgeSheet alert={ackAlert} onCancel={() => setAckAlert(null)} onConfirm={confirmAck} />}
            {reviewOpen && (
                <SignReview items={items} values={values} consultation={c} patientName={patientName}
                    hasAppointment={!!c?.appointment} rxCount={c?.prescriptions?.filter(r => r.status === 'active').length ?? 0}
                    onCancel={() => setReviewOpen(false)} onSign={sign} />
            )}
            <Dialog open={amendOpen} onClose={() => setAmendOpen(false)} onConfirm={amend} requireReason
                title={t('workspace.amend_title')} message={t('workspace.amend_body')}
                reasonLabel={t('consultation.view.amendment_reason')} reasonPlaceholder={t('consultation.view.amend_reason_placeholder')}
                confirmLabel={t('workspace.amend_confirm')} />
        </div>
    );
}
