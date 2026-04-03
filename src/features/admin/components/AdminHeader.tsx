import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import '../styles/AdminHeader.css';

const AdminHeader = () => {
    const { adminProfile, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="admin-header">
            <nav className="admin-nav">
                {/* Logo — standalone */}
                <NavLink to="/admin/dashboard" className="admin-logo-text">
                    ⚙️ Altheon Admin
                </NavLink>

                {/* Centre nav */}
                <div className="admin-nav-links">
                    <NavLink to="/admin/dashboard" className="admin-nav-item">
                        Dashboard
                    </NavLink>
                    <NavLink to="/admin/doctors" className="admin-nav-item">
                        Manage Doctors
                    </NavLink>
                </div>

                {/* Right section */}
                <div className="admin-auth-links">
                    {adminProfile && (
                        <>
                            <div className="admin-user-info-container">
                                <span className="admin-user-name">{adminProfile.full_name}</span>
                                <span className="admin-user-email">{adminProfile.email}</span>
                            </div>
                            <button onClick={handleLogout} className="admin-logout-button">
                                Logout
                            </button>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
};

export default AdminHeader;
