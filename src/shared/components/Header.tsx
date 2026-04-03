// Fichier : src/components/Header.tsx
//import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth'; // Correction du chemin d'import
import '../styles/Header.css';
import { useTranslation } from 'react-i18next';

const Header = () => {
    const { isAuthenticated, user, profile, logout } = useAuth();
    const { t, i18n } = useTranslation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <header className="main-header">
            <nav className="main-nav">
                {/* Logo — standalone so it never shifts when nav items change width */}
                <NavLink to="/dashboard" className="nav-logo">
                    Altheon Connect
                </NavLink>

                {/* Centre nav links — overflow-hidden prevents pushing auth-links */}
                <div className="nav-links">
                    {isAuthenticated && (
                        <>
                            <NavLink to="/dashboard" className="nav-item">{t('nav.dashboard')}</NavLink>
                            <NavLink to="/patients" className="nav-item">{t('nav.patients')}</NavLink>
                            <NavLink to="/appointments" className="nav-item">{t('nav.appointments')}</NavLink>
                            <NavLink to="/notes" className="nav-item">{t('nav.notes')}</NavLink>
                            <NavLink to="/clinics" className="nav-item">{t('nav.clinics')}</NavLink>
                            <NavLink to="/forum" className="nav-item">{t('nav.forum')}</NavLink>
                            {(profile?.access_level ?? 1) >= 2 && (
                                <>
                                    <NavLink to="/my-stats" className="nav-item">My Stats</NavLink>
                                    <NavLink to="/global-stats" className="nav-item">Global Stats</NavLink>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Right section — lang toggle + user info + logout */}
                <div className="auth-links">
                    <div className="lang-switcher">
                        <button onClick={() => changeLanguage('fr')} className={`lang-btn${i18n.language?.startsWith('fr') ? ' active' : ''}`}>FR</button>
                        <button onClick={() => changeLanguage('en')} className={`lang-btn${i18n.language?.startsWith('en') ? ' active' : ''}`}>EN</button>
                    </div>

                    {isAuthenticated ? (
                        <>
                            <NavLink to="/profile" className="nav-item nav-profile-link">{t('nav.profile')}</NavLink>
                            <div className="user-info-container">
                                <span className="user-name">Dr. {user?.full_name}</span>
                                {profile?.specialty && (
                                    <span className="user-specialty">{profile.specialty}</span>
                                )}
                            </div>
                            <button onClick={logout} className="logout-button">{t('nav.logout')}</button>
                        </>
                    ) : (
                        <>
                            <NavLink to="/login" className="nav-item">{t('nav.login')}</NavLink>
                            <NavLink to="/register" className="nav-item">{t('nav.register')}</NavLink>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
};

export default Header;