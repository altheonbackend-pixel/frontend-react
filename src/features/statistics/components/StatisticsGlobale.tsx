import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type GlobalStats, type WorkplaceStats, type DoctorStats } from '../../../shared/types';
import api from '../../../shared/services/api';
import { useAuth } from '../../auth/hooks/useAuth'; 
import '../styles/Statistics.css'; 

// Définition du type pour la configuration de tri
interface SortConfig {
    key: 'name' | 'full_name' | 'patient_count' | 'consultation_count' | 'procedure_count' | 'referral_count' | 'specialty' | null;
    direction: 'ascending' | 'descending';
}

function Statistics_Globale() { 
    const { t } = useTranslation();
    const { isAuthenticated, logout, authIsLoading } = useAuth(); 
    
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ÉTATS POUR LA RECHERCHE ET LE TRI
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [workplaceSortConfig, setWorkplaceSortConfig] = useState<SortConfig>({ key: null, direction: 'ascending' });
    const [doctorSortConfig, setDoctorSortConfig] = useState<SortConfig>({ key: null, direction: 'ascending' });

    // --- LOGIQUE D'APPEL API ---
    const loadStats = useCallback(async () => {
        if (!isAuthenticated || authIsLoading) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await api.get('/stats/global/');
            const data: GlobalStats = response.data;
            setStats(data);
            setError(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Une erreur inconnue est survenue.";
            console.error("Erreur lors du chargement des statistiques globales :", err);
            
            if (errorMessage.includes("Jeton d'accès manquant") || errorMessage.includes("Accès non autorisé")) {
                logout(); 
                return; 
            }
            
            setError(t('statistics_global.error.generic'));
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, authIsLoading, logout, t]);

    useEffect(() => {
        if (isAuthenticated && !authIsLoading) {
            loadStats();
        } 
    }, [loadStats, isAuthenticated, authIsLoading]);
    
    // --- LOGIQUE DE TRI ---

    const sortData = (data: (WorkplaceStats | DoctorStats)[], config: SortConfig) => {
        if (!config.key) return data;

        const sortedData = [...data].sort((a, b) => {
            // Le type assertion est nécessaire car 'key' peut être dans WorkplaceStats ou DoctorStats,
            // mais l'appelant s'assure qu'il est pertinent pour le type de données passé.
            const key = config.key as keyof (WorkplaceStats | DoctorStats); 
            const valA = a[key];
            const valB = b[key];

            let comparison = 0;
            if (valA > valB) {
                comparison = 1;
            } else if (valA < valB) {
                comparison = -1;
            }

            return config.direction === 'ascending' ? comparison : comparison * -1;
        });
        return sortedData;
    };

    const requestSort = (key: SortConfig['key'], type: 'workplace' | 'doctor') => {
        const currentConfig = type === 'workplace' ? workplaceSortConfig : doctorSortConfig;
        let direction: SortConfig['direction'] = 'ascending';

        // Si la même colonne est cliquée, inverser la direction
        if (currentConfig.key === key && currentConfig.direction === 'ascending') {
            direction = 'descending';
        }

        const newConfig = { key, direction };
        if (type === 'workplace') {
            setWorkplaceSortConfig(newConfig);
        } else {
            setDoctorSortConfig(newConfig);
        }
    };

    // --- LOGIQUE DE FILTRAGE ET TRI DANS useMemo ---

    const filteredAndSortedWorkplaces = useMemo(() => {
        if (!stats) return [];
        let data = stats.stats_by_workplace;
        
        // 1. Filtrage par clinique
        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            data = data.filter(w => w.name.toLowerCase().includes(lowerCaseSearch));
        }

        // 2. Tri
        return sortData(data, workplaceSortConfig) as WorkplaceStats[];
    }, [stats, searchTerm, workplaceSortConfig]);


    const filteredAndSortedDoctors = useMemo(() => {
        if (!stats) return [];
        let data = stats.stats_by_doctor;
        
        // 1. Filtrage par médecin ou spécialité
        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            data = data.filter(d => 
                d.full_name.toLowerCase().includes(lowerCaseSearch) || // Utilise full_name
                d.specialty.toLowerCase().includes(lowerCaseSearch)
            );
        }

        // 2. Tri
        return sortData(data, doctorSortConfig) as DoctorStats[];
    }, [stats, searchTerm, doctorSortConfig]);


    // --- Rendu conditionnel et Composants ---
    
    if (authIsLoading || loading) {
        return <div className="stats-container">{t('statistics_global.loading')}</div>;
    }

    if (!isAuthenticated) {
        return <div className="stats-container">{t('statistics_global.unauthorized')}</div>;
    }

    if (error) {
        return <div className="stats-container stats-error">Erreur : {error}</div>;
    }

    if (!stats) {
        return <div className="stats-container">{t('statistics_global.no_data')}</div>;
    }
    
    // Fonction d'aide pour l'icône de tri
    const getSortIcon = (key: SortConfig['key'], config: SortConfig) => {
        if (config.key !== key) return '↕';
        return config.direction === 'ascending' ? '▲' : '▼';
    };
    
    // --- Composant de Contrôles de Recherche et Tri ---
    const renderControls = () => (
        <section className="stats-section stats-controls">
            <div className="stats-search-row">
                <label className="stats-search-label">
                    {t('statistics_global.search_label')}
                </label>
                <input
                    type="text"
                    className="stats-search-input"
                    placeholder={t('statistics_global.search_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </section>
    );

    // --- Rendu des Statistiques par Clinique ---
    const renderWorkplaceStats = () => (
        <section className="stats-section">
            <h2>{t('statistics_global.workplace.title')}</h2>
            <div className="stats-table-container">
                <table className="stats-table">
                    <thead>
                        <tr>
                            <th onClick={() => requestSort('name', 'workplace')}>
                                {t('statistics_global.workplace.columns.name')} {getSortIcon('name', workplaceSortConfig)}
                            </th>
                            <th onClick={() => requestSort('patient_count', 'workplace')}>
                                {t('statistics_global.workplace.columns.patients')} {getSortIcon('patient_count', workplaceSortConfig)}
                            </th>
                            <th onClick={() => requestSort('consultation_count', 'workplace')}>
                                {t('statistics_global.workplace.columns.consultations')} {getSortIcon('consultation_count', workplaceSortConfig)}
                            </th>
                            <th onClick={() => requestSort('procedure_count', 'workplace')}>
                                {t('statistics_global.workplace.columns.procedures')} {getSortIcon('procedure_count', workplaceSortConfig)}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedWorkplaces.length > 0 ? (
                            filteredAndSortedWorkplaces.map((w: WorkplaceStats) => (
                                <tr key={w.id}>
                                    <td>{w.name}</td>
                                    <td>{w.patient_count}</td>
                                    <td>{w.consultation_count}</td>
                                    <td>{w.procedure_count}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4}>{t('statistics_global.workplace.no_data')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );

    // --- Rendu des Statistiques par Médecin ---
    const renderDoctorStats = () => (
        <section className="stats-section">
            <h2>{t('statistics_global.doctor.title')}</h2>
            <div className="stats-table-container">
                <table className="stats-table">
                    <thead>
                        <tr>
                            <th onClick={() => requestSort('full_name', 'doctor')}>
                                {t('statistics_global.doctor.columns.name')} {getSortIcon('full_name', doctorSortConfig)}
                            </th>
                            <th onClick={() => requestSort('specialty', 'doctor')}>
                                {t('statistics_global.doctor.columns.specialty')} {getSortIcon('specialty', doctorSortConfig)}
                            </th>
                            <th onClick={() => requestSort('patient_count', 'doctor')}>
                                {t('statistics_global.doctor.columns.patients')} {getSortIcon('patient_count', doctorSortConfig)}
                            </th>
                            <th onClick={() => requestSort('consultation_count', 'doctor')}>
                                {t('statistics_global.doctor.columns.consultations')} {getSortIcon('consultation_count', doctorSortConfig)}
                            </th>
                            <th onClick={() => requestSort('referral_count', 'doctor')}>
                                {t('statistics_global.doctor.columns.referrals')} {getSortIcon('referral_count', doctorSortConfig)}
                            </th>
                            <th onClick={() => requestSort('procedure_count', 'doctor')}>
                                {t('statistics_global.doctor.columns.procedures')} {getSortIcon('procedure_count', doctorSortConfig)}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedDoctors.length > 0 ? (
                            filteredAndSortedDoctors.map((d: DoctorStats) => (
                                <tr key={d.id}>
                                    {/* UTILISATION DE full_name POUR AFFICHER LE NOM COMPLET */}
                                    <td>Dr. {d.full_name}</td> 
                                    <td>{d.specialty}</td>
                                    <td>{d.patient_count}</td>
                                    <td>{d.consultation_count}</td>
                                    <td>{d.referral_count}</td>
                                    <td>{d.procedure_count}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6}>{t('statistics_global.doctor.no_data')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
    
    // --- Rendu des Totaux Globaux ---
    const renderGlobalTotals = () => (
        <section className="stats-section global-totals">
            <h2>{t('statistics_global.totals.title')}</h2>
            <div className="stats-grid">
                <div className="stat-card">
                    <h3>{t('statistics_global.totals.doctors')}</h3>
                    <p className="stat-number">{stats.total_doctors}</p>
                </div>
                <div className="stat-card">
                    <h3>{t('statistics_global.totals.workplaces')}</h3>
                    <p className="stat-number">{stats.total_workplaces}</p>
                </div>
                <div className="stat-card">
                    <h3>{t('statistics_global.totals.patients')}</h3>
                    <p className="stat-number">{stats.total_patients}</p>
                </div>
                <div className="stat-card">
                    <h3>{t('statistics_global.totals.consultations')}</h3>
                    <p className="stat-number">{stats.total_consultations}</p>
                </div>
                <div className="stat-card">
                    <h3>{t('statistics_global.totals.referrals')}</h3>
                    <p className="stat-number">{stats.total_referrals}</p>
                </div>
                <div className="stat-card">
                    <h3>{t('statistics_global.totals.procedures')}</h3>
                    <p className="stat-number">{stats.total_procedures}</p>
                </div>
            </div>
        </section>
    );

    return (
        <div className="stats-container">
            <header className="stats-header">
                <h1>{t('statistics_global.title')}</h1>
            </header>
            <main className="stats-content">
                {renderGlobalTotals()}
                
                {/* CONTRÔLES DE RECHERCHE */}
                {renderControls()} 
                
                {renderWorkplaceStats()}
                {renderDoctorStats()}
            </main>
        </div>
    );
}

export default Statistics_Globale;