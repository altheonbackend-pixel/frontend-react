// CR-P1-10 + CR-P1-11 — Overdue reports page (combined view).

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../../shared/services/api';
import { SkeletonList } from '../../shared/components/ui/Skeleton';

export function OverdueReports() {
    const { t } = useTranslation();

    const followups = useQuery({
        queryKey: ['overdue-followups'],
        queryFn: async () => (await api.get<{ overdue: Array<{ consultation_id: number; patient_id: string; patient_name: string; follow_up_date: string; days_overdue: number; reason: string }>; count: number }>('/reports/overdue-followups/')).data,
    });
    const referrals = useQuery({
        queryKey: ['overdue-referrals'],
        queryFn: async () => (await api.get<{ overdue: Array<{ referral_id: number; patient_id: string; patient_name: string; specialty: string; urgency: string; status: string; sla_due_at: string; days_overdue: number; specialist: string }>; count: number }>('/reports/overdue-referrals/')).data,
    });

    return (
        <div className="page-wrapper">
            <h1>{t('reports.overdue_title', 'Overdue & At-Risk Patients')}</h1>

            <section style={{ marginTop: '1.5rem' }}>
                <h2>{t('reports.followups_title', 'Overdue follow-ups')} <span className="db-tab-count">{followups.data?.count ?? 0}</span></h2>
                {followups.isLoading && <SkeletonList count={5} />}
                {followups.data?.overdue.length === 0 && (
                    <p style={{ color: 'var(--text-muted)' }}>{t('reports.followups_empty', 'No overdue follow-ups 🎉')}</p>
                )}
                <ul className="inbox-list">
                    {followups.data?.overdue.map(f => (
                        <li key={f.consultation_id} className="inbox-row">
                            <Link to={`/patients/${f.patient_id}`}><strong>{f.patient_name}</strong></Link>
                            <span style={{ color: 'var(--text-muted)', flex: 1 }}>
                                {f.reason}
                            </span>
                            <span className="badge badge-danger">{t('reports.days_overdue', '{{n}} days', { n: f.days_overdue })}</span>
                        </li>
                    ))}
                </ul>
            </section>

            <section style={{ marginTop: '2rem' }}>
                <h2>{t('reports.referrals_title', 'Overdue referrals (SLA breached)')} <span className="db-tab-count">{referrals.data?.count ?? 0}</span></h2>
                {referrals.isLoading && <SkeletonList count={5} />}
                {referrals.data?.overdue.length === 0 && (
                    <p style={{ color: 'var(--text-muted)' }}>{t('reports.referrals_empty', 'No overdue referrals 🎉')}</p>
                )}
                <ul className="inbox-list">
                    {referrals.data?.overdue.map(r => (
                        <li key={r.referral_id} className={`inbox-row inbox-row--sev-${r.urgency}`}>
                            <Link to={`/referrals/${r.referral_id}`}>
                                <strong>{r.patient_name}</strong> → {r.specialty} ({r.specialist})
                            </Link>
                            <span style={{ color: 'var(--text-muted)' }}>{r.status}</span>
                            <span className="badge badge-danger">{t('reports.days_overdue', '{{n}} days', { n: r.days_overdue })}</span>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

export default OverdueReports;
