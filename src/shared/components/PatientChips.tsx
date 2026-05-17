// Sticky patient context strip — appears at the top of every patient
// screen. Shows allergies (RED if any drug allergy), active problems
// count, last BP, MRN. Pulls from a single denormalised endpoint
// `/patients/<id>/chips/` (cached 60s).

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Icon } from './Icons';

interface ChipsData {
    unique_id: string;
    first_name: string;
    last_name: string;
    mrn: string;
    date_of_birth: string | null;
    age: number | null;
    sex_assigned_at_birth: string;
    pronouns: string;
    preferred_name: string;
    has_nkda: boolean;
    drug_allergies: { allergen: string; severity: string }[];
    active_problem_count: number;
    last_bp: string | null;
    primary_doctor_name: string | null;
}

interface PatientChipsProps {
    patientId: string;
}

export function PatientChips({ patientId }: PatientChipsProps) {
    const { t } = useTranslation();
    const { data, isLoading } = useQuery({
        queryKey: ['patient-chips', patientId],
        queryFn: async () => {
            const res = await api.get<ChipsData>(`/patients/${patientId}/chips/`);
            return res.data;
        },
        staleTime: 60_000,
    });

    if (isLoading || !data) {
        return (
            <div className="patient-chips patient-chips--loading">
                <div className="skeleton" style={{ height: 36 }} />
            </div>
        );
    }

    const lifeThreatening = data.drug_allergies.some(a => a.severity === 'life_threatening');
    const anyAllergy = data.drug_allergies.length > 0;

    return (
        <div
            className="patient-chips"
            style={{
                display: 'flex', gap: '0.5rem', alignItems: 'center',
                padding: '0.5rem 0.75rem',
                background: 'var(--bg-subtle, #fafafa)',
                borderBottom: '1px solid var(--border-default, #e5e7eb)',
                flexWrap: 'wrap',
            }}
        >
            <strong style={{ fontSize: '0.95rem' }}>
                {data.preferred_name || data.first_name} {data.last_name}
            </strong>
            {data.pronouns && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    ({data.pronouns})
                </span>
            )}
            <span className="chip">
                {data.age !== null ? `${data.age}y` : '—'}
                {data.sex_assigned_at_birth && ` · ${data.sex_assigned_at_birth[0].toUpperCase()}`}
            </span>
            {data.mrn && (
                <span className="chip chip-muted">MRN {data.mrn}</span>
            )}
            {anyAllergy ? (
                <span
                    className={`chip ${lifeThreatening ? 'chip-danger-strong' : 'chip-danger'}`}
                    title={data.drug_allergies.map(a => `${a.allergen} (${a.severity})`).join(', ')}
                    style={{
                        background: lifeThreatening ? '#7f1d1d' : '#fee2e2',
                        color: lifeThreatening ? 'white' : '#991b1b',
                        fontWeight: 600,
                    }}
                >
                    <Icon name="alert" size={12} /> {t('chips.allergies', 'Allergies')}: {data.drug_allergies.length}
                </span>
            ) : data.has_nkda ? (
                <span className="chip chip-success" style={{
                    background: '#d1fae5', color: '#065f46',
                }}>
                    {t('chips.nkda', 'NKDA confirmed')}
                </span>
            ) : (
                <span className="chip chip-warning" style={{
                    background: '#fef3c7', color: '#92400e',
                }}>
                    {t('chips.allergies_unknown', 'Allergies not reconciled')}
                </span>
            )}
            {data.active_problem_count > 0 && (
                <span className="chip">
                    {t('chips.problems', 'Problems')}: {data.active_problem_count}
                </span>
            )}
            {data.last_bp && (
                <span className="chip">BP {data.last_bp}</span>
            )}
        </div>
    );
}

export default PatientChips;
