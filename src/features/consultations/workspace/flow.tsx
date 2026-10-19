import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../../shared/services/api';
import { toast, parseApiError } from '../../../shared/components/ui';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';
import { Icon } from './icons';
import { useEscape } from './helpers';
import { type ConsultationDTO, type ReadinessItem, type WorkspaceValues } from './model';

// ── Review & sign ────────────────────────────────────────────────────────────
export function SignReview({ items, values, consultation, patientName, hasAppointment, rxCount, onCancel, onSign }: {
    items: ReadinessItem[]; values: WorkspaceValues; consultation?: ConsultationDTO; patientName: string;
    hasAppointment: boolean; rxCount: number; onCancel: () => void; onSign: () => Promise<void>;
}) {
    const { t } = useTranslation();
    const { formatDateLong } = useFormatDateTime();
    const [busy, setBusy] = useState(false);
    useEscape(onCancel, !busy);
    const amending = consultation?.consultation_status === 'amended';
    const blocked = items.some(i => i.required && !i.ok);
    const detail = (i: ReadinessItem) => {
        switch (i.key) {
            case 'diagnosis': return [values.icd_code, values.diagnosis || values.assessment].filter(Boolean).join(' · ');
            case 'critical_ack': return i.ok ? t('workspace.review.none_pending') : t('workspace.review.ack_pending', { count: i.count });
            case 'vitals_valid': return i.ok ? '' : t('workspace.review.vitals_invalid', { count: i.count });
            case 'summary': return i.ok ? '' : t('workspace.review.summary_hint');
            case 'follow_up': return i.ok ? values.follow_up_date : t('workspace.review.follow_up_hint');
            default: return values.reason_for_consultation;
        }
    };
    return (
        <div className="ws-overlay" role="dialog" aria-modal="true" aria-labelledby="ws-sign-h">
            <div className="ws-sheet">
                <div className="ws-sheet__h">
                    <h2 id="ws-sign-h">{amending ? t('workspace.review.title_resign') : t('workspace.review.title')}</h2>
                    <p>{patientName} · {formatDateLong(values.consultation_date)}</p>
                </div>
                <div className="ws-sheet__b">
                    <ul className="ws-check">
                        {items.map(i => (
                            <li key={i.key} className={i.ok ? 'is-ok' : i.required ? 'is-bad' : 'is-opt'}>
                                <i aria-hidden="true">{i.ok ? '✓' : i.required ? '!' : '–'}</i>
                                <span>
                                    {t(`workspace.review.${i.key}`)}
                                    {!i.required && <em className="ws-opt-tag">{t('workspace.review.optional')}</em>}
                                    {detail(i) && <span className="ws-muted">{detail(i)}</span>}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="ws-effects">
                        <span className="ws-label">{t('workspace.review.when_you_sign')}</span>
                        <ul>
                            <li>{amending ? t('workspace.review.effect_relock') : t('workspace.review.effect_lock')}</li>
                            {!amending && hasAppointment && <li>{t('workspace.review.effect_appointment')}</li>}
                            {values.visible_to_patient
                                ? <li>{amending ? t('workspace.review.effect_patient_update', { name: patientName }) : t('workspace.review.effect_patient', { name: patientName })}</li>
                                : <li>{t('workspace.review.effect_hidden', { name: patientName })}</li>}
                            {rxCount > 0 && <li>{t('workspace.review.effect_rx', { count: rxCount })}</li>}
                        </ul>
                    </div>
                </div>
                <div className="ws-sheet__f">
                    <button type="button" className="ws-btn" onClick={onCancel} disabled={busy}>{t('workspace.review.back')}</button>
                    <button type="button" className="ws-btn ws-btn--primary" disabled={busy || blocked}
                        onClick={async () => { setBusy(true); try { await onSign(); } finally { setBusy(false); } }}>
                        {busy ? t('workspace.signing') : amending ? t('workspace.review.resign') : t('workspace.review.sign')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── After signing ────────────────────────────────────────────────────────────
interface Slot { time: string; datetime: string; status: string }
interface TodayAppt {
    id: number; appointment_date: string; status: string; reason_for_appointment: string; patient: string;
    patient_details?: { unique_id: string; first_name: string; last_name: string };
}

function addDays(iso: string, n: number) {
    // Calendar arithmetic on the date only (no timezone shifts).
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
}

/** First day on or after `from` (within two weeks) with a free slot. */
async function firstFreeDay(from: string): Promise<string> {
    for (let i = 0; i < 14; i++) {
        const day = addDays(from, i);
        try {
            const r = await api.get<{ slots: Slot[]; day_off: boolean }>('/appointments/day-slots/', { params: { date: day } });
            if (!r.data.day_off && (r.data.slots ?? []).some(s => s.status === 'free')) return day;
        } catch { /* try the next day */ }
    }
    return from;
}

export function AfterSign({ consultation, patientId, today, onLinked }: {
    consultation: ConsultationDTO; patientId: string; today: string; onLinked: () => void;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatTime, formatDayMonth, formatDateLong } = useFormatDateTime();
    const linked = consultation.follow_up_appointment_info;
    const wanted = consultation.follow_up_date && consultation.follow_up_date > today ? consultation.follow_up_date : addDays(today, 7);
    const [startDay, setStartDay] = useState<string | null>(null);
    const days = useMemo(() => (startDay ? Array.from({ length: 6 }, (_, i) => addDays(startDay, i)) : []), [startDay]);
    const [day, setDay] = useState<string>('');
    useEffect(() => {
        if (linked) return;
        let alive = true;
        firstFreeDay(wanted).then(d => { if (alive) { setStartDay(d); setDay(d); } });
        return () => { alive = false; };
    }, [wanted, linked]);
    const [slots, setSlots] = useState<Slot[] | null>(null);
    const [dayOff, setDayOff] = useState(false);
    const [slot, setSlot] = useState<string | null>(null);
    const [booking, setBooking] = useState(false);
    const [next, setNext] = useState<TodayAppt | null | undefined>(undefined);

    useEffect(() => {
        if (linked || !day) return;
        setSlots(null); setSlot(null);
        api.get<{ slots: Slot[]; day_off: boolean }>('/appointments/day-slots/', { params: { date: day } })
            .then(r => { setDayOff(!!r.data.day_off); setSlots(r.data.slots ?? []); })
            .catch(() => setSlots([]));
    }, [day, linked]);

    useEffect(() => {
        api.get('/appointments/', { params: { date: today } }).then(r => {
            const rows = (r.data.results ?? r.data) as TodayAppt[];
            const now = Date.now();
            const upcoming = rows
                .filter(a => (a.status === 'confirmed' || a.status === 'in_progress') && a.patient !== patientId && a.patient_details?.unique_id !== patientId)
                .filter(a => a.status === 'in_progress' || new Date(a.appointment_date).getTime() > now - 30 * 60_000)
                .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
            setNext(upcoming[0] ?? null);
        }).catch(() => setNext(null));
    }, [today, patientId]);

    const book = async () => {
        if (!slot) return;
        setBooking(true);
        try {
            const appt = await api.post('/appointments/', {
                patient: patientId, appointment_date: slot,
                reason_for_appointment: t('workspace.after.follow_up_reason', { reason: consultation.diagnosis || consultation.reason_for_consultation }),
                appointment_type: consultation.consultation_type === 'telemedicine' ? 'telemedicine' : 'in_person',
            });
            await api.patch(`/consultations/${consultation.id}/`, { follow_up_appointment: appt.data.id });
            toast.success(t('workspace.after.booked'));
            onLinked();
        } catch (err) {
            toast.error(parseApiError(err, t('workspace.after.book_failed')));
        } finally { setBooking(false); }
    };

    const startNext = async (a: TodayAppt) => {
        try {
            const res = await api.post(`/appointments/${a.id}/start-consultation/`);
            navigate(`/patients/${res.data.patient_id}/visit/${res.data.consultation_id}`);
        } catch (err) { toast.error(parseApiError(err, t('appointments.toast.consultation_start_failed'))); }
    };

    const free = (slots ?? []).filter(s => s.status === 'free');
    return (
        <div className="ws-after" aria-live="polite">
            <div className="ws-after__done">
                <span className="ws-after__ic">{Icon.check}</span>
                <div>
                    <b>{t('workspace.after.signed_at', { time: consultation.signed_at ? formatTime(consultation.signed_at) : '' })}</b>
                    <span>{[
                        consultation.appointment ? t('workspace.after.appt_completed') : null,
                        consultation.visible_to_patient ? t('workspace.after.patient_notified') : t('workspace.after.patient_hidden'),
                    ].filter(Boolean).join(' · ')}</span>
                </div>
            </div>
            <div className="ws-card ws-after__card">
                <span className="ws-label">{t('workspace.after.follow_up')}</span>
                {linked ? (
                    <p className="ws-small">{t('workspace.after.follow_up_linked', { date: formatDateLong(linked.appointment_date), time: formatTime(linked.appointment_date) })}</p>
                ) : (
                    <>
                        <div className="ws-days" role="radiogroup" aria-label={t('workspace.after.pick_day')}>
                            {days.map(d => (
                                <button key={d} type="button" role="radio" aria-checked={d === day} className={`ws-day${d === day ? ' is-on' : ''}`} onClick={() => setDay(d)}>
                                    {formatDayMonth(d)}
                                </button>
                            ))}
                        </div>
                        <div className="ws-slots">
                            {slots == null ? <span className="ws-muted ws-small">{t('common.loading')}</span>
                                : dayOff ? <span className="ws-muted ws-small">{t('workspace.after.day_off')}</span>
                                    : free.length === 0 ? <span className="ws-muted ws-small">{t('workspace.after.no_slots')}</span>
                                        : free.map(s => (
                                            <button key={s.datetime} type="button" className={`ws-slot${slot === s.datetime ? ' is-on' : ''}`} onClick={() => setSlot(s.datetime)}>{s.time}</button>
                                        ))}
                        </div>
                        <div className="ws-after__f">
                            <span className="ws-muted ws-small">{slot ? `${formatDateLong(slot)} · ${formatTime(slot)}` : t('workspace.after.pick_slot')}</span>
                            <button type="button" className="ws-btn ws-btn--primary ws-btn--sm" disabled={!slot || booking} onClick={book}>{t('workspace.after.book')}</button>
                        </div>
                    </>
                )}
            </div>
            <div className="ws-card ws-after__card">
                <span className="ws-label">{t('workspace.after.next')}</span>
                {next === undefined ? <span className="ws-muted ws-small">{t('common.loading')}</span>
                    : next === null ? <p className="ws-small ws-muted">{t('workspace.after.no_next')}</p> : (
                        <div className="ws-next">
                            <span className="ws-next__tm">{formatTime(next.appointment_date)}</span>
                            <b>{next.patient_details ? `${next.patient_details.first_name} ${next.patient_details.last_name}` : ''}</b>
                            <span className="ws-muted ws-small">{next.reason_for_appointment}</span>
                            <button type="button" className="ws-btn ws-btn--primary ws-btn--sm" onClick={() => startNext(next)}>
                                {next.status === 'in_progress' ? t('workspace.after.resume') : t('workspace.after.start')}
                            </button>
                        </div>
                    )}
            </div>
        </div>
    );
}

// ── Signed / voided document header & history ───────────────────────────────
export function NoteHistory({ c }: { c: ConsultationDTO }) {
    const { t } = useTranslation();
    const { formatDateTime } = useFormatDateTime();
    const rows: Array<{ k: string; at?: string | null; extra?: string }> = [
        { k: 'created', at: c.created_at },
        { k: 'signed', at: c.signed_at },
        { k: 'shared', at: c.share_with_patient_at },
        { k: 'amended', at: c.amended_at, extra: c.amendment_reason },
        { k: 'voided', at: c.record_status !== 'active' ? (c.voided_at as string | null) : null, extra: c.void_reason },
    ];
    const visible = rows.filter(r => r.at);
    if (!visible.length) return null;
    return (
        <div className="ws-panel__sec">
            <span className="ws-label">{t('workspace.history.title')}</span>
            <ol className="ws-history">
                {visible.map(r => (
                    <li key={r.k} className={`is-${r.k}`}>
                        <i aria-hidden="true" />
                        <div><b>{t(`workspace.history.${r.k}`)}</b><span>{formatDateTime(r.at!)}</span>{r.extra && <q>{r.extra}</q>}</div>
                    </li>
                ))}
            </ol>
        </div>
    );
}
