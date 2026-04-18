// src/features/statistics/components/Statistics.tsx
// Phase 9: Monthly BarChart, patient status PieChart — all Recharts use CSS variables

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../../../shared/services/api';
import { queryKeys } from '../../../shared/queryKeys';
import { PageHeader } from '../../../shared/components/PageHeader';
import { StatCard } from '../../../shared/components/StatCard';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

interface MonthlyPoint {
    month: string;
    consultations: number;
    procedures: number;
}

interface PatientStat {
    unique_id: string;
    full_name: string;
    consultations_count: number;
    medical_procedures_count: number;
    referrals_count: number;
}

interface Stats {
    total_patients: number;
    total_consultations: number;
    total_medical_procedures: number;
    monthly_data: MonthlyPoint[];
    patient_status: Record<string, number>;
    patients: PatientStat[];
}

const TOOLTIP_STYLE = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
};

const STATUS_LABELS: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    transferred: 'Transferred',
    deceased: 'Deceased',
};

const STATUS_COLORS: Record<string, string> = {
    active: 'var(--success)',
    inactive: 'var(--text-muted)',
    transferred: 'var(--info)',
    deceased: 'var(--danger)',
};

const Statistics = () => {
    const { t } = useTranslation();
    usePageTitle(t('pages.statistics', 'My Stats'));

    const { data: stats, isLoading, isError } = useQuery<Stats>({
        queryKey: queryKeys.stats.doctor(),
        queryFn: async () => {
            const [statsRes, patientsRes] = await Promise.all([
                api.get('/doctor/stats/'),
                api.get('/doctor-patients/stats/'),
            ]);
            return {
                total_patients: statsRes.data.total_patients,
                total_consultations: statsRes.data.total_consultations,
                total_medical_procedures: statsRes.data.total_medical_procedures,
                monthly_data: statsRes.data.monthly_data ?? [],
                patient_status: statsRes.data.patient_status ?? {},
                patients: patientsRes.data.results ?? patientsRes.data,
            };
        },
        staleTime: 5 * 60 * 1000,
    });

    // Monthly BarChart data
    const monthlyData: MonthlyPoint[] = stats?.monthly_data ?? [];

    // Patient status PieChart data
    const statusData = Object.entries(stats?.patient_status ?? {})
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({
            name: STATUS_LABELS[status] ?? status,
            value: count,
            key: status,
        }));

    return (
        <>
            <PageHeader
                title={t('statistics.title', 'My Statistics')}
                subtitle={t('statistics.subtitle', 'Overview of your clinical activity')}
            />

            {isError && (
                <div className="error-message" style={{ marginBottom: '1rem' }}>
                    {t('statistics.error.load', 'Failed to load statistics.')}
                </div>
            )}

            {/* Summary StatCards */}
            {isLoading ? (
                <div className="section-card" style={{ marginBottom: '1.25rem' }}>
                    <div className="section-card-body"><TabSkeleton rows={2} /></div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <StatCard
                        icon="👥"
                        label={t('statistics.total_patients', 'Total Patients')}
                        value={stats?.total_patients ?? 0}
                    />
                    <StatCard
                        icon="🩺"
                        label={t('statistics.total_consultations', 'Consultations')}
                        value={stats?.total_consultations ?? 0}
                    />
                    <StatCard
                        icon="⚕️"
                        label={t('statistics.total_procedures', 'Procedures')}
                        value={stats?.total_medical_procedures ?? 0}
                    />
                </div>
            )}

            {/* Charts row */}
            {!isLoading && stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    {/* Monthly consultation BarChart */}
                    <div className="section-card">
                        <div className="section-card-header">
                            <span className="section-card-title">Monthly Activity (last 6 months)</span>
                        </div>
                        <div className="section-card-body" style={{ height: 260 }}>
                            {monthlyData.some(m => m.consultations > 0 || m.procedures > 0) ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                        <Bar dataKey="consultations" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Consultations" />
                                        <Bar dataKey="procedures" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} name="Procedures" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">📊</div>
                                    <div className="empty-state-title">No activity in the last 6 months</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Patient status PieChart */}
                    <div className="section-card">
                        <div className="section-card-header">
                            <span className="section-card-title">Patient Status</span>
                        </div>
                        <div className="section-card-body" style={{ height: 260 }}>
                            {statusData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusData}
                                            cx="50%"
                                            cy="45%"
                                            outerRadius={90}
                                            paddingAngle={3}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                            labelLine={false}
                                        >
                                            {statusData.map((entry) => (
                                                <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? 'var(--text-muted)'} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                                        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">🥧</div>
                                    <div className="empty-state-title">No patients yet</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Per-patient detail table */}
            <div className="section-card">
                <div className="section-card-header">
                    <span className="section-card-title">{t('statistics.detail_title', 'Patient Detail')}</span>
                </div>
                <div className="section-card-body section-card-body--flush">
                    {isLoading ? (
                        <div style={{ padding: '1rem' }}><TabSkeleton rows={4} /></div>
                    ) : !stats?.patients?.length ? (
                        <div className="empty-state" style={{ padding: '2rem' }}>
                            <div className="empty-state-icon">📋</div>
                            <div className="empty-state-title">{t('statistics.no_data', 'No patient data available yet.')}</div>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1.5px solid var(--border-subtle)', background: 'var(--bg-muted)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.625rem 1rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {t('statistics.columns.patient', 'Patient')}
                                        </th>
                                        <th style={{ textAlign: 'center', padding: '0.625rem 0.75rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {t('statistics.columns.consultations', 'Consults')}
                                        </th>
                                        <th style={{ textAlign: 'center', padding: '0.625rem 0.75rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {t('statistics.columns.procedures', 'Procedures')}
                                        </th>
                                        <th style={{ textAlign: 'center', padding: '0.625rem 0.75rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {t('statistics.columns.referrals', 'Referrals')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.patients.map((patient, idx) => (
                                        <tr
                                            key={patient.unique_id}
                                            style={{
                                                borderBottom: '1px solid var(--border-subtle)',
                                                background: idx % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-subtle)',
                                            }}
                                        >
                                            <td style={{ padding: '0.625rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                <Link to={`/patients/${patient.unique_id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                                    {patient.full_name}
                                                </Link>
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                                                {patient.consultations_count}
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                                                {patient.medical_procedures_count}
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                                                {patient.referrals_count}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .stats-charts-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </>
    );
};

export default Statistics;
