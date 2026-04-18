import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import PatientSidebar from './PatientSidebar';

export function PatientLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="app-layout">
            <div
                className={`app-sidebar-overlay${sidebarOpen ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
            />

            <PatientSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="app-main" id="main-content">
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
                </div>

                <div className="page-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default PatientLayout;
