// src/app/App.tsx

import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useKeyboardShortcut } from '../shared/hooks/useKeyboardShortcut';

// Shared components (small — loaded eagerly)
import Header from '../shared/components/Header';
import PrivateRoutes from '../shared/components/PrivateRoutes';
import ErrorBoundary from '../shared/components/ErrorBoundary';
// Auth feature (tiny routes — no lazy penalty)
import { useAuth } from '../features/auth/hooks/useAuth';
import LandingPage from '../features/auth/components/LandingPage';
import Register from '../features/auth/components/Register';
import VerifyEmail from '../features/auth/components/VerifyEmail';
import CompleteProfile from '../features/auth/components/CompleteProfile';

// Admin components
import AdminSidebar from '../features/admin/components/AdminSidebar';
import AdminDashboard from '../features/admin/components/AdminDashboard';
import AdminDoctorList from '../features/admin/components/AdminDoctorList';
// Code-split lazy imports — each becomes a separate chunk
const Dashboard = lazy(() => import('../features/auth/components/Dashboard'));
const Patients = lazy(() => import('../features/patients/components/Patients'));
const PatientDetail = lazy(() => import('../features/patients/components/PatientDetail'));
const AddPatient = lazy(() => import('../features/patients/components/AddPatient'));
const EditPatient = lazy(() => import('../features/patients/components/EditPatientPage'));
const Appointments = lazy(() => import('../features/appointments/components/Appointments'));
const DeletedAppointments = lazy(() => import('../features/appointments/components/DeletedAppointments'));
// Notes feature removed — replaced by Private Notebook + Quick Note per v1 spec
const Profile = lazy(() => import('../features/profile/components/Profile'));
const EditProfile = lazy(() => import('../features/profile/components/EditProfile'));
const ReferralsList = lazy(() => import('../features/referrals/components/ReferralsList'));
const Statistics = lazy(() => import('../features/statistics/components/Statistics'));
const PrivateNotebook = lazy(() => import('../features/notebook/components/PrivateNotebook'));

import PageLoader from '../shared/components/PageLoader';
import NotFound from '../shared/components/NotFound';
import './App.css';

// Route guard component for admin-only routes
const PrivateAdminRoutes = () => {
    const { isAuthenticated, userType, adminProfile } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (!isAuthenticated || userType !== 'admin' || !adminProfile) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="admin-layout">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            )}
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className={`admin-main${sidebarOpen ? ' sidebar-open' : ''}`}>
                {/* Mobile top bar */}
                <div className="admin-mobile-topbar">
                    <button
                        className="admin-hamburger"
                        onClick={() => setSidebarOpen(o => !o)}
                        aria-label="Toggle sidebar"
                    >
                        <span /><span /><span />
                    </button>
                    <span className="admin-mobile-title">Altheon Admin</span>
                </div>
                <Routes>
                    <Route path="/dashboard" element={<AdminDashboard />} />
                    <Route path="/doctors" element={<AdminDoctorList initialTab="active" />} />
                    <Route path="/doctors/pending" element={<AdminDoctorList initialTab="pending" />} />
                    <Route path="/doctors/rejected" element={<AdminDoctorList initialTab="rejected" />} />
                    <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                </Routes>
            </main>
        </div>
    );
};

function App() {
    const { isAuthenticated, authIsLoading, userType } = useAuth();
    // Use a counter instead of boolean so rapid successive adds each trigger a refresh
    const [refreshPatients, setRefreshPatients] = useState(0);

    // Global keyboard shortcut: Cmd/Ctrl+K → focus patient search
    useKeyboardShortcut({
        key: 'k',
        modifiers: ['ctrl'],
        enabled: isAuthenticated,
        onKeyDown: () => {
            const el = document.getElementById('global-patient-search') as HTMLInputElement | null;
            el?.focus();
            el?.select();
        },
    });

    const handlePatientAdded = () => {
        setRefreshPatients(prev => prev + 1);
    };

    if (authIsLoading) {
        return <PageLoader message="Starting up" brand="Altheon Connect" fullScreen />;
    }

    // Admin routes
    if (isAuthenticated && userType === 'admin') {
        return (
            <div className="App">
                <Suspense fallback={<PageLoader message="Loading" />}>
                    <Routes>
                        <Route path="/admin/*" element={<PrivateAdminRoutes />} />
                        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                    </Routes>
                </Suspense>
            </div>
        );
    }

    // Doctor routes (default)
    return (
        <div className="App">
            {isAuthenticated && <Header />}

            <Suspense fallback={<PageLoader message="Loading" />}>
                <Routes>
                    {/* 1. Registration page */}
                    <Route path="/register" element={<Register />} />

                    {/* 2. Login/Landing page */}
                    <Route path="/login" element={<LandingPage />} />

                    {/* 3. Email verification — accessible when logged in but not yet verified */}
                    <Route path="/verify-email" element={<VerifyEmail />} />

                    {/* 4. Profile completion gate — accessible after email verified, before profile complete */}
                    <Route path="/complete-profile" element={<CompleteProfile />} />

                    {/* Protected routes for doctors */}
                    <Route element={<PrivateRoutes />}>
                        <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                        <Route path="/patients" element={<ErrorBoundary><Patients refreshPatients={refreshPatients} /></ErrorBoundary>} />
                        <Route path="/patients/:id" element={<ErrorBoundary><PatientDetail /></ErrorBoundary>} />
                        <Route path="/patients/add" element={<ErrorBoundary><AddPatient onPatientAdded={handlePatientAdded} /></ErrorBoundary>} />
                        <Route path="/patients/edit/:id" element={<ErrorBoundary><EditPatient /></ErrorBoundary>} />
                        <Route path="/appointments" element={<ErrorBoundary><Appointments /></ErrorBoundary>} />
                        <Route path="/deleted-appointments" element={<ErrorBoundary><DeletedAppointments /></ErrorBoundary>} />
                        {/* /notes route removed — replaced by /notebook per v1 spec */}

                        <Route path="/referrals" element={<ErrorBoundary><ReferralsList /></ErrorBoundary>} />

                        <Route path="/notebook" element={<ErrorBoundary><PrivateNotebook /></ErrorBoundary>} />
                        <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
                        <Route path="/edit-profile" element={<ErrorBoundary><EditProfile /></ErrorBoundary>} />

                        {/* Personal stats: open to all doctors — every doctor should see their own caseload */}
                        <Route path="/my-stats" element={<ErrorBoundary><Statistics /></ErrorBoundary>} />

                    </Route>

                    {/* Default redirection */}
                    <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
        </div>
    );
}

export default App;
