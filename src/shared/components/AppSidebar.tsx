// src/shared/components/AppSidebar.tsx
// Fixed desktop sidebar + mobile drawer.
// CR-P2-11: Inline SVGs replaced with the shared `<Icon>` component.

import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/hooks/useAuth';
import NotificationBell from './NotificationBell';
import { Avatar } from './Avatar';
import { toast } from './ui';
import { Icon } from './Icons';
import api from '../services/api';

interface AppSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

type IconName =
    | 'dashboard' | 'patients' | 'appointments' | 'referrals'
    | 'notebook' | 'stats' | 'profile' | 'logout'
    | 'tasks' | 'messages';

const NAV_LINKS: Array<{
    to: string; icon: IconName; labelKey: string; label: string; badgeKey?: string;
}> = [
    { to: '/dashboard',    icon: 'dashboard',    labelKey: 'nav.dashboard',    label: 'Dashboard' },
    { to: '/inbox',        icon: 'tasks',        labelKey: 'nav.inbox',        label: 'Inbox',         badgeKey: 'inbox' },
    { to: '/patients',     icon: 'patients',     labelKey: 'nav.patients',     label: 'Patients' },
    { to: '/appointments', icon: 'appointments', labelKey: 'nav.appointments', label: 'Appointments', badgeKey: 'appointments' },
    { to: '/messages',     icon: 'messages',     labelKey: 'nav.messages',     label: 'Messages',     badgeKey: 'messages' },
    { to: '/referrals',    icon: 'referrals',    labelKey: 'nav.referrals',    label: 'Referrals',    badgeKey: 'referrals' },
    { to: '/notebook',     icon: 'notebook',     labelKey: 'nav.notebook',     label: 'Notebook' },
    { to: '/my-stats',     icon: 'stats',        labelKey: 'nav.stats',        label: 'My Stats' },
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

    const { data: returnedReferralCount = 0 } = useQuery<number>({
        queryKey: ['referrals', 'returned-count'],
        queryFn: async () => {
            const res = await api.get('/referrals/', { params: { direction: 'sent', status: 'returned' } });
            return (res.data.count as number) ?? (res.data as unknown[]).length ?? 0;
        },
        staleTime: 60_000,
        refetchInterval: 60_000,
        enabled: userType === 'doctor',
    });

    const referralBadgeCount = incomingReferralCount + returnedReferralCount;

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

    const { data: unreadMessageCount = 0 } = useQuery<number>({
        queryKey: ['messages', 'unread-count'],
        queryFn: async () => {
            const res = await api.get('/patient-messages/?unread=true');
            const list = res.data.results ?? res.data;
            return Array.isArray(list) ? list.length : 0;
        },
        staleTime: 30_000,
        refetchInterval: 30_000,
        enabled: userType === 'doctor',
    });

    const { data: inboxCount = 0 } = useQuery<number>({
        queryKey: ['inbox', 'summary'],
        queryFn: async () => {
            try {
                const [tasks, alerts] = await Promise.all([
                    api.get('/care-tasks/?open=true').catch(() => ({ data: [] })),
                    api.get('/clinical-alerts/?open=true').catch(() => ({ data: [] })),
                ]);
                const tlist = (tasks.data?.results ?? tasks.data) as unknown[];
                const alist = (alerts.data?.results ?? alerts.data) as unknown[];
                return (Array.isArray(tlist) ? tlist.length : 0) + (Array.isArray(alist) ? alist.length : 0);
            } catch {
                return 0;
            }
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
                        link.badgeKey === 'referrals' ? referralBadgeCount :
                        link.badgeKey === 'appointments' ? pendingRequestCount :
                        link.badgeKey === 'messages' ? unreadMessageCount :
                        link.badgeKey === 'inbox' ? inboxCount :
                        0;
                    return (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                            onClick={onClose}
                        >
                            <Icon name={link.icon} className="sidebar-nav-icon" size={18} />
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
                {/* Language switcher — EN + FR only (Altheon scope) */}
                <div className="sidebar-lang-row">
                    {['en', 'fr'].map(lang => (
                        <button
                            key={lang}
                            className={`sidebar-lang-btn${i18n.language?.startsWith(lang) ? ' active' : ''}`}
                            onClick={async () => {
                                await i18n.changeLanguage(lang);
                                // Persist preference to backend so it sticks across devices.
                                try {
                                    await api.patch('/profile/update/', { locale: lang });
                                } catch {
                                    /* localStorage fallback already handled by i18next-browser-languagedetector */
                                }
                            }}
                            aria-pressed={i18n.language?.startsWith(lang)}
                            aria-label={lang === 'en' ? 'Switch to English' : 'Passer en français'}
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
                    <Icon name="profile" className="sidebar-nav-icon" size={18} />
                    {t('nav.profile', 'Profile')}
                </NavLink>

                <button className="sidebar-nav-item sidebar-logout" onClick={handleLogout}>
                    <Icon name="logout" className="sidebar-nav-icon" size={18} />
                    {t('nav.logout', 'Log out')}
                </button>
            </div>
        </aside>
    );
}

export default AppSidebar;
