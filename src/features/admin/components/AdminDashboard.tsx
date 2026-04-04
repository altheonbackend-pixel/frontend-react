import { useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import '../styles/AdminDashboard.css';
import PageLoader from '../../../shared/components/PageLoader';

const AdminDashboard = () => {
    const { stats, isLoading, error, fetchStats } = useAdmin();

    useEffect(() => {
        fetchStats();
    }, []);

    if (isLoading) {
        return <PageLoader message="Loading Dashboard" />;
    }

    if (error) {
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
            <h1>System Statistics</h1>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">👨‍⚕️</div>
                    <div className="stat-content">
                        <h3>Total Doctors</h3>
                        <p className="stat-number">{stats.total_doctors}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                        <h3>Active Doctors</h3>
                        <p className="stat-number">{stats.total_active_doctors}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-content">
                        <h3>Total Patients</h3>
                        <p className="stat-number">{stats.total_patients}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📅</div>
                    <div className="stat-content">
                        <h3>Total Appointments</h3>
                        <p className="stat-number">{stats.total_appointments}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">📋</div>
                    <div className="stat-content">
                        <h3>Total Consultations</h3>
                        <p className="stat-number">{stats.total_consultations}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">🏥</div>
                    <div className="stat-content">
                        <h3>Total Procedures</h3>
                        <p className="stat-number">{stats.total_procedures}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">🔗</div>
                    <div className="stat-content">
                        <h3>Total Referrals</h3>
                        <p className="stat-number">{stats.total_referrals}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">🎯</div>
                    <div className="stat-content">
                        <h3>Access Levels</h3>
                        <p className="stat-breakdown">
                            L1: {stats.doctors_by_access_level?.['1'] ?? 0} | L2: {stats.doctors_by_access_level?.['2'] ?? 0}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
