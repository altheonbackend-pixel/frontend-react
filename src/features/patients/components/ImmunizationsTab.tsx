// CR-P1-05 — Immunizations tab on PatientDetail.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { toast } from '../../../shared/components/ui';
import { Icon } from '../../../shared/components/Icons';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';

interface Immunization {
    id: number;
    vaccine_name: string;
    cvx_code: string;
    dose_number: number | null;
    administered_at: string;
    expiration_date: string | null;
    lot_number: string;
    manufacturer: string;
    site: string;
    route: string;
    notes: string;
    administered_by_name: string;
}

const VACCINE_PRESETS: { name: string; cvx: string }[] = [
    { name: 'Influenza, inactivated', cvx: '140' },
    { name: 'COVID-19 (mRNA Moderna)', cvx: '207' },
    { name: 'COVID-19 (mRNA Pfizer)', cvx: '208' },
    { name: 'Tdap', cvx: '115' },
    { name: 'Td (adult)', cvx: '113' },
    { name: 'PCV13 (Prevnar 13)', cvx: '133' },
    { name: 'PPSV23 (Pneumovax)', cvx: '109' },
    { name: 'MMR', cvx: '03' },
    { name: 'Varicella', cvx: '21' },
    { name: 'Shingrix', cvx: '187' },
    { name: 'HepB (adult)', cvx: '08' },
    { name: 'HepA (adult)', cvx: '85' },
    { name: 'HPV9', cvx: '165' },
    { name: 'RSV (older adults)', cvx: '305' },
];

export function ImmunizationsTab({ patientId }: { patientId: string }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const { formatDate } = useFormatDateTime();
    const [showAdd, setShowAdd] = useState(false);
    const [draft, setDraft] = useState({
        vaccine_name: '', cvx_code: '',
        administered_at: new Date().toISOString().slice(0, 10),
        lot_number: '', manufacturer: '',
        site: 'left_deltoid', route: 'IM',
        notes: '',
    });

    const { data, isLoading } = useQuery({
        queryKey: ['immunizations', patientId],
        queryFn: async () => (await api.get<{ results?: Immunization[] } | Immunization[]>(
            `/immunizations/?patient=${patientId}`,
        )).data,
        staleTime: 30_000,
    });
    const list: Immunization[] = Array.isArray(data) ? data : (data?.results ?? []);

    const submit = async () => {
        if (!draft.vaccine_name) return;
        try {
            await api.post('/immunizations/', { patient: patientId, ...draft });
            toast.success(t('immunizations.toast.added', 'Vaccine recorded.'));
            setShowAdd(false);
            setDraft({ ...draft, vaccine_name: '', cvx_code: '', lot_number: '' });
            qc.invalidateQueries({ queryKey: ['immunizations', patientId] });
            qc.invalidateQueries({ queryKey: ['care-gaps'] });
        } catch (e: unknown) {
            toast.error(
                (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                || 'Could not save.',
            );
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{t('immunizations.title', 'Immunizations')}</h2>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>
                    <Icon name="plus" size={14} /> {t('immunizations.add', 'Add vaccine')}
                </button>
            </div>

            {showAdd && (
                <div style={{
                    background: 'var(--bg-subtle)', borderRadius: 12, padding: '1rem', marginBottom: '1rem',
                }}>
                    <select
                        className="form-input"
                        onChange={(e) => {
                            const p = VACCINE_PRESETS.find(x => x.cvx === e.target.value);
                            if (p) setDraft({ ...draft, vaccine_name: p.name, cvx_code: p.cvx });
                        }}
                        defaultValue=""
                        style={{ marginBottom: 8 }}
                    >
                        <option value="">{t('immunizations.pick_vaccine', 'Pick a vaccine…')}</option>
                        {VACCINE_PRESETS.map(p => <option key={p.cvx} value={p.cvx}>{p.name}</option>)}
                    </select>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <input className="form-input" type="date" value={draft.administered_at}
                            onChange={e => setDraft({ ...draft, administered_at: e.target.value })} />
                        <input className="form-input" placeholder="Lot #" value={draft.lot_number}
                            onChange={e => setDraft({ ...draft, lot_number: e.target.value })} />
                        <input className="form-input" placeholder="Manufacturer" value={draft.manufacturer}
                            onChange={e => setDraft({ ...draft, manufacturer: e.target.value })} />
                        <select className="form-input" value={draft.site} onChange={e => setDraft({ ...draft, site: e.target.value })}>
                            <option value="left_deltoid">Left deltoid</option>
                            <option value="right_deltoid">Right deltoid</option>
                            <option value="left_thigh">Left thigh</option>
                            <option value="right_thigh">Right thigh</option>
                            <option value="oral">Oral</option>
                            <option value="intranasal">Intranasal</option>
                        </select>
                        <select className="form-input" value={draft.route} onChange={e => setDraft({ ...draft, route: e.target.value })}>
                            <option value="IM">IM</option><option value="SC">SC</option>
                            <option value="ID">ID</option><option value="PO">PO</option>
                            <option value="IN">IN</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={!draft.vaccine_name}>
                            {t('common.save', 'Save')}
                        </button>
                    </div>
                </div>
            )}

            {isLoading && <p>{t('common.loading', 'Loading…')}</p>}
            {!isLoading && list.length === 0 && (
                <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('immunizations.empty', 'No vaccinations recorded.')}
                </p>
            )}
            {list.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: 8 }}>Vaccine</th>
                        <th style={{ padding: 8 }}>CVX</th>
                        <th style={{ padding: 8 }}>Date</th>
                        <th style={{ padding: 8 }}>Lot</th>
                        <th style={{ padding: 8 }}>Given by</th>
                    </tr></thead>
                    <tbody>{list.map(i => (
                        <tr key={i.id} style={{ borderTop: '1px solid var(--border-default)' }}>
                            <td style={{ padding: 8 }}>{i.vaccine_name}</td>
                            <td style={{ padding: 8 }}>{i.cvx_code || '—'}</td>
                            <td style={{ padding: 8 }}>{formatDate(i.administered_at)}</td>
                            <td style={{ padding: 8 }}>{i.lot_number || '—'}</td>
                            <td style={{ padding: 8 }}>{i.administered_by_name}</td>
                        </tr>
                    ))}</tbody>
                </table>
            )}
        </div>
    );
}

export default ImmunizationsTab;
