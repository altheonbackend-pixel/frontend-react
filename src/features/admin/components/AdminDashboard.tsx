import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import '../styles/AdminDashboard.css';
import PageLoader from '../../../shared/components/PageLoader';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

interface StatCardProps {
    icon: string;
    label: string;
    value: string | number;
    delta?: number | null;
    deltaLabel?: string;
    onClick?: () => void;
    variant?: 'default' | 'warning' | 'danger' | 'success';
}

const StatCard = ({ icon, label, value, delta, deltaLabel = 'this week', onClick, variant = 'default' }: StatCardProps) => (
    <div
        className={`stat-card stat-card--${variant}${onClick ? ' stat-card--clickable' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
    >
        <div className="stat-card__icon">{icon}</div>
        <div className="stat-card__content">
            <div className="stat-card__label">{label}</div>
            <div className="stat-card__value">{value}</div>
            {delta != null && (
                <div className="stat-card__delta">
                    {delta > 0 ? `+${delta}` : delta} {deltaLabel}
                </div>
            )}
        </div>
        {onClick && <div className="stat-card__arrow">→</div>}
    </div>
);

const AdminDashboard = () => {
    const { stats, isLoading, error, fetchStats } = useAdmin();
    const navigate = useNavigate();
    usePageTitle('Admin Dashboard');

    useEffect(() => {
        fetchStats();
    }, []);

    if (isLoading && !stats) return <PageLoader message="Loading Dashboard" />;

    if (error && !stats) {
        return (
            <div className="admin-dashboard">
                <h1>Dashboard</h1>
                <div className="error-message">{error}</div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="admin-dashboard">
                <h1>Dashboard</h1>
                <div className="no-data">No statistics available</div>
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            <div className="admin-dashboard__header">
                <h1>Dashboard</h1>
                <button className="btn-refresh" onClick={fetchStats} disabled={isLoading}>
                    {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {/* Alerts section — things needing attention */}
            {(stats.pending_doctors > 0) && (
                <div className="admin-alerts">
                    <div className="admin-alerts__title">Requires Attention</div>
                    <div className="admin-alerts__items">
                        {stats.pending_doctors > 0 && (
                            <div className="admin-alert admin-alert--warning" onClick={() => navigate('/admin/doctors/pending')}>
                                <span className="admin-alert__icon">⏳</span>
                                <span><strong>{stats.pending_doctors}</strong> doctor registration{stats.pending_doctors !== 1 ? 's' : ''} pending approval</span>
                                <span className="admin-alert__action">Review →</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Doctor Stats */}
            <div className="admin-dashboard__section">
                <h2 className="admin-dashboard__section-title">Doctors</h2>
                <div className="stats-grid">
                    <StatCard icon="👨‍⚕️" label="Total Doctors" value={stats.total_doctors} onClick={() => navigate('/admin/doctors')} />
                    <StatCard icon="✅" label="Active Doctors" value={stats.total_active_doctors} variant="success" onClick={() => navigate('/admin/doctors?is_active=true')} />
                    <StatCard icon="🚫" label="Inactive Doctors" value={stats.total_inactive_doctors} variant={stats.total_inactive_doctors > 0 ? 'warning' : 'default'} onClick={() => navigate('/admin/doctors?is_active=false')} />
                    <StatCard icon="⏳" label="Pending Approval" value={stats.pending_doctors} variant={stats.pending_doctors > 0 ? 'warning' : 'default'} onClick={() => navigate('/admin/doctors/pending')} />
                    <StatCard icon="❌" label="Rejected" value={stats.rejected_doctors} onClick={() => navigate('/admin/doctors/rejected')} />
                    <StatCard
                        icon="🎯"
                        label="Access Levels"
                        value={`L1: ${stats.doctors_by_access_level?.['1'] ?? 0}  |  L2: ${stats.doctors_by_access_level?.['2'] ?? 0}`}
                    />
                </div>
            </div>

            {/* Platform Stats */}
            <div className="admin-dashboard__section">
                <h2 className="admin-dashboard__section-title">Platform Activity</h2>
                <div className="stats-grid">
                    <StatCard
                        icon="👥"
                        label="Total Patients"
                        value={stats.total_patients}
                        delta={stats.new_patients_this_week ?? null}
                        variant={stats.new_patients_this_week > 0 ? 'success' : 'default'}
                    />
                    <StatCard icon="📅" label="Appointments" value={stats.total_appointments} />
                    <StatCard
                        icon="📋"
                        label="Consultations"
                        value={stats.total_consultations}
                        delta={stats.new_consultations_this_week ?? null}
                        variant={stats.new_consultations_this_week > 0 ? 'success' : 'default'}
                    />
                    <StatCard icon="🏥" label="Procedures" value={stats.total_procedures} />
                    <StatCard icon="🔗" label="Referrals" value={stats.total_referrals} />
                </div>
            </div>

            {/* Clinic Stats */}
            <div className="admin-dashboard__section">
                <h2 className="admin-dashboard__section-title">Clinics</h2>
                <div className="stats-grid">
                    <StatCard icon="🏢" label="Total Clinics" value={stats.total_clinics} onClick={() => navigate('/admin/clinics')} />
                    <StatCard icon="🌐" label="Public Clinics" value={stats.total_public_clinics} onClick={() => navigate('/admin/clinics')} />
                    <StatCard icon="🔒" label="Private Clinics" value={stats.total_clinics - stats.total_public_clinics} />
                </div>
            </div>

            {/* Forum Stats */}
            <div className="admin-dashboard__section">
                <h2 className="admin-dashboard__section-title">Forum</h2>
                <div className="stats-grid">
                    <StatCard icon="💬" label="Total Posts" value={stats.total_forum_posts} onClick={() => navigate('/admin/forum')} />
                    <StatCard
                        icon="🚷"
                        label="Forum-Suspended Doctors"
                        value={stats.forum_suspended_doctors}
                        variant={stats.forum_suspended_doctors > 0 ? 'warning' : 'default'}
                        onClick={() => navigate('/admin/doctors')}
                    />
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
