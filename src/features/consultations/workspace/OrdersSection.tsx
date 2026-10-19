import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';
import { toast, parseApiError } from '../../../shared/components/ui';
import Dialog from '../../../shared/components/ui/Dialog';
import type { PatientAllergy } from '../../../shared/types';
import { DrugAutocomplete, type DrugChoice, type SafetyResult } from '../components/DrugAutocomplete';
import { SafetyAlertModal } from '../components/SafetyAlertModal';
import { PROCEDURE_CATEGORY_VALUES, procedureCategoryKey } from '../../procedures/procedureSchema';
import type { ConsultationDTO } from './model';
import { nameAllergyMatches } from './allergy';

type Tab = 'rx' | 'labs' | 'procedures';

const FREQUENCIES = [
    'once', 'once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily',
    'every_4h', 'every_6h', 'every_8h', 'every_12h', 'bedtime', 'as_needed', 'weekly',
] as const;
const FREQ_KEY: Record<string, string> = {
    once: 'rx.freq.once', once_daily: 'rx.freq.qd', twice_daily: 'rx.freq.bid', three_times_daily: 'rx.freq.tid',
    four_times_daily: 'rx.freq.qid', every_4h: 'rx.freq.q4h', every_6h: 'rx.freq.q6h', every_8h: 'rx.freq.q8h',
    every_12h: 'rx.freq.q12h', bedtime: 'rx.freq.hs', as_needed: 'rx.freq.prn', weekly: 'rx.freq.weekly',
};

type SafetyOverride = {
    allergy_overrides: { allergen: string; matched_value: string; reason: string }[];
    interaction_overrides: { existing_drug_rxcui: string; reason: string }[];
};

interface Props {
    patientId: string;
    consultation: ConsultationDTO | undefined;
    allergies: PatientAllergy[];
    readOnly: boolean;
    /** Saves the note first if it does not exist yet; resolves to its id. */
    ensureSaved: () => Promise<number | null>;
    onChanged: () => void;
}


export function OrdersSection({ patientId, consultation, allergies, readOnly, ensureSaved, onChanged }: Props) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<Tab>('rx');
    const rx = consultation?.prescriptions ?? [];
    const labs = consultation?.lab_orders ?? [];
    const procs = consultation?.procedures ?? [];
    const counts: Record<Tab, number> = {
        rx: rx.filter(r => r.status === 'active').length,
        labs: labs.filter(l => l.order_status !== 'cancelled').length,
        procedures: procs.length,
    };
    return (
        <div className="ws-orders">
            <div className="ws-tabs" role="tablist" aria-label={t('workspace.orders')}>
                {(['rx', 'labs', 'procedures'] as Tab[]).map(k => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
                        {t(`workspace.orders_tab.${k}`)}{counts[k] > 0 && <em>{counts[k]}</em>}
                    </button>
                ))}
            </div>
            {tab === 'rx' && <PrescriptionsPane {...{ patientId, consultation, allergies, readOnly, ensureSaved, onChanged }} />}
            {tab === 'labs' && <LabsPane {...{ patientId, consultation, readOnly, ensureSaved, onChanged }} />}
            {tab === 'procedures' && <ProceduresPane {...{ patientId, consultation, readOnly, ensureSaved, onChanged }} />}
        </div>
    );
}

function CheckChips({ safety, coded }: { safety: SafetyResult | null; coded: boolean }) {
    const { t } = useTranslation();
    const avail = (safety as (SafetyResult & { checks_available?: Record<string, boolean> }) | null)?.checks_available;
    if (!coded) return <div className="ws-checks"><span className="ws-ck is-na">{t('workspace.check.name_only')}</span></div>;
    return (
        <div className="ws-checks">
            <span className="ws-ck is-ok">✓ {t('workspace.check.allergies')}{avail && !avail.allergy_by_ingredient ? ` · ${t('workspace.check.by_name')}` : ''}</span>
            {avail?.interactions ? <span className="ws-ck is-ok">✓ {t('workspace.check.interactions')}</span>
                : <span className="ws-ck is-na">{t('workspace.check.interactions_na')}</span>}
            {avail?.dose_limits ? <span className="ws-ck is-ok">✓ {t('workspace.check.dose')}</span>
                : <span className="ws-ck is-na">{t('workspace.check.dose_na')}</span>}
        </div>
    );
}

function PrescriptionsPane({ patientId, consultation, allergies, readOnly, ensureSaved, onChanged }: Omit<Props, never>) {
    const { t } = useTranslation();
    const [freeText, setFreeText] = useState(false);
    const [drug, setDrug] = useState<DrugChoice | null>(null);
    const [name, setName] = useState('');
    const [safety, setSafety] = useState<SafetyResult | null>(null);
    const [dosage, setDosage] = useState('');
    const [frequency, setFrequency] = useState<string>('once_daily');
    const [days, setDays] = useState('');
    const [override, setOverride] = useState<SafetyOverride | null>(null);
    const [showSafety, setShowSafety] = useState(false);
    const [nameOverrideReason, setNameOverrideReason] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [stopId, setStopId] = useState<number | null>(null);

    const drugName = freeText ? name : drug?.name ?? '';
    const nameClash = nameAllergyMatches(drugName, allergies);
    const blockingSafety = !!safety && (safety.allergy_alerts.length > 0 || safety.interaction_alerts.length > 0);
    const needsOverride = (blockingSafety && !override) || (nameClash.length > 0 && !nameOverrideReason);

    const reset = () => {
        setDrug(null); setName(''); setSafety(null); setDosage(''); setDays(''); setFrequency('once_daily');
        setOverride(null); setNameOverrideReason(null);
    };

    const add = async () => {
        if (!drugName.trim() || !dosage.trim()) return;
        if (blockingSafety && !override) { setShowSafety(true); return; }
        if (nameClash.length > 0 && !nameOverrideReason) return;
        setBusy(true);
        try {
            const cid = await ensureSaved();
            if (!cid) return;
            await api.post('/prescriptions/', {
                patient_id: patientId,
                consultation_id: cid,
                rxnorm_rxcui: freeText ? '' : drug?.rxcui ?? '',
                custom_drug_name: freeText ? name.trim() : '',
                dosage: dosage.trim(),
                frequency,
                duration_days: days ? parseInt(days, 10) : null,
                ...(override ? { safety_override: override } : {}),
                ...(nameOverrideReason ? { override_allergy_warning: true, instructions: t('workspace.override_note', { reason: nameOverrideReason }) } : {}),
            });
            toast.success(t('workspace.toast.rx_added', { name: drugName }));
            reset();
            onChanged();
        } catch (err) {
            toast.error(parseApiError(err, t('workspace.toast.rx_failed')));
        } finally { setBusy(false); }
    };

    const stop = async () => {
        if (stopId == null) return;
        try {
            await api.delete(`/prescriptions/${stopId}/`);
            toast.success(t('workspace.toast.rx_stopped'));
            onChanged();
        } catch (err) { toast.error(parseApiError(err, t('workspace.toast.rx_failed'))); }
        finally { setStopId(null); }
    };

    return (
        <div className="ws-pane">
            {consultation?.prescriptions?.length ? (
                <ul className="ws-orderlist">
                    {consultation.prescriptions.map(r => (
                        <li key={r.id} className={r.status !== 'active' ? 'is-stopped' : ''}>
                            <div><b>{r.medication_name}</b> {r.dosage} · {r.frequency_display ?? t(FREQ_KEY[r.frequency] ?? r.frequency)}{r.duration_days ? ` · ${t('workspace.days', { count: r.duration_days })}` : ''}</div>
                            {r.status !== 'active' ? <span className="ws-chip ws-chip--muted">{t(`workspace.rx_status.${r.status}`, { defaultValue: r.status })}</span>
                                : !readOnly && <button type="button" className="ws-link" onClick={() => setStopId(r.id)}>{t('workspace.stop')}</button>}
                        </li>
                    ))}
                </ul>
            ) : readOnly ? <p className="ws-muted ws-small">{t('workspace.no_rx')}</p> : null}

            {!readOnly && (
                <div className={`ws-rxform${nameClash.length && !nameOverrideReason ? ' is-danger' : ''}`}>
                    <div className="ws-rxform__row">
                        <div className="ws-rxform__drug">
                            {freeText ? (
                                <input className="ws-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('workspace.drug_name')} aria-label={t('workspace.drug_name')} />
                            ) : (
                                <DrugAutocomplete patientId={patientId} value={drug} placeholder={t('workspace.drug_search')}
                                    onSelect={(d, s) => { setDrug(d); setSafety(s); setOverride(null); if (s && (s.allergy_alerts.length || s.interaction_alerts.length)) setShowSafety(true); }} />
                            )}
                            <button type="button" className="ws-link ws-small" onClick={() => { setFreeText(f => !f); reset(); }}>
                                {freeText ? t('workspace.search_coded') : t('workspace.type_name')}
                            </button>
                        </div>
                        <input className="ws-input ws-rxform__dose" value={dosage} onChange={e => setDosage(e.target.value)} placeholder={t('workspace.dosage')} aria-label={t('workspace.dosage')} />
                        <select className="ws-input" value={frequency} onChange={e => setFrequency(e.target.value)} aria-label={t('workspace.frequency')}>
                            {FREQUENCIES.map(f => <option key={f} value={f}>{t(FREQ_KEY[f])}</option>)}
                        </select>
                        <input className="ws-input ws-rxform__days" inputMode="numeric" value={days} onChange={e => setDays(e.target.value.replace(/\D/g, ''))} placeholder={t('workspace.days_placeholder')} aria-label={t('workspace.duration')} />
                        <button type="button" className="ws-btn ws-btn--primary" disabled={busy || !drugName.trim() || !dosage.trim() || (nameClash.length > 0 && !nameOverrideReason)} onClick={add}>
                            {t('workspace.add')}
                        </button>
                    </div>
                    {nameClash.length > 0 && !nameOverrideReason && (
                        <div className="ws-rxwarn" role="alert">
                            <b>{t('workspace.allergy_clash', { allergen: nameClash[0].allergen, severity: t(`workspace.severity.${nameClash[0].severity}`) })}</b>
                            <span>{t('workspace.allergy_clash_hint')}</span>
                            <NameOverride onConfirm={setNameOverrideReason} />
                        </div>
                    )}
                    {drugName && !needsOverride && <CheckChips safety={safety} coded={!freeText && !!drug} />}
                    {override && <span className="ws-sub">{t('workspace.override_recorded')}</span>}
                </div>
            )}

            {showSafety && safety && drug && (
                <SafetyAlertModal drugName={drug.name} safety={safety}
                    onCancel={() => { setShowSafety(false); reset(); }}
                    onConfirm={payload => { setOverride(payload); setShowSafety(false); }} />
            )}
            <Dialog open={stopId != null} onClose={() => setStopId(null)} onConfirm={stop} tone="danger"
                title={t('workspace.stop_rx_title')} message={t('workspace.stop_rx_body')} confirmLabel={t('workspace.stop')} />
        </div>
    );
}

function NameOverride({ onConfirm }: { onConfirm: (reason: string) => void }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    if (!open) return <button type="button" className="ws-link ws-small" onClick={() => setOpen(true)}>{t('workspace.prescribe_anyway')}</button>;
    return (
        <div className="ws-override">
            <input className="ws-input" autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder={t('workspace.override_reason')} aria-label={t('workspace.override_reason')} />
            <button type="button" className="ws-btn ws-btn--sm" disabled={reason.trim().length < 5} onClick={() => onConfirm(reason.trim())}>{t('workspace.confirm_override')}</button>
        </div>
    );
}

function LabsPane({ patientId, consultation, readOnly, ensureSaved, onChanged }: Omit<Props, 'allergies'>) {
    const { t } = useTranslation();
    const { toIsoDateInTz } = useFormatDateTime();
    const [name, setName] = useState('');
    const [priority, setPriority] = useState('routine');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const add = async () => {
        if (!name.trim()) return;
        setBusy(true);
        try {
            const cid = await ensureSaved();
            if (!cid) return;
            await api.post('/lab-orders/', {
                patient: patientId, consultation: cid, test_name: name.trim(), priority,
                order_date: consultation?.consultation_date ?? toIsoDateInTz(new Date()),
                ...(notes.trim() ? { notes: notes.trim() } : {}),
            });
            toast.success(t('workspace.toast.lab_added', { name: name.trim() }));
            setName(''); setNotes(''); setPriority('routine');
            onChanged();
        } catch (err) { toast.error(parseApiError(err, t('workspace.toast.order_failed'))); }
        finally { setBusy(false); }
    };
    const cancel = async (id: number) => {
        try { await api.post(`/lab-orders/${id}/cancel/`); onChanged(); }
        catch (err) { toast.error(parseApiError(err, t('workspace.toast.order_failed'))); }
    };
    return (
        <div className="ws-pane">
            {consultation?.lab_orders?.length ? (
                <ul className="ws-orderlist">
                    {consultation.lab_orders.map(l => (
                        <li key={l.id} className={l.order_status === 'cancelled' ? 'is-stopped' : ''}>
                            <div><b>{l.test_name}</b>{l.priority !== 'routine' && <span className="ws-chip ws-chip--warn">{t(`workspace.priority.${l.priority}`)}</span>}{l.notes ? ` · ${l.notes}` : ''}</div>
                            {l.order_status === 'cancelled' || l.order_status === 'resulted'
                                ? <span className="ws-chip ws-chip--muted">{t(`workspace.lab_status.${l.order_status}`)}</span>
                                : !readOnly && <button type="button" className="ws-link" onClick={() => cancel(l.id)}>{t('workspace.cancel_order')}</button>}
                        </li>
                    ))}
                </ul>
            ) : readOnly ? <p className="ws-muted ws-small">{t('workspace.no_labs_ordered')}</p> : null}
            {!readOnly && (
                <div className="ws-rxform"><div className="ws-rxform__row">
                    <input className="ws-input ws-grow" value={name} onChange={e => setName(e.target.value)} placeholder={t('workspace.lab_name')} aria-label={t('workspace.lab_name')} />
                    <select className="ws-input" value={priority} onChange={e => setPriority(e.target.value)} aria-label={t('workspace.priority_label')}>
                        {['routine', 'urgent', 'stat'].map(p => <option key={p} value={p}>{t(`workspace.priority.${p}`)}</option>)}
                    </select>
                    <input className="ws-input ws-grow" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('workspace.order_notes')} aria-label={t('workspace.order_notes')} />
                    <button type="button" className="ws-btn ws-btn--primary" disabled={busy || !name.trim()} onClick={add}>{t('workspace.add')}</button>
                </div></div>
            )}
        </div>
    );
}

function ProceduresPane({ patientId, consultation, readOnly, ensureSaved, onChanged }: Omit<Props, 'allergies'>) {
    const { t } = useTranslation();
    const { toIsoDateInTz } = useFormatDateTime();
    const [name, setName] = useState('');
    const [category, setCategory] = useState<string>('diagnostic');
    const [result, setResult] = useState('');
    const [busy, setBusy] = useState(false);
    const [voidId, setVoidId] = useState<number | null>(null);
    const add = async () => {
        if (!name.trim()) return;
        setBusy(true);
        try {
            const cid = await ensureSaved();
            if (!cid) return;
            await api.post('/medical-procedures/', {
                patient: patientId, consultation: cid, procedure_type: name.trim(), procedure_category: category,
                procedure_date: consultation?.consultation_date ?? toIsoDateInTz(new Date()),
                ...(result.trim() ? { result: result.trim() } : {}),
            });
            toast.success(t('workspace.toast.procedure_added', { name: name.trim() }));
            setName(''); setResult('');
            onChanged();
        } catch (err) { toast.error(parseApiError(err, t('workspace.toast.order_failed'))); }
        finally { setBusy(false); }
    };
    const voidIt = async (reason?: string) => {
        if (voidId == null) return;
        try { await api.post(`/medical-procedures/${voidId}/void/`, { void_reason: reason }); onChanged(); }
        catch (err) { toast.error(parseApiError(err, t('workspace.toast.order_failed'))); }
        finally { setVoidId(null); }
    };
    return (
        <div className="ws-pane">
            {consultation?.procedures?.length ? (
                <ul className="ws-orderlist">
                    {consultation.procedures.map(p => (
                        <li key={p.id}>
                            <div><b>{p.procedure_type}</b> · {t(procedureCategoryKey(p.procedure_category))}{p.result ? ` · ${p.result}` : ''}</div>
                            {!readOnly && <button type="button" className="ws-link" onClick={() => setVoidId(p.id)}>{t('workspace.void')}</button>}
                        </li>
                    ))}
                </ul>
            ) : readOnly ? <p className="ws-muted ws-small">{t('workspace.no_procedures')}</p> : null}
            {!readOnly && (
                <div className="ws-rxform"><div className="ws-rxform__row">
                    <input className="ws-input ws-grow" value={name} onChange={e => setName(e.target.value)} placeholder={t('workspace.procedure_name')} aria-label={t('workspace.procedure_name')} />
                    <select className="ws-input" value={category} onChange={e => setCategory(e.target.value)} aria-label={t('workspace.procedure_category')}>
                        {PROCEDURE_CATEGORY_VALUES.map(v => <option key={v} value={v}>{t(procedureCategoryKey(v))}</option>)}
                    </select>
                    <input className="ws-input ws-grow" value={result} onChange={e => setResult(e.target.value)} placeholder={t('workspace.procedure_result')} aria-label={t('workspace.procedure_result')} />
                    <button type="button" className="ws-btn ws-btn--primary" disabled={busy || !name.trim()} onClick={add}>{t('workspace.add')}</button>
                </div></div>
            )}
            <Dialog open={voidId != null} onClose={() => setVoidId(null)} onConfirm={voidIt} tone="danger" requireReason
                title={t('workspace.void_procedure_title')} reasonLabel={t('consultation.void_dialog.reason_label')}
                reasonPlaceholder={t('consultation.void_dialog.reason_placeholder')} confirmLabel={t('workspace.void')} />
        </div>
    );
}
