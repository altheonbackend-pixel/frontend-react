import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './PatientBottomNav.css';

const Icons = {
    home: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    appointments: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    ),
    findDoctor: (
        <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" strokeLinecap="round" />
            <path d="M11 8v6M8 11h6" strokeLinecap="round" />
        </svg>
    ),
    health: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    account: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
};

export function PatientBottomNav() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <nav className="patient-bottom-nav" aria-label={t('patient_portal.nav.mobile_navigation')}>
            <NavLink
                to="/patient/dashboard"
                className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
            >
                {Icons.home}
                <span>{t('patient_portal.nav.home')}</span>
            </NavLink>

            <NavLink
                to="/patient/appointments"
                className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
            >
                {Icons.appointments}
                <span>{t('patient_portal.nav.appointments')}</span>
            </NavLink>

            <button
                type="button"
                className="bottom-nav-fab"
                onClick={() => navigate('/find-doctors')}
                aria-label={t('patient_portal.nav.find_doctor')}
            >
                {Icons.findDoctor}
            </button>

            <NavLink
                to="/patient/health"
                className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
            >
                {Icons.health}
                <span>{t('patient_portal.nav.health')}</span>
            </NavLink>

            <NavLink
                to="/patient/account"
                className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
            >
                {Icons.account}
                <span>{t('patient_portal.nav.account')}</span>
            </NavLink>
        </nav>
    );
}

export default PatientBottomNav;
