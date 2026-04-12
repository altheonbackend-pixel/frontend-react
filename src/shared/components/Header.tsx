// Fichier : src/components/Header.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import '../styles/Header.css';
import { useTranslation } from 'react-i18next';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import api from '../../shared/services/api';

interface SearchResult {
    unique_id: string;
    first_name: string;
    last_name: string;
    date_of_birth?: string;
}

const Header = () => {
    const { isAuthenticated, user, profile, logout } = useAuth();
    const { t, i18n } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate = useNavigate();

    // Global search
    const [searchQ, setSearchQ] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const changeLanguage = (lng: string) => i18n.changeLanguage(lng);
    const closeMenu = () => setMenuOpen(false);

    const runSearch = useCallback(async (q: string) => {
        if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
        try {
            const res = await api.get('/doctors/me/patients/', { params: { search: q, page_size: 6 } });
            setSearchResults(res.data.results ?? res.data);
        } catch {
            setSearchResults([]);
        }
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setSearchQ(q);
        setSearchOpen(true);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => runSearch(q), 350);
    };

    const handleSearchSelect = (patient: SearchResult) => {
        setSearchQ('');
        setSearchResults([]);
        setSearchOpen(false);
        navigate(`/patients/${patient.unique_id}`);
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

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
                            <NavLink to="/prescriptions" className="nav-item">Prescriptions</NavLink>
                            <NavLink to="/referrals" className="nav-item">Referrals</NavLink>
                            <NavLink to="/notebook" className="nav-item">Notebook</NavLink>
                            <NavLink to="/profile" className="nav-item nav-profile-mobile">{t('nav.profile')}</NavLink>
                            {(profile?.access_level ?? 1) >= 2 && (
                                <NavLink to="/my-stats" className="nav-item">My Stats</NavLink>
                            )}
                        </>
                    )}
                </div>

                {/* Global patient search */}
                {isAuthenticated && (
                    <div className="header-search-wrap" ref={searchRef}>
                        <input
                            type="text"
                            className="header-search-input"
                            placeholder="Search patients..."
                            value={searchQ}
                            onChange={handleSearchChange}
                            onFocus={() => searchQ.length >= 2 && setSearchOpen(true)}
                            autoComplete="off"
                        />
                        {searchOpen && searchResults.length > 0 && (
                            <ul className="header-search-dropdown">
                                {searchResults.map(p => (
                                    <li key={p.unique_id}>
                                        <button type="button" onClick={() => handleSearchSelect(p)}>
                                            <span className="hsearch-name">{p.first_name} {p.last_name}</span>
                                            {p.date_of_birth && <span className="hsearch-dob">{new Date(p.date_of_birth).toLocaleDateString()}</span>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

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
                                {(profile?.specialty_display || profile?.specialty) && (
                                    <span className="user-specialty">{profile.specialty_display || profile.specialty}</span>
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