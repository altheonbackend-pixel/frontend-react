// Fichier : src/components/Header.tsx
//import React from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import '../styles/Header.css';
import { useTranslation } from 'react-i18next';
import Logo from './Logo';
import NotificationBell from './NotificationBell';

const Header = () => {
    const { isAuthenticated, user, profile, logout } = useAuth();
    const { t, i18n } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);

    const changeLanguage = (lng: string) => i18n.changeLanguage(lng);
    const closeMenu = () => setMenuOpen(false);

    return (
        <header className={`main-header${menuOpen ? ' nav-open' : ''}`}>
            <nav className="main-nav">
                {/* Logo — standalone flex child */}
                <NavLink to="/dashboard" className="nav-logo" onClick={closeMenu}>
                    <Logo size="md" />
                </NavLink>

                {/* Desktop nav links (hidden on mobile, replaced by drawer) */}
                {/* Click anywhere inside closes the mobile drawer */}
                <div className="nav-links" onClick={closeMenu}>
                    {isAuthenticated && (
                        <>
                            <NavLink to="/dashboard" className="nav-item">{t('nav.dashboard')}</NavLink>
                            <NavLink to="/patients" className="nav-item">{t('nav.patients')}</NavLink>
                            <NavLink to="/appointments" className="nav-item">{t('nav.appointments')}</NavLink>
                            <NavLink to="/notes" className="nav-item">{t('nav.notes')}</NavLink>
                            <NavLink to="/clinics" className="nav-item">{t('nav.clinics')}</NavLink>
                            <NavLink to="/forum" className="nav-item">{t('nav.forum')}</NavLink>
                            <NavLink to="/profile" className="nav-item nav-profile-mobile">{t('nav.profile')}</NavLink>
                            {(profile?.access_level ?? 1) >= 2 && (
                                <>
                                    <NavLink to="/my-stats" className="nav-item">My Stats</NavLink>
                                    <NavLink to="/global-stats" className="nav-item">Global Stats</NavLink>
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Right section — always visible */}
                <div className="auth-links">
                    <div className="lang-switcher">
                        <button onClick={() => changeLanguage('fr')} className={`lang-btn${i18n.language?.startsWith('fr') ? ' active' : ''}`}>FR</button>
                        <button onClick={() => changeLanguage('en')} className={`lang-btn${i18n.language?.startsWith('en') ? ' active' : ''}`}>EN</button>
                    </div>

                    {isAuthenticated ? (
                        <>
                            <NotificationBell />
                            <NavLink to="/profile" className="nav-item nav-profile-desktop">{t('nav.profile')}</NavLink>
                            <div className="user-info-container">
                                <span className="user-name">Dr. {user?.full_name}</span>
                                {profile?.specialty && (
                                    <span className="user-specialty">{profile.specialty}</span>
                                )}
                            </div>
                            <button onClick={() => { logout(); closeMenu(); }} className="logout-button">
                                {t('nav.logout')}
                            </button>
                        </>
                    ) : (
                        <>
                            <NavLink to="/login" className="nav-item">{t('nav.login')}</NavLink>
                            <NavLink to="/register" className="nav-item">{t('nav.register')}</NavLink>
                        </>
                    )}

                    {/* Hamburger — only visible on mobile */}
                    {isAuthenticated && (
                        <button
                            className="nav-hamburger"
                            onClick={() => setMenuOpen(o => !o)}
                            aria-label="Toggle navigation"
                            aria-expanded={menuOpen}
                        >
                            <span />
                            <span />
                            <span />
                        </button>
                    )}
                </div>
            </nav>
        </header>
    );
};

export default Header;