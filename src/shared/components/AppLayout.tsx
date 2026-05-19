// src/shared/components/AppLayout.tsx
// Wraps the doctor app in sidebar layout

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AppSidebar from './AppSidebar';
import DoctorBottomNav from './DoctorBottomNav';
import CommandPalette from './CommandPalette';
import { useRealtimeStream } from '../hooks/useRealtimeStream';

export function AppLayout() {
    const { t } = useTranslation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const qc = useQueryClient();

    // CR-P0-13: subscribe to the doctor's SSE stream and invalidate
    // relevant TanStack Query caches when events arrive.
    useRealtimeStream('doctor', (event) => {
        switch (event.type) {
            case 'alert':
                qc.invalidateQueries({ queryKey: ['alerts'] });
                qc.invalidateQueries({ queryKey: ['clinical-alerts'] });
                qc.invalidateQueries({ queryKey: ['dashboard'] });
                break;
            case 'task':
                qc.invalidateQueries({ queryKey: ['care-tasks'] });
                qc.invalidateQueries({ queryKey: ['dashboard'] });
                break;
            case 'referral':
                qc.invalidateQueries({ queryKey: ['referrals'] });
                qc.invalidateQueries({ queryKey: ['dashboard'] });
                break;
            case 'appointment':
                qc.invalidateQueries({ queryKey: ['appointments'] });
                qc.invalidateQueries({ queryKey: ['dashboard'] });
                break;
            default:
                break;
        }
    });

    // CR-P2-12: Global keyboard shortcuts. `/` focuses cmd-k. Avoids
    // hijacking when the user is typing in an input.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
            const inField = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement | null)?.isContentEditable;
            if (inField) return;
            if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                navigate('/patients/add');
            } else if (e.key === 'p') {
                e.preventDefault();
                navigate('/patients');
            } else if (e.key === 'a') {
                e.preventDefault();
                navigate('/appointments');
            } else if (e.key === 'r') {
                e.preventDefault();
                navigate('/referrals');
            } else if (e.key === '?') {
                e.preventDefault();
                navigate('/profile');
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [navigate]);

    return (
        <div className="app-layout">
            {/* Mobile overlay */}
            <div
                className={`app-sidebar-overlay${sidebarOpen ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
            />

            <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="app-main" id="main-content">
                {/* Mobile top bar */}
                <div className="app-mobile-topbar">
                    <button
                        className="app-hamburger"
                        onClick={() => setSidebarOpen(o => !o)}
                        aria-label={t('header.toggle_navigation')}
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

            <DoctorBottomNav />

            {/* CR-P4-10: Global Cmd+K palette overlays everything */}
            <CommandPalette />
        </div>
    );
}

export default AppLayout;
