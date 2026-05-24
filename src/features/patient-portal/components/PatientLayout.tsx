import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { Avatar } from '../../../shared/components/Avatar';
import PatientSidebar from './PatientSidebar';
import { PatientBottomNav } from './PatientBottomNav';
import { PatientNotificationBell } from './PatientNotificationBell';
import './PatientLayout.css';


export function PatientLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { patientProfile } = useAuth();
    const { t } = useTranslation();
    const patientLabel = t('patient_portal.common.patient');

    return (
        <div className="app-layout patient-portal">
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
                            aria-label={t('patient_portal.nav.my_account')}
                        >
                            <Avatar name={patientProfile?.full_name ?? patientLabel} src={patientProfile?.avatar_url} size="sm" />
                            <span className="patient-topbar__name">
                                {patientProfile?.full_name ?? patientLabel}
                            </span>
                        </Link>
                    </div>
                </header>

                {/* Mobile top bar — hidden on desktop */}
                <div className="app-mobile-topbar">
                    <button
                        className="app-hamburger"
                        onClick={() => setSidebarOpen(o => !o)}
                        aria-label={t('patient_portal.nav.toggle_patient_navigation')}
                        aria-expanded={sidebarOpen}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                    <span className="app-mobile-brand">{t('patient_portal.brand.short')}</span>
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
