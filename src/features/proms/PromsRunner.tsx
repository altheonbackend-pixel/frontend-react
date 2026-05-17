// CR-P3-12 — PROMs administration UI.
//
// One component that:
//   - Lists available questionnaires (PHQ-9, GAD-7, AUDIT-C, custom).
//   - Renders a selected one inline as a clickable scale.
//   - Submits answers → backend auto-scores and bands.
//   - Shows the patient's prior responses (history with trend chip).

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../shared/services/api';
import { toast } from '../../shared/components/ui';
import { SkeletonList } from '../../shared/components/ui/Skeleton';

interface QChoice { label: string; value: number; }
interface QItem { id: string; text: string; choices: QChoice[]; }
interface Questionnaire {
    id: number; kind: string; name: string; description: string;
    items: QItem[]; scoring_rules: { method: string; bands?: { min: number; max: number; label: string }[] };
}
interface Response {
    id: number; questionnaire: number; questionnaire_kind: string; questionnaire_name: string;
    answers: Record<string, number>; total_score: number; severity_band: string;
    completed_at: string;
}

export function PromsRunner({ patientId }: { patientId: string }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [selectedQ, setSelectedQ] = useState<Questionnaire | null>(null);
    const [answers, setAnswers] = useState<Record<string, number>>({});

    const questionnaires = useQuery({
        queryKey: ['proms-instruments'],
        queryFn: async () => (await api.get<{ results?: Questionnaire[] } | Questionnaire[]>('/questionnaires/')).data,
        staleTime: 5 * 60_000,
    });
    const list = Array.isArray(questionnaires.data)
        ? questionnaires.data
        : (questionnaires.data?.results ?? []);

    const responses = useQuery({
        queryKey: ['proms-responses', patientId],
        queryFn: async () => (await api.get<{ results?: Response[] } | Response[]>(`/questionnaire-responses/?patient=${patientId}`)).data,
    });
    const responsesList: Response[] = Array.isArray(responses.data)
        ? responses.data
        : (responses.data?.results ?? []);

    const startQuestionnaire = (q: Questionnaire) => {
        setSelectedQ(q);
        setAnswers({});
    };

    const submit = async () => {
        if (!selectedQ) return;
        if (Object.keys(answers).length < selectedQ.items.length) {
            toast.error(t('proms.toast.incomplete', 'Please answer every item.'));
            return;
        }
        try {
            await api.post('/questionnaire-responses/', {
                patient: patientId,
                questionnaire: selectedQ.id,
                answers,
                source: 'in_office',
            });
            toast.success(t('proms.toast.saved', 'Response recorded.'));
            setSelectedQ(null);
            setAnswers({});
            qc.invalidateQueries({ queryKey: ['proms-responses', patientId] });
            qc.invalidateQueries({ queryKey: ['care-gaps'] });
        } catch (e: unknown) {
            toast.error(
                (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                || 'Could not save.',
            );
        }
    };

    const currentTotal = useMemo(() => {
        return Object.values(answers).reduce((s, v) => s + (v || 0), 0);
    }, [answers]);

    if (selectedQ) {
        return (
            <div style={{ padding: '1rem' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>{selectedQ.name}</h2>
                        <small style={{ color: 'var(--text-muted)' }}>{selectedQ.description}</small>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedQ(null)}>
                        {t('common.cancel', 'Cancel')}
                    </button>
                </header>

                <ol style={{ paddingLeft: 0, listStyle: 'none' }}>
                    {selectedQ.items.map((item, idx) => (
                        <li key={item.id} style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                            <div style={{ marginBottom: '0.5rem' }}>{idx + 1}. {item.text}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {item.choices.map(c => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        className={`btn btn-sm ${answers[item.id] === c.value ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setAnswers({ ...answers, [item.id]: c.value })}
                                    >
                                        {c.label} ({c.value})
                                    </button>
                                ))}
                            </div>
                        </li>
                    ))}
                </ol>

                <footer style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 8,
                    border: '1px solid var(--border-default)',
                }}>
                    <strong>{t('proms.current_total', 'Current total')}: {currentTotal}</strong>
                    <button type="button" className="btn btn-primary" onClick={submit}>
                        {t('proms.submit', 'Submit')}
                    </button>
                </footer>
            </div>
        );
    }

    return (
        <div style={{ padding: '1rem' }}>
            <h2 style={{ margin: '0 0 1rem' }}>{t('proms.title', 'Patient-Reported Outcomes')}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: '1.5rem' }}>
                {questionnaires.isLoading && <SkeletonList count={3} />}
                {list.map(q => (
                    <button
                        key={q.id}
                        type="button"
                        onClick={() => startQuestionnaire(q)}
                        style={{
                            padding: '0.75rem', borderRadius: 12,
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                            textAlign: 'left', cursor: 'pointer',
                        }}
                    >
                        <strong>{q.name}</strong>
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>{q.description}</small>
                    </button>
                ))}
            </div>

            <h3 style={{ margin: '0 0 0.5rem' }}>{t('proms.history', 'History')}</h3>
            {responses.isLoading && <SkeletonList count={3} />}
            {!responses.isLoading && responsesList.length === 0 && (
                <p style={{ color: 'var(--text-muted)' }}>{t('proms.no_history', 'No prior responses.')}</p>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {responsesList.map(r => (
                    <li key={r.id} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                        <strong>{r.questionnaire_name}</strong>: {r.total_score} ({r.severity_band})
                        <small style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
                            {new Date(r.completed_at).toLocaleString()}
                        </small>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default PromsRunner;
