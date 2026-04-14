import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import '../../../shared/styles/Dashboard.css';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { queryKeys } from '../../../shared/queryKeys';
import type { FollowUpConsultation } from '../../../shared/types';

interface DashboardStats {
    total_patients: number;
    total_consultations: number;
    total_referrals: number;
    total_appointments: number;
    total_procedures: number;
    pending_referrals: number;
    follow_up_today: number;
}

interface UpcomingAppt {
    id: number;
    appointment_date: string;
    patient_details?: { first_name: string; last_name: string; unique_id: string };
    reason_for_appointment: string;
    status: string;
    status_display?: string;
}

interface RecentPatient {
    unique_id: string;
    first_name: string;
    last_name: string;
    status: string;
    status_display?: string;
}

interface DashboardData {
    stats: DashboardStats;
    upcoming_appointments: UpcomingAppt[];
    recent_patients: RecentPatient[];
    due_followups: FollowUpConsultation[];
}

const QUICK_LINKS = [
    { to: '/patients/add', label: '+ New Patient', accent: true },
    { to: '/appointments', label: 'Appointments' },
    { to: '/prescriptions', label: 'Prescriptions' },
    { to: '/referrals', label: 'Referrals' },
    { to: '/notebook', label: 'Notebook' },
];

const STATUS_COLORS: Record<string, string> = {
    scheduled: '#3182ce',
    confirmed: '#38a169',
    cancelled: '#e53e3e',
    completed: '#718096',
    pending: '#d69e2e',
};

function Dashboard() {
    const { t } = useTranslation();
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<RecentPatient[]>([]);
    const [searching, setSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    // Single API call replaces 4 separate endpoints
    const { data, isLoading, isError } = useQuery({
        queryKey: queryKeys.dashboard(),
        queryFn: async (): Promise<DashboardData> => {
            const res = await api.get('/dashboard/');
            return res.data;
        },
        staleTime: 60 * 1000,
    });

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) { setSearchResults([]); return; }
        setSearching(true);
        try {
            const res = await api.get(`/doctors/me/patients/?search=${encodeURIComponent(query)}`);
            const d = res.data;
            setSearchResults((Array.isArray(d) ? d : d.results || []).slice(0, 8));
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    const goToPatient = (uid: string) => {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
        navigate(`/patients/${uid}`);
    };

    const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const stats = data?.stats;
    const upcomingAppointments = data?.upcoming_appointments ?? [];
    const recentPatients = data?.recent_patients ?? [];
    const followUps = data?.due_followups ?? [];

    return (
        <div className="dashboard-container">
            {/* Header */}
            <header className="dashboard-page-header">
                <div>
                    <h1>{t('dashboard.title')}</h1>
                    <p className="dashboard-date">{todayStr}</p>
                </div>
                {/* Global search */}
                <div className="dashboard-search-wrapper">
                    <div className="dashboard-search-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        <input
                            type="text"
                            placeholder="Search patients..."
                            value={searchQuery}
                            onChange={e => { handleSearch(e.target.value); setShowSearch(true); }}
                            onFocus={() => setShowSearch(true)}
                            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                        />
                    </div>
                    {showSearch && searchResults.length > 0 && (
                        <div className="search-dropdown">
                            {searching && <div className="search-loading">Searching...</div>}
                            {searchResults.map(p => (
                                <button key={p.unique_id} className="search-result-item" onMouseDown={() => goToPatient(p.unique_id)}>
                                    <span className="search-result-name">{p.first_name} {p.last_name}</span>
                                    <span className={`search-status status-${p.status}`}>{p.status_display || p.status}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            {/* Welcome + Quick stats */}
            <main className="dashboard-content">
                <h2>
                    {user?.full_name
                        ? t('dashboard.welcome', { name: user.full_name })
                        : t('dashboard.welcome_no_name')}
                </h2>
                {profile?.specialty_display && <p className="dashboard-specialty">{profile.specialty_display}</p>}

                {/* Stats Grid */}
                <div className="stats-summary">
                    {[
                        { label: 'Patients', val: stats?.total_patients },
                        { label: 'Consultations', val: stats?.total_consultations },
                        { label: 'Appointments', val: stats?.total_appointments },
                        { label: 'Pending Referrals', val: stats?.pending_referrals },
                        { label: 'Procedures', val: stats?.total_procedures },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <div className="stat-value">{isLoading ? '…' : isError ? '—' : (s.val ?? '0')}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Quick links */}
                <nav className="dashboard-nav">
                    {QUICK_LINKS.map(l => (
                        <Link key={l.to} to={l.to} className={`nav-button${l.accent ? ' nav-button--accent' : ''}`}>
                            {l.label}
                        </Link>
                    ))}
                </nav>
            </main>

            {/* Two-column panels */}
            <div className="dashboard-panels">
                {/* Upcoming appointments */}
                <div className="dashboard-panel">
                    <div className="panel-header">
                        <h3>Upcoming Appointments</h3>
                        <Link to="/appointments" className="panel-link">View all →</Link>
                    </div>
                    {isLoading ? <p className="muted">Loading...</p> :
                        upcomingAppointments.length ? (
                            <ul className="panel-list">
                                {upcomingAppointments.map(a => (
                                    <li key={a.id} className="panel-list-item">
                                        <div className="appt-time">
                                            {new Date(a.appointment_date).toLocaleDateString()}<br />
                                            <span className="appt-hour">{new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="appt-info">
                                            <div className="appt-patient">
                                                {a.patient_details
                                                    ? <Link to={`/patients/${a.patient_details.unique_id}`} className="patient-link">{a.patient_details.first_name} {a.patient_details.last_name}</Link>
                                                    : 'Patient'}
                                            </div>
                                            <div className="appt-reason">{a.reason_for_appointment}</div>
                                        </div>
                                        <span className="appt-status" style={{ color: STATUS_COLORS[a.status] || '#718096' }}>{a.status_display || a.status}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="muted">No upcoming appointments.</p>
                    }
                </div>

                {/* Recent patients */}
                <div className="dashboard-panel">
                    <div className="panel-header">
                        <h3>Recent Patients</h3>
                        <Link to="/patients" className="panel-link">View all →</Link>
                    </div>
                    {isLoading ? <p className="muted">Loading...</p> :
                        recentPatients.length ? (
                            <ul className="panel-list">
                                {recentPatients.map(p => (
                                    <li key={p.unique_id} className="panel-list-item">
                                        <div className="patient-avatar-sm">{p.first_name.charAt(0)}{p.last_name.charAt(0)}</div>
                                        <div className="appt-info">
                                            <Link to={`/patients/${p.unique_id}`} className="patient-link">{p.first_name} {p.last_name}</Link>
                                        </div>
                                        <span className={`status-badge status-${p.status}`}>{p.status_display || p.status}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="muted">No patients yet.</p>
                    }
                </div>
            </div>

            {/* Follow-ups panel — full width below */}
            {followUps.length > 0 && (
                <div className="dashboard-panel dashboard-panel--followups">
                    <div className="panel-header">
                        <h3>
                            <span className="followup-alert-dot" /> Due Follow-ups ({followUps.length})
                        </h3>
                        <Link to="/patients" className="panel-link">View patients →</Link>
                    </div>
                    <ul className="panel-list">
                        {followUps.slice(0, 8).map(f => (
                            <li key={f.id} className="panel-list-item">
                                <div className="followup-date-badge">
                                    {new Date(f.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </div>
                                <div className="appt-info">
                                    <span className="appt-patient">{f.patient_name || f.patient}</span>
                                    <span className="appt-reason">{f.reason_for_consultation}</span>
                                </div>
                                {f.diagnosis && <span className="followup-dx">{f.diagnosis}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
