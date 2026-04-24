import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { Avatar } from '../../../shared/components/Avatar';
import PatientSidebar from './PatientSidebar';
import { PatientBottomNav } from './PatientBottomNav';
import { PatientNotificationBell } from './PatientNotificationBell';
import './PatientLayout.css';


export function PatientLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { patientProfile } = useAuth();

    return (
        <div className="app-layout">
            <div
                className={`app-sidebar-overlay${sidebarOpen ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
            />

            <PatientSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="app-main" id="main-content">
                {/* Desktop top bar — hidden on mobile */}
                <header className="patient-topbar">
                    <div className="patient-topbar__right">
                        <PatientNotificationBell />
                        <Link
                            to="/patient/account"
                            className="patient-topbar__avatar-link"
                            aria-label="My Account"
                        >
                            <Avatar name={patientProfile?.full_name ?? 'Patient'} size="sm" />
                            <span className="patient-topbar__name">
                                {patientProfile?.full_name ?? 'Patient'}
                            </span>
                        </Link>
                    </div>
                </header>

                {/* Mobile top bar — hidden on desktop */}
                <div className="app-mobile-topbar">
                    <button
                        className="app-hamburger"
                        onClick={() => setSidebarOpen(o => !o)}
                        aria-label="Toggle patient navigation"
                        aria-expanded={sidebarOpen}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                    <span className="app-mobile-brand">Altheon Patient</span>
                    <PatientNotificationBell />
                </div>

                <div className="page-content page-content--with-bottom-nav">
                    <Outlet />
                </div>

                <PatientBottomNav />
            </main>
        </div>
    );
}

export default PatientLayout;
