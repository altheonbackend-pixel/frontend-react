import { NavLink, useNavigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../../auth/hooks/useAuth';
import '../styles/AdminSidebar.css';

interface AdminSidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const AdminSidebar = ({ isOpen = true, onClose }: AdminSidebarProps) => {
    const { stats, logout } = useAdmin();
    const { logout: authLogout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        authLogout();
        navigate('/login');
    };

    const handleNavClick = () => {
        if (onClose) onClose();
    };

    return (
        <aside className={`admin-sidebar${isOpen ? ' admin-sidebar--open' : ''}`}>
            <div className="admin-sidebar__brand">
                <span className="admin-sidebar__brand-icon">⚕</span>
                <div>
                    <div className="admin-sidebar__brand-name">Altheon Connect</div>
                    <div className="admin-sidebar__brand-role">Admin Panel</div>
                </div>
            </div>

            <nav className="admin-sidebar__nav">
                <div className="admin-sidebar__section-label">Overview</div>
                <NavLink to="/admin/dashboard" onClick={handleNavClick} className={({ isActive }) => `admin-sidebar__link${isActive ? ' active' : ''}`}>
                    <span className="admin-sidebar__link-icon">📊</span>
                    Dashboard
                </NavLink>

                <div className="admin-sidebar__section-label">Doctor Management</div>
                <NavLink to="/admin/doctors" onClick={handleNavClick} className={({ isActive }) => `admin-sidebar__link${isActive ? ' active' : ''}`}>
                    <span className="admin-sidebar__link-icon">👨‍⚕️</span>
                    Active Doctors
                </NavLink>
                <NavLink to="/admin/doctors/pending" onClick={handleNavClick} className={({ isActive }) => `admin-sidebar__link${isActive ? ' active' : ''}`}>
                    <span className="admin-sidebar__link-icon">⏳</span>
                    Pending Approval
                    {stats && stats.pending_doctors > 0 && (
                        <span className="admin-sidebar__badge">{stats.pending_doctors}</span>
                    )}
                </NavLink>
                <NavLink to="/admin/doctors/rejected" onClick={handleNavClick} className={({ isActive }) => `admin-sidebar__link${isActive ? ' active' : ''}`}>
                    <span className="admin-sidebar__link-icon">❌</span>
                    Rejected
                </NavLink>

                <div className="admin-sidebar__section-label">Compliance</div>
                <NavLink to="/admin/patients" onClick={handleNavClick} className={({ isActive }) => `admin-sidebar__link${isActive ? ' active' : ''}`}>
                    <span className="admin-sidebar__link-icon">🗑️</span>
                    Deleted Patients
                </NavLink>
            </nav>

            <div className="admin-sidebar__footer">
                <button className="admin-sidebar__logout" onClick={handleLogout}>
                    <span>🚪</span> Logout
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
