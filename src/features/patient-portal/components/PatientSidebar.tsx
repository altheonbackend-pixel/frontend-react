import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { Avatar } from '../../../shared/components/Avatar';
import { usePatientPortal } from '../context/PatientPortalContext';

interface PatientSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Icons = {
    dashboard: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M3 12h8V3H3z"/><path d="M13 21h8V11h-8z"/><path d="M13 3h8v6h-8z"/><path d="M3 21h8v-7H3z"/></svg>,
    appointments: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    visits: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M12 21s-6.5-4.35-8.5-8A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 8.5 7c-2 3.65-8.5 8-8.5 8Z"/></svg>,
    medications: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M10.5 20.5 3.5 13.5a3.5 3.5 0 0 1 5-5l7 7a3.5 3.5 0 0 1-5 5Z"/><path d="m14 7 3-3a2.8 2.8 0 1 1 4 4l-3 3"/><path d="m5 12 7 7"/></svg>,
    labs: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M10 2v7.31"/><path d="M14 9.3V2"/><path d="M8.5 2h7"/><path d="M14 9.3 19.74 19a2 2 0 0 1-1.72 3H5.98a2 2 0 0 1-1.72-3L10 9.3"/><path d="M7 16h10"/></svg>,
    notifications: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    conditions: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    allergies: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    referrals: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>,
    profile: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    settings: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    logout: <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

const NAV_LINKS = [
    { to: '/patient/dashboard', icon: Icons.dashboard, label: 'Dashboard' },
    { to: '/patient/appointments', icon: Icons.appointments, label: 'Appointments' },
    { to: '/patient/visits', icon: Icons.visits, label: 'Visits' },
    { to: '/patient/medications', icon: Icons.medications, label: 'Medications' },
    { to: '/patient/labs', icon: Icons.labs, label: 'Lab Results' },
    { to: '/patient/notifications', icon: Icons.notifications, label: 'Notifications' },
];

const HEALTH_LINKS = [
    { to: '/patient/conditions', icon: Icons.conditions, label: 'Conditions' },
    { to: '/patient/allergies', icon: Icons.allergies, label: 'Allergies' },
    { to: '/patient/referrals', icon: Icons.referrals, label: 'Referrals' },
];

export function PatientSidebar({ isOpen, onClose }: PatientSidebarProps) {
    const { logout, patientProfile } = useAuth();
    const { unreadCount } = usePatientPortal();

    return (
        <aside className={`app-sidebar${isOpen ? ' app-sidebar--open' : ''}`} aria-label="Patient navigation">
            <div className="sidebar-brand">
                <div className="sidebar-brand-dot" />
                <span className="sidebar-brand-name">Altheon Patient</span>
            </div>

            <div className="sidebar-doctor">
                <Avatar name={patientProfile?.full_name ?? 'Patient'} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sidebar-doctor-name">{patientProfile?.full_name ?? 'Patient'}</div>
                    <div className="sidebar-doctor-specialty">Portal access active</div>
                </div>
                {unreadCount > 0 && (
                    <div style={{ minWidth: 24, height: 24, borderRadius: 999, background: 'var(--accent-light)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                        {unreadCount}
                    </div>
                )}
            </div>

            <nav className="sidebar-nav" role="navigation">
                <div className="sidebar-nav-section">Portal</div>
                {NAV_LINKS.map(link => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                        onClick={onClose}
                    >
                        {link.icon}
                        {link.label}
                    </NavLink>
                ))}
                <div className="sidebar-nav-section" style={{ marginTop: '0.75rem' }}>My Health</div>
                {HEALTH_LINKS.map(link => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                        onClick={onClose}
                    >
                        {link.icon}
                        {link.label}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-bottom">
                <NavLink
                    to="/patient/profile"
                    className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                    onClick={onClose}
                >
                    {Icons.profile}
                    Profile
                </NavLink>

                <NavLink
                    to="/patient/settings"
                    className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                    onClick={onClose}
                >
                    {Icons.settings}
                    Settings
                </NavLink>

                <button className="sidebar-nav-item sidebar-logout" onClick={logout}>
                    {Icons.logout}
                    Log out
                </button>
            </div>
        </aside>
    );
}

export default PatientSidebar;
