import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { Avatar } from '../../../shared/components/Avatar';
import { PatientNotificationBell } from './PatientNotificationBell';

interface PatientSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Icons = {
    dashboard: (
        <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path d="M3 12h8V3H3z"/><path d="M13 21h8V11h-8z"/><path d="M13 3h8v6h-8z"/><path d="M3 21h8v-7H3z"/>
        </svg>
    ),
    appointments: (
        <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
    ),
    health: (
        <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    account: (
        <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>
    ),
    access: (
        <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    findDoctor: (
        <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
        </svg>
    ),
    logout: (
        <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
    ),
};

const NAV_LINKS = [
    { to: '/patient/dashboard',       icon: Icons.dashboard,      labelKey: 'patient_portal.nav.dashboard' },
    { to: '/patient/appointments',    icon: Icons.appointments,   labelKey: 'patient_portal.nav.appointments' },
    { to: '/find-doctors',            icon: Icons.findDoctor,     labelKey: 'patient_portal.nav.find_doctors' },
    { to: '/patient/health',          icon: Icons.health,         labelKey: 'patient_portal.nav.health' },
    { to: '/patient/access',          icon: Icons.access,         labelKey: 'patient_portal.nav.access_permission' },
    { to: '/patient/account',         icon: Icons.account,        labelKey: 'patient_portal.nav.account' },
];

export function PatientSidebar({ isOpen, onClose }: PatientSidebarProps) {
    const { logout, patientProfile } = useAuth();
    const { t } = useTranslation();
    const patientLabel = t('patient_portal.common.patient');

    return (
        <aside className={`app-sidebar${isOpen ? ' app-sidebar--open' : ''}`} aria-label={t('patient_portal.nav.patient_navigation')}>
            <div className="sidebar-brand">
                <div className="sidebar-brand-dot" />
                <span className="sidebar-brand-name">{t('patient_portal.brand.short')}</span>
            </div>

            <div className="sidebar-doctor">
                <Avatar name={patientProfile?.full_name ?? patientLabel} src={patientProfile?.avatar_url} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sidebar-doctor-name">{patientProfile?.full_name ?? patientLabel}</div>
                    <div className="sidebar-doctor-specialty">{t('patient_portal.nav.portal_access_active')}</div>
                </div>
                <PatientNotificationBell />
            </div>

            <nav className="sidebar-nav" role="navigation">
                <div className="sidebar-nav-section">{t('patient_portal.nav.portal')}</div>
                {NAV_LINKS.map(link => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                        onClick={onClose}
                    >
                        {link.icon}
                        {t(link.labelKey)}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-bottom">
                <button className="sidebar-nav-item sidebar-logout" onClick={logout}>
                    {Icons.logout}
                    {t('patient_portal.nav.logout')}
                </button>
            </div>
        </aside>
    );
}

export default PatientSidebar;
