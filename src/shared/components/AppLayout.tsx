// src/shared/components/AppLayout.tsx
// Wraps the doctor app in sidebar layout

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';

export function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="app-layout">
            {/* Mobile overlay */}
            <div
                className={`app-sidebar-overlay${sidebarOpen ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
            />

            <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="app-main">
                {/* Mobile top bar */}
                <div className="app-mobile-topbar">
                    <button
                        className="app-hamburger"
                        onClick={() => setSidebarOpen(o => !o)}
                        aria-label="Toggle navigation"
                        aria-expanded={sidebarOpen}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                    <span className="app-mobile-brand">Altheon</span>
                </div>

                <div className="page-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default AppLayout;
