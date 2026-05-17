// CR-P2-07 — Doctor task inbox.
//
// Combines five action surfaces in one place:
//   1. Open clinical alerts (critical labs, drug-allergy conflicts)
//   2. Care-plan tasks (open + overdue)
//   3. Overdue follow-ups
//   4. Overdue referrals
//   5. Unread patient messages
//
// Each row is one-click navigable; bulk-actionable where it makes sense.

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../shared/services/api';
import { Icon } from '../../shared/components/Icons';
import { SkeletonList } from '../../shared/components/ui/Skeleton';
import { toast } from '../../shared/components/ui';
import { useFormatDateTime } from '../../shared/hooks/useUserTimezone';

type Tab = 'tasks' | 'alerts' | 'followups' | 'referrals' | 'messages' | 'gaps';

interface CareTask {
    id: number; title: string; description: string;
    kind: string; due_date: string; status: string;
    patient: string; patient_name: string; is_overdue: boolean;
}
interface ClinicalAlert {
    id: number; alert_type: string; severity: string;
    title: string; body: string; is_open: boolean;
    patient: number;
}
interface OverdueFollowup {
    consultation_id: number; patient_id: string; patient_name: string;
    follow_up_date: string; days_overdue: number; reason: string;
}
interface OverdueReferral {
    referral_id: number; patient_id: string; patient_name: string;
    specialty: string; urgency: string; status: string;
    sla_due_at: string; days_overdue: number; specialist: string;
}
interface PatientMsg {
    id: number; patient: string; patient_name: string;
    sender_type: string; subject: string; body: string;
    urgency: string; is_read_by_recipient: boolean; created_at: string;
}
interface CareGap {
    id: number; patient: string; patient_name: string;
    measure_display: string; severity: string;
    next_due: string | null; rationale: string;
}

const TAB_LABEL: Record<Tab, string> = {
    tasks: 'Care tasks',
    alerts: 'Critical alerts',
    followups: 'Overdue follow-ups',
    referrals: 'Overdue referrals',
    messages: 'Patient messages',
    gaps: 'Care gaps',
};

export function Inbox() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const navigate = useNavigate();
    const { formatDate } = useFormatDateTime();
    const [tab, setTab] = useState<Tab>('tasks');

    const tasks = useQuery({
        queryKey: ['inbox', 'tasks'],
        queryFn: async () => (await api.get<{ results: CareTask[] } | CareTask[]>('/care-tasks/?open=true')).data,
    });
    const alerts = useQuery({
        queryKey: ['inbox', 'alerts'],
        queryFn: async () => (await api.get<{ results: ClinicalAlert[] } | ClinicalAlert[]>('/clinical-alerts/?open=true')).data,
    });
    const followups = useQuery({
        queryKey: ['inbox', 'followups'],
        queryFn: async () => (await api.get<{ overdue: OverdueFollowup[]; count: number }>('/reports/overdue-followups/')).data,
    });
    const overdueReferrals = useQuery({
        queryKey: ['inbox', 'referrals-overdue'],
        queryFn: async () => (await api.get<{ overdue: OverdueReferral[]; count: number }>('/reports/overdue-referrals/')).data,
    });
    const messages = useQuery({
        queryKey: ['inbox', 'messages'],
        queryFn: async () => (await api.get<{ results: PatientMsg[] } | PatientMsg[]>('/patient-messages/?unread=true')).data,
    });
    const gaps = useQuery({
        queryKey: ['inbox', 'gaps'],
        queryFn: async () => (await api.get<{ results: CareGap[] } | CareGap[]>('/care-gaps/?open=true')).data,
    });

    const toList = <T,>(d: unknown): T[] => {
        if (!d) return [];
        if (Array.isArray(d)) return d as T[];
        const o = d as { results?: T[]; overdue?: T[] };
        return (o.results ?? o.overdue ?? []) as T[];
    };

    const counts = useMemo(() => ({
        tasks: toList<CareTask>(tasks.data).length,
        alerts: toList<ClinicalAlert>(alerts.data).length,
        followups: toList<OverdueFollowup>(followups.data).length,
        referrals: toList<OverdueReferral>(overdueReferrals.data).length,
        messages: toList<PatientMsg>(messages.data).length,
        gaps: toList<CareGap>(gaps.data).length,
    }), [tasks.data, alerts.data, followups.data, overdueReferrals.data, messages.data, gaps.data]);

    const total = counts.tasks + counts.alerts + counts.followups + counts.referrals + counts.messages;

    return (
        <div className="page-wrapper">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
                <h1 style={{ margin: 0 }}>{t('inbox.title', 'My Inbox')}</h1>
                <small style={{ color: 'var(--text-muted)' }}>
                    {total === 0
                        ? t('inbox.all_clear', 'You\'re all caught up — nothing needs your attention right now.')
                        : t('inbox.pending', '{{n}} pending items', { n: total })}
                </small>
            </header>

            <div className="db-tabs" style={{ marginBottom: '1rem' }}>
                {(Object.keys(TAB_LABEL) as Tab[]).map(k => (
                    <button
                        key={k}
                        type="button"
                        className={`db-tab-btn${tab === k ? ' active' : ''}`}
                        onClick={() => setTab(k)}
                    >
                        {t(`inbox.tab.${k}`, TAB_LABEL[k])}
                        {counts[k] > 0 && <span className="db-tab-count">{counts[k]}</span>}
                    </button>
                ))}
            </div>

            {tab === 'tasks' && (
                tasks.isLoading ? <SkeletonList count={5} /> :
                toList<CareTask>(tasks.data).length === 0 ? <EmptyHint icon="check" label={t('inbox.empty.tasks', 'No open care-plan tasks 🎉')} /> :
                <ul className="inbox-list">
                    {toList<CareTask>(tasks.data).map(t => (
                        <li key={t.id} className={`inbox-row inbox-row--task${t.is_overdue ? ' inbox-row--overdue' : ''}`}>
                            <Link to={`/patients/${t.patient}`} style={{ flex: 1 }}>
                                <strong>{t.title}</strong>
                                <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                                    {t.patient_name} · due {formatDate(t.due_date)}
                                    {t.is_overdue && <span className="badge badge-danger" style={{ marginLeft: 6 }}>{t.kind}</span>}
                                </small>
                            </Link>
                            <button
                                type="button" className="btn btn-secondary btn-sm"
                                onClick={async () => {
                                    await api.post(`/care-tasks/${t.id}/complete/`);
                                    toast.success('Done');
                                    qc.invalidateQueries({ queryKey: ['inbox'] });
                                }}
                            ><Icon name="check" size={14} /> {/* shown for accessibility */}</button>
                        </li>
                    ))}
                </ul>
            )}

            {tab === 'alerts' && (
                alerts.isLoading ? <SkeletonList count={5} /> :
                toList<ClinicalAlert>(alerts.data).length === 0 ? <EmptyHint icon="check" label={t('inbox.empty.alerts', 'No open critical alerts')} /> :
                <ul className="inbox-list">
                    {toList<ClinicalAlert>(alerts.data).map(a => (
                        <li key={a.id} className={`inbox-row inbox-row--alert inbox-row--sev-${a.severity}`}>
                            <Icon name="alert" size={18} />
                            <div style={{ flex: 1 }}>
                                <strong>{a.title}</strong>
                                <small style={{ display: 'block', color: 'var(--text-muted)' }}>{a.body.slice(0, 120)}</small>
                            </div>
                            <button
                                type="button" className="btn btn-primary btn-sm"
                                onClick={async () => {
                                    await api.post(`/clinical-alerts/${a.id}/acknowledge/`, { acknowledgement_note: 'reviewed via inbox' });
                                    qc.invalidateQueries({ queryKey: ['inbox', 'alerts'] });
                                }}
                            >{t('inbox.acknowledge', 'Acknowledge')}</button>
                        </li>
                    ))}
                </ul>
            )}

            {tab === 'followups' && (
                followups.isLoading ? <SkeletonList count={5} /> :
                toList<OverdueFollowup>(followups.data).length === 0 ? <EmptyHint icon="check" label={t('inbox.empty.followups', 'No overdue follow-ups')} /> :
                <ul className="inbox-list">
                    {toList<OverdueFollowup>(followups.data).map(f => (
                        <li key={f.consultation_id} className="inbox-row">
                            <Link to={`/patients/${f.patient_id}`} style={{ flex: 1 }}>
                                <strong>{f.patient_name}</strong>
                                <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                                    {f.reason} · overdue by {f.days_overdue} days
                                </small>
                            </Link>
                            <button
                                type="button" className="btn btn-secondary btn-sm"
                                onClick={() => navigate(`/patients/${f.patient_id}?action=schedule-followup&consult=${f.consultation_id}`)}
                            >{t('inbox.schedule', 'Schedule')}</button>
                        </li>
                    ))}
                </ul>
            )}

            {tab === 'referrals' && (
                overdueReferrals.isLoading ? <SkeletonList count={5} /> :
                toList<OverdueReferral>(overdueReferrals.data).length === 0 ? <EmptyHint icon="check" label={t('inbox.empty.referrals', 'No overdue referrals')} /> :
                <ul className="inbox-list">
                    {toList<OverdueReferral>(overdueReferrals.data).map(r => (
                        <li key={r.referral_id} className={`inbox-row inbox-row--sev-${r.urgency}`}>
                            <Link to={`/referrals/${r.referral_id}`} style={{ flex: 1 }}>
                                <strong>{r.patient_name} → {r.specialty} ({r.specialist})</strong>
                                <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                                    {r.status} · overdue by {r.days_overdue} days
                                </small>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            {tab === 'messages' && (
                messages.isLoading ? <SkeletonList count={5} /> :
                toList<PatientMsg>(messages.data).length === 0 ? <EmptyHint icon="mail" label={t('inbox.empty.messages', 'No unread patient messages')} /> :
                <ul className="inbox-list">
                    {toList<PatientMsg>(messages.data).map(m => (
                        <li key={m.id} className={`inbox-row inbox-row--message inbox-row--sev-${m.urgency}`}>
                            <Link to={`/messages?thread=${m.id}`} style={{ flex: 1 }}>
                                <strong>{m.patient_name}{m.subject ? ` — ${m.subject}` : ''}</strong>
                                <small style={{ display: 'block', color: 'var(--text-muted)' }}>{m.body.slice(0, 140)}</small>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            {tab === 'gaps' && (
                gaps.isLoading ? <SkeletonList count={5} /> :
                toList<CareGap>(gaps.data).length === 0 ? <EmptyHint icon="check" label={t('inbox.empty.gaps', 'No open care gaps')} /> :
                <ul className="inbox-list">
                    {toList<CareGap>(gaps.data).map(g => (
                        <li key={g.id} className={`inbox-row inbox-row--sev-${g.severity}`}>
                            <Link to={`/patients/${g.patient}`} style={{ flex: 1 }}>
                                <strong>{g.patient_name} — {g.measure_display}</strong>
                                <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                                    {g.rationale}{g.next_due ? ` · due ${formatDate(g.next_due)}` : ''}
                                </small>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function EmptyHint({ icon, label }: { icon: 'check' | 'mail'; label: string }) {
    return (
        <div style={{
            padding: '3rem', textAlign: 'center',
            color: 'var(--text-muted)', background: 'var(--bg-subtle)',
            borderRadius: 12,
        }}>
            <div style={{ marginBottom: 12 }}><Icon name={icon} size={48} /></div>
            {label}
        </div>
    );
}

export default Inbox;
