import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { ACK_REASONS, SECTION_ORDER, useEscape, type SmartPhrase } from './helpers';
import { useTranslation } from 'react-i18next';
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import api from '../../../shared/services/api';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';
import type { PatientWithHistory } from '../../../shared/types';
import { VITAL_ALERT_PREFIX, ALERT_FIELD, type VitalAlert } from '../vitals';
import {
    alertSignature, vitalError, type FieldChange, type SectionKey, type VitalField, type WorkspaceValues,
} from './model';
import type { ActiveMedication, LabRow, OpenAlert, VisitRow } from './useWorkspaceData';

type Reg = UseFormRegister<WorkspaceValues>;


// ── Patient bar ──────────────────────────────────────────────────────────────
export function PatientBar({ patient, right }: { patient?: PatientWithHistory; right: ReactNode }) {
    const { t } = useTranslation();
    if (!patient) return <div className="ws-pbar ws-pbar--loading" aria-busy="true" />;
    const initials = `${patient.first_name?.[0] ?? ''}${patient.last_name?.[0] ?? ''}`.toUpperCase();
    const allergies = (patient.allergy_records ?? []).filter(a => a.is_active)
        .sort((a, b) => (a.severity === 'life_threatening' ? -1 : 0) - (b.severity === 'life_threatening' ? -1 : 0));
    const conditions = (patient.conditions ?? []).filter(c => c.status === 'active' || c.status === 'chronic').slice(0, 3);
    return (
        <div className="ws-pbar">
            <span className="ws-avatar" aria-hidden="true">{initials}</span>
            <div className="ws-pbar__id">
                <b>{patient.first_name} {patient.last_name}</b>
                <span>{[patient.age != null ? t('workspace.age', { age: patient.age }) : null, patient.blood_group].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="ws-pbar__chips" aria-label={t('workspace.allergies_and_problems')}>
                {allergies.length === 0 && <span className="ws-chip ws-chip--muted">{t('workspace.no_allergies_recorded')}</span>}
                {allergies.map(a => (
                    <span key={a.id} className={`ws-allergy${a.severity === 'life_threatening' || a.severity === 'severe' ? ' ws-allergy--high' : ''}`}>
                        {(a.severity === 'life_threatening' || a.severity === 'severe') && Icon.alert}
                        {a.allergen} · {t(`workspace.severity.${a.severity}`)}
                    </span>
                ))}
                {conditions.map(c => <span key={c.id} className="ws-chip">{c.name}</span>)}
            </div>
            <div className="ws-pbar__right">{right}</div>
        </div>
    );
}

// ── Progress strip ───────────────────────────────────────────────────────────

export function ProgressStrip({ done, requiredDone, requiredTotal, patientName }: {
    done: Record<SectionKey, boolean>; requiredDone: number; requiredTotal: number; patientName: string;
}) {
    const { t } = useTranslation();
    const go = (k: SectionKey) => document.getElementById(`ws-sec-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return (
        <nav className="ws-prog" aria-label={t('workspace.sections')}>
            {SECTION_ORDER.map(k => (
                <button key={k} type="button" className={`ws-prog__item${done[k] ? ' is-done' : ''}`} onClick={() => go(k)}>
                    {t(`workspace.section.${k}`, { name: patientName })}
                </button>
            ))}
            <span className={`ws-prog__ready${requiredDone === requiredTotal ? ' is-ready' : ''}`}>
                {t('workspace.required_done', { done: requiredDone, total: requiredTotal })}
            </span>
        </nav>
    );
}

export function Section({ id, title, hint, children, aside }: { id: SectionKey; title: string; hint?: ReactNode; children: ReactNode; aside?: ReactNode }) {
    return (
        <section className="ws-card ws-sec" id={`ws-sec-${id}`} aria-labelledby={`ws-sec-${id}-h`}>
            <div className="ws-sec__h"><h2 id={`ws-sec-${id}-h`}>{title}</h2>{aside}{hint && <span className="ws-hint">{hint}</span>}</div>
            {children}
        </section>
    );
}

// ── Vitals ───────────────────────────────────────────────────────────────────
interface LastVitals { [k: string]: number | string | null | undefined }

const VITAL_TILES: Array<{ field: VitalField; unit: string; label: string }> = [
    { field: 'weight', unit: 'kg', label: 'weight' },
    { field: 'height', unit: '', label: 'height' },
    { field: 'bp_systolic', unit: 'mmHg', label: 'bp' },
    { field: 'pulse', unit: 'bpm', label: 'pulse' },
    { field: 'temperature', unit: '°C', label: 'temperature' },
    { field: 'sp2', unit: '%', label: 'spo2' },
    { field: 'respiratory_rate', unit: '/min', label: 'respiratory_rate' },
    { field: 'glucose_finger_stick', unit: 'mg/dL', label: 'glucose' },
    { field: 'pain_score', unit: '/10', label: 'pain' },
];

export function VitalsGrid({ register, watch, alerts, acknowledged, readOnly, last, onAcknowledge }: {
    register: Reg; watch: UseFormWatch<WorkspaceValues>; alerts: VitalAlert[]; acknowledged: Set<string>;
    readOnly: boolean; last?: LastVitals | null; onAcknowledge: (a: VitalAlert) => void;
}) {
    const { t } = useTranslation();
    const values = watch();
    const byField = new Map<string, VitalAlert>();
    for (const a of alerts) {
        const f = ALERT_FIELD[a.key];
        const prev = byField.get(f);
        if (!prev || (a.severity === 'critical' && prev.severity !== 'critical')) byField.set(f, a);
    }
    const bpAlert = byField.get('bp_systolic') ?? byField.get('bp_diastolic');
    const tileAlert = (f: VitalField) => (f === 'bp_systolic' ? bpAlert : byField.get(f));
    const lastText = (f: VitalField) => {
        if (!last) return null;
        if (f === 'bp_systolic') return last.bp_systolic ? `${last.bp_systolic}/${last.bp_diastolic ?? '—'}` : null;
        const v = last[f];
        return v == null || v === '' ? null : String(Number(v));
    };
    const pending = alerts.filter(a => a.severity === 'critical' && !acknowledged.has(alertSignature(a)));
    return (
        <>
            <div className="ws-vitals">
                {VITAL_TILES.map(({ field, unit, label }) => {
                    const a = tileAlert(field);
                    const err = field === 'bp_systolic'
                        ? (vitalError('bp_systolic', values.bp_systolic) || vitalError('bp_diastolic', values.bp_diastolic))
                        : vitalError(field, values[field]);
                    const cls = err ? ' is-error' : a ? (a.severity === 'critical' ? ' is-critical' : ' is-warning') : '';
                    const prev = lastText(field);
                    return (
                        <div key={field} className={`ws-vt${cls}`}>
                            <label className="ws-vt__k" htmlFor={`ws-${field}`}>
                                <span>{t(`workspace.vital.${label}`)}</span>
                                {a && !err && <span className="ws-vt__flag">{t(`workspace.flag.${a.severity}`)}</span>}
                            </label>
                            <div className="ws-vt__v">
                                {field === 'bp_systolic' ? (
                                    <>
                                        <input id="ws-bp_systolic" inputMode="numeric" placeholder="—" readOnly={readOnly} aria-label={t('workspace.vital.systolic')} {...register('bp_systolic')} />
                                        <span className="ws-vt__sep">/</span>
                                        <input id="ws-bp_diastolic" inputMode="numeric" placeholder="—" readOnly={readOnly} aria-label={t('workspace.vital.diastolic')} {...register('bp_diastolic')} />
                                    </>
                                ) : (
                                    <input id={`ws-${field}`} inputMode="decimal" placeholder="—" readOnly={readOnly} {...register(field)} />
                                )}
                                {field === 'height' ? (
                                    <select className="ws-unit" aria-label={t('consultation.height_unit')} disabled={readOnly} {...register('height_unit')}>
                                        <option value="cm">cm</option><option value="m">m</option>
                                    </select>
                                ) : <small>{unit}</small>}
                            </div>
                            <span className="ws-vt__p">
                                {err ? t(`workspace.vital_error.${err}`) : prev ? t('workspace.last_value', { value: prev }) : ' '}
                            </span>
                        </div>
                    );
                })}
            </div>
            {alerts.length > 0 && (
                <ul className="ws-alerts" aria-live="polite">
                    {alerts.map(a => {
                        const acked = acknowledged.has(alertSignature(a));
                        return (
                            <li key={a.key} className={`ws-alert ws-alert--${a.severity}${acked ? ' is-acked' : ''}`}>
                                <span className="ws-sev">{t(`consultation.vital_alert.severity.${a.severity}`)}</span>
                                <span className="ws-alert__text">{t(VITAL_ALERT_PREFIX + a.key, { value: a.value })}</span>
                                {a.severity === 'critical' && (acked
                                    ? <span className="ws-alert__ok">{Icon.check}{t('workspace.acknowledged')}</span>
                                    : !readOnly && <button type="button" className="ws-btn ws-btn--sm ws-btn--danger-soft" onClick={() => onAcknowledge(a)}>{t('workspace.acknowledge')}</button>)}
                            </li>
                        );
                    })}
                </ul>
            )}
            {pending.length > 0 && !readOnly && <p className="ws-sub ws-sub--danger">{t('workspace.ack_required', { count: pending.length })}</p>}
        </>
    );
}


export function AcknowledgeSheet({ alert, onCancel, onConfirm }: {
    alert: VitalAlert; onCancel: () => void; onConfirm: (reason: string) => Promise<void>;
}) {
    const { t } = useTranslation();
    const [choice, setChoice] = useState<string>('');
    const [other, setOther] = useState('');
    const [busy, setBusy] = useState(false);
    useEscape(onCancel, !busy);
    const reason = choice === 'other' ? other.trim() : choice ? t(`workspace.ack_reason.${choice}`) : '';
    return (
        <div className="ws-overlay" role="dialog" aria-modal="true" aria-labelledby="ws-ack-h">
            <div className="ws-sheet ws-sheet--sm">
                <div className="ws-sheet__h">
                    <span className="ws-sev ws-sev--critical">{t('consultation.vital_alert.severity.critical')}</span>
                    <h2 id="ws-ack-h">{t(VITAL_ALERT_PREFIX + alert.key, { value: alert.value })}</h2>
                    <p>{t('workspace.ack_explain')}</p>
                </div>
                <div className="ws-sheet__b">
                    <div className="ws-opts" role="radiogroup" aria-label={t('workspace.ack_reason_label')}>
                        {[...ACK_REASONS, 'other'].map(k => (
                            <button key={k} type="button" role="radio" aria-checked={choice === k} className={`ws-opt${choice === k ? ' is-on' : ''}`} onClick={() => setChoice(k)}>
                                {t(`workspace.ack_reason.${k}`)}
                            </button>
                        ))}
                    </div>
                    {choice === 'other' && (
                        <textarea className="ws-textarea" rows={2} autoFocus value={other} onChange={e => setOther(e.target.value)} placeholder={t('workspace.ack_other_placeholder')} aria-label={t('workspace.ack_reason_label')} />
                    )}
                </div>
                <div className="ws-sheet__f">
                    <button type="button" className="ws-btn" onClick={onCancel} disabled={busy}>{t('common.cancel')}</button>
                    <button type="button" className="ws-btn ws-btn--primary" disabled={busy || reason.length < 5}
                        onClick={async () => { setBusy(true); try { await onConfirm(reason); } finally { setBusy(false); } }}>
                        {t('workspace.acknowledge')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Note (S/O/A/P) with saved phrases ───────────────────────────────────────

export function SoapField({ name, letter, label, placeholder, register, setValue, watch, readOnly, phrases, changed }: {
    name: 'subjective' | 'objective' | 'assessment' | 'plan'; letter: string; label: string; placeholder: string;
    register: Reg; setValue: UseFormSetValue<WorkspaceValues>; watch: UseFormWatch<WorkspaceValues>;
    readOnly: boolean; phrases: SmartPhrase[]; changed?: FieldChange;
}) {
    const { t } = useTranslation();
    const ref = useRef<HTMLTextAreaElement | null>(null);
    const [query, setQuery] = useState<string | null>(null);
    const [index, setIndex] = useState(0);
    const reg = register(name);
    const value = watch(name);
    const matches = query == null ? [] : phrases.filter(p => p.trigger.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5);

    const detect = (el: HTMLTextAreaElement) => {
        const before = el.value.slice(0, el.selectionStart ?? el.value.length);
        const m = before.match(/(?:^|\s)\.([\w-]*)$/);
        setQuery(m ? m[1] : null);
        setIndex(0);
    };
    const insert = (p: SmartPhrase) => {
        const el = ref.current;
        if (!el) return;
        const pos = el.selectionStart ?? el.value.length;
        const before = el.value.slice(0, pos).replace(/\.([\w-]*)$/, '');
        const next = before + p.expansion + el.value.slice(pos);
        setValue(name, next, { shouldDirty: true });
        setQuery(null);
        api.post(`/smart-phrases/${p.id}/use/`).catch(() => {});
        requestAnimationFrame(() => { el.focus(); const c = (before + p.expansion).length; el.setSelectionRange(c, c); });
    };
    return (
        <div className={`ws-soap${changed ? ' is-changed' : ''}`}>
            <label className="ws-soap__k" htmlFor={`ws-${name}`}><b aria-hidden="true">{letter}</b>{label}</label>
            <textarea
                id={`ws-${name}`} rows={4} placeholder={placeholder} readOnly={readOnly}
                {...reg}
                ref={el => { reg.ref(el); ref.current = el; }}
                onChange={e => { reg.onChange(e); detect(e.target); }}
                onKeyDown={e => {
                    if (!matches.length) return;
                    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => (i + 1) % matches.length); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => (i - 1 + matches.length) % matches.length); }
                    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(matches[index]); }
                    else if (e.key === 'Escape') setQuery(null);
                }}
                onBlur={e => { reg.onBlur(e); setTimeout(() => setQuery(null), 150); }}
            />
            {matches.length > 0 && (
                <div className="ws-phrases" role="listbox" aria-label={t('workspace.saved_phrases')}>
                    {matches.map((p, i) => (
                        <button key={p.id} type="button" role="option" aria-selected={i === index} className={`ws-phrase${i === index ? ' is-on' : ''}`}
                            onMouseDown={e => { e.preventDefault(); insert(p); }}>
                            <code>.{p.trigger}</code><span>{p.expansion}</span>
                        </button>
                    ))}
                    <span className="ws-phrases__f">{t('workspace.phrase_hint')}</span>
                </div>
            )}
            {changed && <Was value={changed.was} />}
            {!value && readOnly && <span className="ws-empty">—</span>}
        </div>
    );
}

export function Was({ value }: { value: string }) {
    const { t } = useTranslation();
    return <p className="ws-was"><span>{t('workspace.was')}</span>{value || t('workspace.was_empty')}</p>;
}


// ── Diagnosis (ICD-10) ───────────────────────────────────────────────────────
export function DiagnosisPicker({ register, setValue, watch, readOnly, changes }: {
    register: Reg; setValue: UseFormSetValue<WorkspaceValues>; watch: UseFormWatch<WorkspaceValues>; readOnly: boolean;
    changes: FieldChange[];
}) {
    const { t } = useTranslation();
    const [q, setQ] = useState('');
    const [results, setResults] = useState<Array<{ code: string; label: string }>>([]);
    const [open, setOpen] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const code = watch('icd_code');
    const diagnosis = watch('diagnosis');

    useEffect(() => {
        if (timer.current) clearTimeout(timer.current);
        if (q.trim().length < 2) { setResults([]); return; }
        timer.current = setTimeout(async () => {
            try {
                const res = await api.get('/icd10/search/', { params: { q } });
                const rows = (res.data ?? []) as Array<{ code: string; description: string }>;
                setResults(rows.slice(0, 6).map(r => ({ code: r.code, label: r.description })));
                setOpen(true);
            } catch { setResults([]); }
        }, 220);
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [q]);

    const pick = (r: { code: string; label: string }) => {
        setValue('icd_code', r.code, { shouldDirty: true });
        if (!diagnosis.trim()) setValue('diagnosis', r.label, { shouldDirty: true });
        setQ(''); setOpen(false);
    };
    const dxChange = changes.find(c => c.field === 'diagnosis');
    const codeChange = changes.find(c => c.field === 'icd_code');
    return (
        <div className="ws-dx">
            {!readOnly && (
                <div className="ws-search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                    <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)}
                        onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={t('workspace.icd_search')} aria-label={t('workspace.icd_search')} />
                    {open && results.length > 0 && (
                        <div className="ws-results" role="listbox">
                            {results.map(r => (
                                <button key={r.code} type="button" role="option" aria-selected={false} className="ws-result" onMouseDown={e => { e.preventDefault(); pick(r); }}>
                                    <span className="ws-code">{r.code}</span>{r.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <div className="ws-dx__row">
                <div className="ws-field ws-dx__code">
                    <label htmlFor="ws-icd_code">{t('workspace.icd_code')}</label>
                    <input id="ws-icd_code" className="ws-input ws-mono" readOnly={readOnly} {...register('icd_code')} placeholder="—" />
                    {codeChange && <Was value={codeChange.was} />}
                </div>
                <div className="ws-field ws-dx__text">
                    <label htmlFor="ws-diagnosis">{t('workspace.diagnosis')}</label>
                    <input id="ws-diagnosis" className="ws-input" readOnly={readOnly} {...register('diagnosis')} placeholder={t('workspace.diagnosis_placeholder')} />
                    {dxChange && <Was value={dxChange.was} />}
                </div>
            </div>
            {code && !readOnly && <span className="ws-sub">{t('workspace.icd_hint')}</span>}
        </div>
    );
}

// ── For the patient ──────────────────────────────────────────────────────────
export function PatientPreview({ values, doctorName, date }: { values: WorkspaceValues; doctorName?: string | null; date: string }) {
    const { t } = useTranslation();
    const { formatDateLong } = useFormatDateTime();
    return (
        <div className="ws-phone" aria-label={t('workspace.preview_label')}>
            <div className="ws-phone__top">Altheon Patient<span>{t('workspace.preview')}</span></div>
            <div className="ws-phone__body">
                <span className="ws-phone__h">{t('workspace.preview_title')}</span>
                {values.visible_to_patient ? (
                    <div className="ws-phone__card">
                        <b>{formatDateLong(date)}</b>
                        <span className="ws-phone__sub">{values.reason_for_consultation || '—'}</span>
                        {doctorName && <span className="ws-phone__tag">Dr. {doctorName}</span>}
                        {values.diagnosis && (<><span className="ws-phone__l">{t('workspace.preview_diagnosis')}</span><p>{values.diagnosis}</p></>)}
                        <span className="ws-phone__l">{t('workspace.preview_summary')}</span>
                        <p className={values.patient_summary ? '' : 'is-empty'}>{values.patient_summary || t('workspace.preview_empty')}</p>
                        {values.patient_instructions && (<><span className="ws-phone__l">{t('workspace.preview_next')}</span><p>{values.patient_instructions}</p></>)}
                    </div>
                ) : (
                    <div className="ws-phone__card is-hidden"><p>{t('workspace.preview_hidden')}</p></div>
                )}
            </div>
        </div>
    );
}

// ── Context panel ────────────────────────────────────────────────────────────
type PanelTab = 'summary' | 'meds' | 'labs' | 'visits';

export function ContextPanel({ currentId, visits, meds, labs, alerts, onCopyPlan, canCopy }: {
    currentId: number | null; visits: VisitRow[]; meds: ActiveMedication[]; labs: LabRow[]; alerts: OpenAlert[];
    onCopyPlan: (text: string) => void; canCopy: boolean;
}) {
    const { t } = useTranslation();
    const { formatDate, formatDayMonth } = useFormatDateTime();
    const [tab, setTab] = useState<PanelTab>('summary');
    const past = visits.filter(v => v.id !== currentId && v.record_status !== 'voided' && v.record_status !== 'entered_in_error');
    const lastSigned = past.find(v => v.consultation_status === 'signed' || v.consultation_status === 'amended');
    const since = lastSigned?.consultation_date ?? '';
    const flaggedLabs = labs.filter(l => (l.status === 'critical' || l.status === 'abnormal') && (!since || l.test_date >= since)).slice(0, 3);
    const bp = past.filter(v => v.bp_systolic).slice(0, 5).reverse();
    const copyText = lastSigned?.plan || lastSigned?.medical_report || '';

    return (
        <aside className="ws-panel" aria-label={t('workspace.context')}>
            <div className="ws-panel__tabs" role="tablist">
                {(['summary', 'meds', 'labs', 'visits'] as PanelTab[]).map(k => (
                    <button key={k} role="tab" type="button" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
                        {t(`workspace.panel.${k}`)}{k === 'meds' && meds.length ? ` ${meds.length}` : ''}
                    </button>
                ))}
            </div>
            {tab === 'summary' && (
                <>
                    <div className="ws-panel__sec">
                        <span className="ws-label">{lastSigned ? t('workspace.since_last', { date: formatDayMonth(lastSigned.consultation_date) }) : t('workspace.first_visit')}</span>
                        <ul className="ws-since">
                            {alerts.slice(0, 3).map(a => <li key={`a${a.id}`}><i className={a.severity === 'critical' ? 'is-red' : 'is-amber'} /><span><b>{a.title}</b>{a.body ? ` · ${a.body}` : ''}</span></li>)}
                            {flaggedLabs.map(l => <li key={`l${l.id}`}><i className={l.status === 'critical' ? 'is-red' : 'is-amber'} /><span><b>{l.test_name}</b> · {l.result_value} {l.unit}{l.reference_range ? ` (${l.reference_range})` : ''}</span></li>)}
                            {alerts.length === 0 && flaggedLabs.length === 0 && <li className="is-quiet"><span>{t('workspace.nothing_flagged')}</span></li>}
                        </ul>
                    </div>
                    {bp.length >= 2 && <div className="ws-panel__sec"><BpSpark points={bp.map(v => ({ d: v.consultation_date, s: v.bp_systolic!, dia: v.bp_diastolic }))} /></div>}
                    {lastSigned && (
                        <div className="ws-panel__sec">
                            <span className="ws-label">{t('workspace.last_visit', { date: formatDayMonth(lastSigned.consultation_date) })}</span>
                            <p className="ws-small"><b>{lastSigned.diagnosis || lastSigned.reason_for_consultation}</b></p>
                            {copyText && canCopy && (
                                <button type="button" className="ws-btn ws-btn--sm" onClick={() => onCopyPlan(copyText)}>{t('workspace.copy_plan')}</button>
                            )}
                        </div>
                    )}
                </>
            )}
            {tab === 'meds' && (
                <div className="ws-panel__sec">
                    {meds.length === 0 ? <p className="ws-small ws-muted">{t('workspace.no_meds')}</p> : (
                        <ul className="ws-list">{meds.map(m => <li key={m.id}><span>{m.display_name}</span>{m.started_at && <span>{formatDate(m.started_at)}</span>}</li>)}</ul>
                    )}
                </div>
            )}
            {tab === 'labs' && (
                <div className="ws-panel__sec">
                    {labs.length === 0 ? <p className="ws-small ws-muted">{t('workspace.no_labs')}</p> : (
                        <ul className="ws-list">{labs.slice(0, 8).map(l => (
                            <li key={l.id}><span><b className={l.status === 'critical' ? 'ws-red' : l.status === 'abnormal' ? 'ws-amber' : ''}>{l.test_name}</b> {l.result_value} {l.unit}</span><span>{formatDayMonth(l.test_date)}</span></li>
                        ))}</ul>
                    )}
                </div>
            )}
            {tab === 'visits' && (
                <div className="ws-panel__sec">
                    {past.length === 0 ? <p className="ws-small ws-muted">{t('workspace.first_visit')}</p> : (
                        <ul className="ws-list">{past.slice(0, 8).map(v => (
                            <li key={v.id}><span><b>{v.diagnosis || v.reason_for_consultation}</b></span><span>{formatDayMonth(v.consultation_date)}</span></li>
                        ))}</ul>
                    )}
                </div>
            )}
        </aside>
    );
}

function BpSpark({ points }: { points: Array<{ d: string; s: number; dia: number | null }> }) {
    const { t } = useTranslation();
    const { formatDayMonth } = useFormatDateTime();
    const W = 260, H = 54, pad = 8;
    const lo = Math.min(90, ...points.map(p => p.s)) - 5, hi = Math.max(180, ...points.map(p => p.s)) + 5;
    const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, points.length - 1);
    const y = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.s).toFixed(1)}`).join(' ');
    const lastP = points[points.length - 1];
    return (
        <>
            <div className="ws-trend"><span className="ws-label">{t('workspace.bp_trend')}</span><b>{lastP.s}/{lastP.dia ?? '—'}</b></div>
            <svg className="ws-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('workspace.bp_trend_aria', { values: points.map(p => p.s).join(', ') })}>
                <line x1={0} x2={W} y1={y(140)} y2={y(140)} className="ws-spark__ref" />
                <path d={`${line} L${x(points.length - 1)} ${H} L${x(0)} ${H} Z`} className="ws-spark__area" />
                <path d={line} className="ws-spark__line" />
                <circle cx={x(points.length - 1)} cy={y(lastP.s)} r={4} className="ws-spark__dot" />
            </svg>
            <div className="ws-trend ws-trend--axis">{points.map(p => <span key={p.d}>{formatDayMonth(p.d)}</span>)}</div>
        </>
    );
}
