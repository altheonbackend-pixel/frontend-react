// CR-P1-02 — Problem-oriented record view.

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../../../shared/services/api';
import { SkeletonList } from '../../../shared/components/ui/Skeleton';
import { Icon } from '../../../shared/components/Icons';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';

interface ProblemItem {
    condition: { id: number; name: string; icd_code: string; status: string; onset_date: string | null; notes: string };
    recent_consultations: { id: number; consultation_date: string; diagnosis: string; assessment: string }[];
    active_medications: { id: number; medication__custom_drug_name: string; medication__rxnorm_rxcui: string; dosage: string; frequency: string; start_date: string }[];
    related_referrals: { id: number; specialty_requested: string; status: string; date_of_referral: string }[];
}

export function ProblemListTab({ patientId }: { patientId: string }) {
    const { t } = useTranslation();
    const { formatDate } = useFormatDateTime();
    const { data, isLoading } = useQuery({
        queryKey: ['problem-list', patientId],
        queryFn: async () => (await api.get<{ problems: ProblemItem[] }>(`/patients/${patientId}/problem-list/`)).data,
        staleTime: 60_000,
    });

    if (isLoading) return <SkeletonList count={4} />;
    if (!data || data.problems.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Icon name="info" size={32} />
                <p>{t('problem_list.empty', 'No active problems recorded for this patient.')}</p>
            </div>
        );
    }

    return (
        <div className="problem-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.problems.map(p => (
                <article
                    key={p.condition.id}
                    style={{
                        background: 'var(--bg-elevated)',
                        borderRadius: 12,
                        padding: '1rem',
                        border: '1px solid var(--border-default)',
                    }}
                >
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>{p.condition.name}</h3>
                            <small style={{ color: 'var(--text-muted)' }}>
                                {p.condition.icd_code && <>ICD-10 {p.condition.icd_code} · </>}
                                {p.condition.status}
                                {p.condition.onset_date && <> · onset {p.condition.onset_date}</>}
                            </small>
                        </div>
                    </header>
                    {p.condition.notes && <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{p.condition.notes}</p>}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <Section title={t('problem_list.consults', 'Recent visits')}>
                            {p.recent_consultations.length === 0
                                ? <Empty />
                                : p.recent_consultations.map(c => (
                                    <li key={c.id}><Link to={`/patients/${patientId}?consultation=${c.id}`}>{formatDate(c.consultation_date)}</Link>
                                    <small style={{ display: 'block', color: 'var(--text-muted)' }}>{(c.diagnosis || c.assessment || '').slice(0, 60)}</small></li>
                                ))
                            }
                        </Section>
                        <Section title={t('problem_list.meds', 'Active medications')}>
                            {p.active_medications.length === 0
                                ? <Empty />
                                : p.active_medications.map(m => (
                                    <li key={m.id}>
                                        <strong>{m.medication__custom_drug_name || m.medication__rxnorm_rxcui}</strong>
                                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>{m.dosage} {m.frequency}</small>
                                    </li>
                                ))
                            }
                        </Section>
                        <Section title={t('problem_list.referrals', 'Related referrals')}>
                            {p.related_referrals.length === 0
                                ? <Empty />
                                : p.related_referrals.map(r => (
                                    <li key={r.id}>
                                        <Link to={`/referrals/${r.id}`}>{r.specialty_requested}</Link>
                                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>{r.status} · {formatDate(r.date_of_referral)}</small>
                                    </li>
                                ))
                            }
                        </Section>
                    </div>
                </article>
            ))}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{title}</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem' }}>{children}</ul>
        </div>
    );
}
function Empty() { return <li style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</li>; }

export default ProblemListTab;
