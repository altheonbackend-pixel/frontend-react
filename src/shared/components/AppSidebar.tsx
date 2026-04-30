// src/shared/components/AppSidebar.tsx
// Fixed desktop sidebar + mobile drawer

import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/hooks/useAuth';
import NotificationBell from './NotificationBell';
import { Avatar } from './Avatar';
import { toast } from './ui';
import api from '../services/api';

interface AppSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

// Lucide-style inline SVGs — no extra package needed
const Icons = {
    dashboard:     <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    patients:      <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    appointments:  <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    referrals:     <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    notebook:      <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
    stats:         <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    audit:         <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    profile:       <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    logout:        <svg className="sidebar-nav-icon" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

const NAV_LINKS = [
    { to: '/dashboard',    icon: Icons.dashboard,    labelKey: 'nav.dashboard',    label: 'Dashboard' },
    { to: '/patients',     icon: Icons.patients,     labelKey: 'nav.patients',     label: 'Patients' },
    { to: '/appointments', icon: Icons.appointments, labelKey: 'nav.appointments', label: 'Appointments', badgeKey: 'appointments' },
    { to: '/referrals',    icon: Icons.referrals,    labelKey: 'nav.referrals',    label: 'Referrals',    badgeKey: 'referrals' },
    { to: '/notebook',     icon: Icons.notebook,     labelKey: 'nav.notebook',     label: 'Notebook' },
    { to: '/my-stats',     icon: Icons.stats,        labelKey: 'nav.stats',        label: 'My Stats' },
    { to: '/audit-log',   icon: Icons.audit,        labelKey: 'nav.audit',        label: 'Activity Log' },
];

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
    const { t, i18n } = useTranslation();
    const { profile, user, emailVerified, userType, logout } = useAuth();

    const { data: incomingReferralCount = 0 } = useQuery<number>({
        queryKey: ['referrals', 'incoming-count'],
        queryFn: async () => {
            const res = await api.get('/referrals/', { params: { direction: 'received', status: 'pending' } });
            return (res.data.count as number) ?? (res.data as unknown[]).length ?? 0;
        },
        staleTime: 60_000,
        refetchInterval: 60_000,
        enabled: userType === 'doctor',
    });

    const { data: pendingRequestCount = 0 } = useQuery<number>({
        queryKey: ['appointments', 'pending-requests-count'],
        queryFn: async () => {
            const res = await api.get('/doctor/appointment-requests/');
            const list = res.data.results ?? res.data;
            return Array.isArray(list) ? list.length : 0;
        },
        staleTime: 30_000,
        refetchInterval: 30_000,
        enabled: userType === 'doctor',
    });

    const handleLogout = () => {
        logout();
        onClose();
    };

    const handleResendVerification = async () => {
        try {
            await api.post('/auth/resend-verification/');
            toast.success('Verification email sent. Check your inbox.');
        } catch {
            toast.error('Could not send verification email.');
        }
    };

    const doctorName = profile?.full_name ?? user?.full_name ?? 'Doctor';
    const specialty = profile?.specialty_display ?? profile?.specialty ?? '';

    return (
        <aside className={`app-sidebar${isOpen ? ' app-sidebar--open' : ''}`} aria-label="Main navigation">
            {/* Brand */}
            <div className="sidebar-brand">
                <div className="sidebar-brand-dot" />
                <span className="sidebar-brand-name">Altheon</span>
            </div>

            {/* Doctor mini-profile */}
            <div className="sidebar-doctor">
                <Avatar name={doctorName} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sidebar-doctor-name">Dr. {doctorName}</div>
                    {specialty && <div className="sidebar-doctor-specialty">{specialty}</div>}
                </div>
                <NotificationBell />
            </div>

            {/* Email verification warning */}
            {userType === 'doctor' && !emailVerified && (
                <div style={{ margin: '0.5rem', padding: '0.625rem 0.75rem', background: '#fef3c7', borderRadius: '0.5rem', fontSize: '0.75rem', color: '#92400e', lineHeight: 1.4 }}>
                    📧 Verify your email.{' '}
                    <button
                        onClick={handleResendVerification}
                        style={{ background: 'none', border: 'none', color: '#92400e', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', padding: 0 }}
                    >
                        Resend
                    </button>
                </div>
            )}

            {/* Main nav */}
            <nav className="sidebar-nav" role="navigation">
                <div className="sidebar-nav-section">Main</div>
                {NAV_LINKS.map(link => {
                    const badge =
                        link.badgeKey === 'referrals' ? incomingReferralCount :
                        link.badgeKey === 'appointments' ? pendingRequestCount :
                        0;
                    return (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                            onClick={onClose}
                        >
                            {link.icon}
                            {t(link.labelKey, link.label)}
                            {badge > 0 && (
                                <span className="sidebar-badge">{badge}</span>
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="sidebar-bottom">
                {/* Language switcher */}
                <div className="sidebar-lang-row">
                    {['en', 'fr', 'ar', 'ur'].map(lang => (
                        <button
                            key={lang}
                            className={`sidebar-lang-btn${i18n.language?.startsWith(lang) ? ' active' : ''}`}
                            onClick={() => i18n.changeLanguage(lang)}
                        >
                            {lang.toUpperCase()}
                        </button>
                    ))}
                </div>

                <NavLink
                    to="/profile"
                    className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                    onClick={onClose}
                >
                    {Icons.profile}
                    {t('nav.profile', 'Profile')}
                </NavLink>

                <button className="sidebar-nav-item sidebar-logout" onClick={handleLogout}>
                    {Icons.logout}
                    {t('nav.logout', 'Log out')}
                </button>
            </div>
        </aside>
    );
}

export default AppSidebar;
