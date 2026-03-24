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
                <div className="nav-links">
                    <NavLink to="/dashboard" className="nav-logo">
                        Altheon Connect
                    </NavLink>
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
                <div className="auth-links">
                    <div style={{ display: 'flex', gap: '5px', marginRight: '10px' }}>
                        <button onClick={() => changeLanguage('fr')} style={{ cursor: 'pointer', padding: '2px 5px' }}>FR</button>
                        <button onClick={() => changeLanguage('en')} style={{ cursor: 'pointer', padding: '2px 5px' }}>EN</button>
                    </div>

                    {isAuthenticated ? (
                        <>
                            <NavLink to="/profile" className="nav-item">{t('nav.profile')}</NavLink>
                            <div className="user-info-container">
                                <span className="user-name">
                                    Dr. {user?.full_name}
                                </span>
                                {profile?.specialty && (
                                    <span className="user-specialty">
                                        {profile.specialty}
                                    </span>
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