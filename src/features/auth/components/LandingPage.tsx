// Fichier : src/components/LandingPage.tsx (ou Home.tsx)

import React from 'react';
import { useTranslation } from 'react-i18next';
import Login from './Login';
import HomescreenHeader from '../../../shared/components/HomescreenHeader';
import '../styles/Auth.css'; // Pour le wrapper

const LandingPage: React.FC = () => {
    const { t } = useTranslation();
    return (
        // Le wrapper principal pour centrer le contenu et définir l'arrière-plan
        <div className="auth-page-wrapper">
            
            {/* 1. L'en-tête visuel/branding */}
            <HomescreenHeader />

            {/* 2. Le formulaire de connexion */}
            <Login /> 

            {/* 3. Zone d'information ou de pied de page (optionnel) */}
            <footer style={{ marginTop: 'auto', padding: '10px', color: '#7f8c8d' }}>
                {t('landing.footer', { year: new Date().getFullYear() })}
            </footer>
        </div>
    );
};

export default LandingPage;