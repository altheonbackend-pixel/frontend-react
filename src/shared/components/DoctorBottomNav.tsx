import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './DoctorBottomNav.css';

const Icons = {
    home: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    ),
    patients: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    plus: (
        <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    ),
    schedule: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    ),
    more: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" />
            <circle cx="5" cy="12" r="1" fill="currentColor" />
        </svg>
    ),
    stats: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    ),
    notebook: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    ),
    audit: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    ),
    profile: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    ),
    consultation: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    referral: (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    ),
};

export function DoctorBottomNav() {
    const navigate = useNavigate();
    const [fabOpen, setFabOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);

    const closeAll = () => { setFabOpen(false); setMoreOpen(false); };

    const quickAction = (path: string) => { closeAll(); navigate(path); };

    return (
        <>
            {/* Tap-away overlay */}
            {(fabOpen || moreOpen) && (
                <div className="doctor-bottom-nav-overlay" onClick={closeAll} aria-hidden="true" />
            )}

            {/* FAB quick-action sheet */}
            {fabOpen && (
                <div className="doctor-fab-sheet" role="dialog" aria-label="Quick actions">
                    <button className="fab-sheet-item" onClick={() => quickAction('/patients')}>
                        {Icons.consultation}
                        <span>New Consultation</span>
                    </button>
                    <button className="fab-sheet-item" onClick={() => quickAction('/appointments')}>
                        {Icons.schedule}
                        <span>New Appointment</span>
                    </button>
                    <button className="fab-sheet-item" onClick={() => quickAction('/referrals')}>
                        {Icons.referral}
                        <span>New Referral</span>
                    </button>
                </div>
            )}

            {/* More drawer */}
            {moreOpen && (
                <div className="doctor-more-drawer" role="dialog" aria-label="More options">
                    <NavLink to="/my-stats"  className="more-drawer-item" onClick={closeAll}>{Icons.stats}   My Stats</NavLink>
                    <NavLink to="/notebook"  className="more-drawer-item" onClick={closeAll}>{Icons.notebook} Notebook</NavLink>
                    <NavLink to="/profile"   className="more-drawer-item" onClick={closeAll}>{Icons.profile}  Profile</NavLink>
                </div>
            )}

            <nav className="doctor-bottom-nav" aria-label="Mobile navigation">
                <NavLink
                    to="/dashboard"
                    className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
                    onClick={closeAll}
                >
                    {Icons.home}
                    <span>Home</span>
                </NavLink>

                <NavLink
                    to="/patients"
                    className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
                    onClick={closeAll}
                >
                    {Icons.patients}
                    <span>Patients</span>
                </NavLink>

                <button
                    type="button"
                    className={`bottom-nav-fab${fabOpen ? ' bottom-nav-fab--open' : ''}`}
                    onClick={() => { setFabOpen(o => !o); setMoreOpen(false); }}
                    aria-label="Quick actions"
                    aria-expanded={fabOpen}
                >
                    {Icons.plus}
                </button>

                <NavLink
                    to="/appointments"
                    className={({ isActive }) => `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`}
                    onClick={closeAll}
                >
                    {Icons.schedule}
                    <span>Schedule</span>
                </NavLink>

                <button
                    type="button"
                    className={`bottom-nav-item${moreOpen ? ' bottom-nav-item--active' : ''}`}
                    onClick={() => { setMoreOpen(o => !o); setFabOpen(false); }}
                    aria-expanded={moreOpen}
                >
                    {Icons.more}
                    <span>More</span>
                </button>
            </nav>
        </>
    );
}

export default DoctorBottomNav;
