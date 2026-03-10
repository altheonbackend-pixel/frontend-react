// Fichier : src/components/Dashboard.tsx

//import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../../../shared/styles/Dashboard.css';
import { useTranslation } from 'react-i18next';

function Dashboard() {
    const { t } = useTranslation();
    const { user } = useAuth();

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1>{t('dashboard.title')}</h1>
            </header>
            <main className="dashboard-content">
                <h2>
                    {user?.full_name 
                        ? t('dashboard.welcome', { name: user.full_name }) 
                        : t('dashboard.welcome_no_name')}
                </h2>
                <p>{t('dashboard.subtitle')}</p>
                <nav className="dashboard-nav">
                    <Link to="/patients" className="nav-button">{t('dashboard.nav.patients')}</Link>
                    <Link to="/referrals" className="nav-button">{t('dashboard.nav.referrals')}</Link>
                    
                    {/* Lien vers les statistiques de l'utilisateur (Statistics.tsx) */}
                    <Link to="/my-stats" className="nav-button">{t('dashboard.nav.stats_user')}</Link> 

                    {/* Lien vers les statistiques GLOBALEs (Statistics_Globale.tsx) */}
                    <Link to="/global-stats" className="nav-button primary-button">{t('dashboard.nav.stats_global')}</Link> 
                </nav>
            </main>
        </div>
    );
}

export default Dashboard;