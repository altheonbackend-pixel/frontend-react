import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type GlobalStats, type WorkplaceStats } from '../../../shared/types';
import api from '../../../shared/services/api';
import { useAuth } from '../../auth/hooks/useAuth';
import '../styles/Statistics.css';
import PageLoader from '../../../shared/components/PageLoader';

interface SortConfig {
    key: 'name' | 'patient_count' | 'consultation_count' | 'procedure_count' | null;
    direction: 'ascending' | 'descending';
}

function Statistics_Globale() {
    const { t } = useTranslation();
    const { isAuthenticated, authIsLoading } = useAuth();

    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'ascending' });

    const loadStats = useCallback(async () => {
        if (!isAuthenticated || authIsLoading) {
            setLoading(false);
            return;
        }
        setLoading(true);

        try {
            const response = await api.get('/stats/global/');
            setStats(response.data);
            setError(null);
        } catch {
            setError(t('statistics_global.error.generic'));
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, authIsLoading, t]);

    useEffect(() => {
        if (isAuthenticated && !authIsLoading) loadStats();
    }, [loadStats, isAuthenticated, authIsLoading]);

    const filteredAndSortedWorkplaces = useMemo(() => {
        if (!stats) return [];
        let data: WorkplaceStats[] = stats.stats_by_workplace;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(w => w.name.toLowerCase().includes(lower));
        }
        if (!sortConfig.key) return data;
        const key = sortConfig.key;
        return [...data].sort((a, b) => {
            const cmp = a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0;
            return sortConfig.direction === 'ascending' ? cmp : -cmp;
        });
    }, [stats, searchTerm, sortConfig]);

    const requestSort = (key: SortConfig['key']) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
        }));
    };

    const getSortIcon = (key: SortConfig['key']) => {
        if (sortConfig.key !== key) return '↕';
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    if (authIsLoading || loading) return <PageLoader message={t('statistics_global.loading')} />;
    if (!isAuthenticated) return <div className="stats-container">{t('statistics_global.unauthorized')}</div>;
    if (error) return <div className="stats-container stats-error">{error}</div>;
    if (!stats) return <div className="stats-container">{t('statistics_global.no_data')}</div>;

    return (
        <div className="stats-container">
            <header className="stats-header">
                <h1>{t('statistics_global.title')}</h1>
            </header>
            <main className="stats-content">
                <section className="stats-section global-totals">
                    <h2>{t('statistics_global.totals.title')}</h2>
                    <div className="stats-grid">
                        <div className="stat-card"><h3>{t('statistics_global.totals.doctors')}</h3><p className="stat-number">{stats.total_doctors}</p></div>
                        <div className="stat-card"><h3>{t('statistics_global.totals.workplaces')}</h3><p className="stat-number">{stats.total_workplaces}</p></div>
                        <div className="stat-card"><h3>{t('statistics_global.totals.patients')}</h3><p className="stat-number">{stats.total_patients}</p></div>
                        <div className="stat-card"><h3>{t('statistics_global.totals.consultations')}</h3><p className="stat-number">{stats.total_consultations}</p></div>
                        <div className="stat-card"><h3>{t('statistics_global.totals.referrals')}</h3><p className="stat-number">{stats.total_referrals}</p></div>
                        <div className="stat-card"><h3>{t('statistics_global.totals.procedures')}</h3><p className="stat-number">{stats.total_procedures}</p></div>
                    </div>
                </section>

                <section className="stats-section stats-controls">
                    <div className="stats-search-row">
                        <label className="stats-search-label">{t('statistics_global.search_label')}</label>
                        <input
                            type="text"
                            className="stats-search-input"
                            placeholder={t('statistics_global.search_placeholder')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </section>

                <section className="stats-section">
                    <h2>{t('statistics_global.workplace.title')}</h2>
                    <div className="stats-table-container">
                        <table className="stats-table">
                            <thead>
                                <tr>
                                    <th onClick={() => requestSort('name')}>{t('statistics_global.workplace.columns.name')} {getSortIcon('name')}</th>
                                    <th onClick={() => requestSort('patient_count')}>{t('statistics_global.workplace.columns.patients')} {getSortIcon('patient_count')}</th>
                                    <th onClick={() => requestSort('consultation_count')}>{t('statistics_global.workplace.columns.consultations')} {getSortIcon('consultation_count')}</th>
                                    <th onClick={() => requestSort('procedure_count')}>{t('statistics_global.workplace.columns.procedures')} {getSortIcon('procedure_count')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedWorkplaces.length > 0 ? (
                                    filteredAndSortedWorkplaces.map(w => (
                                        <tr key={w.id}>
                                            <td>{w.name}</td>
                                            <td>{w.patient_count}</td>
                                            <td>{w.consultation_count}</td>
                                            <td>{w.procedure_count}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={4}>{t('statistics_global.workplace.no_data')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default Statistics_Globale;
