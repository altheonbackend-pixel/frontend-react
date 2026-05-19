// src/features/referrals/components/ReferralSnapshotView.tsx

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/queryKeys';
import { getSnapshot } from '../services/referralService';
import { type ReferralSnapshot } from '../../../shared/types';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';

interface Props {
    referralId: number;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            {title}
        </div>
        {children}
    </div>
);

const EmptyNote = ({ text }: { text: string }) => (
    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{text}</span>
);

const ReferralSnapshotView = ({ referralId }: Props) => {
    const { t } = useTranslation();
    const { formatDate, formatDateTime } = useFormatDateTime();
    const [open, setOpen] = useState(false);

    const { data: snapshot, isLoading, isError } = useQuery<ReferralSnapshot>({
        queryKey: queryKeys.referrals.snapshot(referralId),
        queryFn: async () => {
            const res = await getSnapshot(referralId);
            return res.data as ReferralSnapshot;
        },
        enabled: open,
        staleTime: Infinity,
    });

    return (
        <div style={{ marginTop: '0.5rem' }}>
            <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                onClick={() => setOpen(o => !o)}
            >
                {open ? t('referrals.snapshot.hide') : t('referrals.snapshot.view')}
            </button>

            {open && (
                <div style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.875rem',
                }}>
                    {isLoading && <div style={{ color: 'var(--text-muted)' }}>{t('referrals.snapshot.loading')}</div>}
                    {isError && <div style={{ color: 'var(--color-danger)' }}>{t('referrals.snapshot.error')}</div>}

                    {snapshot && (
                        <>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                {t('referrals.snapshot.captured', { date: formatDateTime(snapshot.captured_at) })}
                            </div>

                            <Section title={t('patient_record.overview.active_medications', { count: snapshot.active_medications.length })}>
                                {snapshot.active_medications.length === 0 ? <EmptyNote text={t('referrals.snapshot.none_recorded')} /> : (
                                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                                        {snapshot.active_medications.map((m, i) => (
                                            <li key={i}><strong>{m.name}</strong>{m.dosage ? ` — ${m.dosage}` : ''}{m.notes ? ` (${m.notes})` : ''}</li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            <Section title={t('referrals.snapshot.active_conditions')}>
                                {snapshot.active_conditions.length === 0 ? <EmptyNote text={t('referrals.snapshot.none_recorded')} /> : (
                                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                                        {snapshot.active_conditions.map((c, i) => (
                                            <li key={i}><strong>{c.name}</strong>{c.icd_code ? ` [${c.icd_code}]` : ''} — {c.status}</li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            <Section title={t('referrals.snapshot.known_allergies')}>
                                {snapshot.active_allergies.length === 0 ? <EmptyNote text={t('referrals.snapshot.none_recorded')} /> : (
                                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                                        {snapshot.active_allergies.map((a, i) => (
                                            <li key={i}><strong>{a.allergen}</strong> — {a.severity}{a.reaction ? ` (${a.reaction})` : ''}</li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            {Object.keys(snapshot.recent_vitals ?? {}).length > 0 && (
                                <Section title={t('referrals.snapshot.recent_vitals')}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {Object.entries(snapshot.recent_vitals).map(([key, val]) => (
                                            <span key={key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.15rem 0.45rem', fontSize: '0.8rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>{key.replace(/_/g, ' ')}: </span>
                                                <strong>{String(val)}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </Section>
                            )}

                            <Section title={t('referrals.snapshot.recent_labs')}>
                                {snapshot.recent_lab_results.length === 0 ? <EmptyNote text={t('referrals.snapshot.none_recorded')} /> : (
                                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                                        {snapshot.recent_lab_results.map((l, i) => (
                                            <li key={i}><strong>{l.test_name}</strong>: {l.result}{l.units ? ` ${l.units}` : ''} — {formatDate(l.date)}</li>
                                        ))}
                                    </ul>
                                )}
                            </Section>

                            {snapshot.referring_doctor_notes && (
                                <Section title={t('referrals.snapshot.referring_notes')}>
                                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{snapshot.referring_doctor_notes}</p>
                                </Section>
                            )}

                            {snapshot.icd_codes_at_referral.length > 0 && (
                                <Section title={t('referrals.snapshot.icd_codes')}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                        {snapshot.icd_codes_at_referral.map((code, i) => (
                                            <span key={i} style={{ fontFamily: 'monospace', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.1rem 0.4rem', fontSize: '0.8rem' }}>{code}</span>
                                        ))}
                                    </div>
                                </Section>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReferralSnapshotView;
