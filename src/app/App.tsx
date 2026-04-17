// src/app/App.tsx

import { useState, lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useKeyboardShortcut } from '../shared/hooks/useKeyboardShortcut';

// Shared components
import AppLayout from '../shared/components/AppLayout';
import ErrorBoundary from '../shared/components/ErrorBoundary';

// Auth feature (tiny — loaded eagerly)
import { useAuth } from '../features/auth/hooks/useAuth';
import LandingPage from '../features/auth/components/LandingPage';
import Register from '../features/auth/components/Register';
import VerifyEmail from '../features/auth/components/VerifyEmail';
import CompleteProfile from '../features/auth/components/CompleteProfile';
import ForgotPassword from '../features/auth/components/ForgotPassword';
import ResetPassword from '../features/auth/components/ResetPassword';

// Admin components
import AdminSidebar from '../features/admin/components/AdminSidebar';
import AdminDashboard from '../features/admin/components/AdminDashboard';
import AdminDoctorList from '../features/admin/components/AdminDoctorList';

// Code-split lazy imports
const Dashboard         = lazy(() => import('../features/auth/components/Dashboard'));
const Patients          = lazy(() => import('../features/patients/components/Patients'));
const PatientDetail     = lazy(() => import('../features/patients/components/PatientDetail'));
const AddPatient        = lazy(() => import('../features/patients/components/AddPatient'));
const EditPatient       = lazy(() => import('../features/patients/components/EditPatientPage'));
const Appointments      = lazy(() => import('../features/appointments/components/Appointments'));
const DeletedAppts      = lazy(() => import('../features/appointments/components/DeletedAppointments'));
const Profile           = lazy(() => import('../features/profile/components/Profile'));
const EditProfile       = lazy(() => import('../features/profile/components/EditProfile'));
const ReferralsList     = lazy(() => import('../features/referrals/components/ReferralsList'));
const Statistics        = lazy(() => import('../features/statistics/components/Statistics'));
const PrivateNotebook   = lazy(() => import('../features/notebook/components/PrivateNotebook'));

import PrivateRoutes from '../shared/components/PrivateRoutes';
import PageLoader from '../shared/components/PageLoader';
import NotFound from '../shared/components/NotFound';
import './App.css';

// ── Admin route guard ─────────────────────────────────────────────────────────
const PrivateAdminRoutes = () => {
    const { isAuthenticated, userType, adminProfile } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (!isAuthenticated || userType !== 'admin' || !adminProfile) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="admin-layout">
            {sidebarOpen && (
                <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            )}
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className={`admin-main${sidebarOpen ? ' sidebar-open' : ''}`}>
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
                    <Route path="/dashboard"         element={<AdminDashboard />} />
                    <Route path="/doctors"           element={<AdminDoctorList initialTab="active" />} />
                    <Route path="/doctors/pending"   element={<AdminDoctorList initialTab="pending" />} />
                    <Route path="/doctors/rejected"  element={<AdminDoctorList initialTab="rejected" />} />
                    <Route path="*"                  element={<Navigate to="/admin/dashboard" replace />} />
                </Routes>
            </main>
        </div>
    );
};

const RTL_LANGUAGES = ['ar', 'ur'];

function App() {
    const { isAuthenticated, authIsLoading, userType } = useAuth();
    const { i18n } = useTranslation();

    // Sync <html dir> and <html lang>
    useEffect(() => {
        document.documentElement.dir = RTL_LANGUAGES.includes(i18n.language) ? 'rtl' : 'ltr';
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);

    // Global Ctrl+K → focus patient search
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

    if (authIsLoading) {
        return <PageLoader message="Starting up" brand="Altheon Connect" fullScreen />;
    }

    // ── Admin app ──────────────────────────────────────────────────────────────
    if (isAuthenticated && userType === 'admin') {
        return (
            <div className="App">
                <Suspense fallback={<PageLoader message="Loading" />}>
                    <Routes>
                        <Route path="/admin/*" element={<PrivateAdminRoutes />} />
                        <Route path="/"        element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="*"        element={<Navigate to="/admin/dashboard" replace />} />
                    </Routes>
                </Suspense>
            </div>
        );
    }

    // ── Doctor app (sidebar layout) ────────────────────────────────────────────
    return (
        <div className="App">
            <Suspense fallback={<PageLoader message="Loading" />}>
                <Routes>
                    {/* Public routes (no sidebar) */}
                    <Route path="/register"        element={<Register />} />
                    <Route path="/login"           element={<LandingPage />} />
                    <Route path="/verify-email"    element={<VerifyEmail />} />
                    <Route path="/complete-profile" element={<CompleteProfile />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password"  element={<ResetPassword />} />

                    {/* Protected doctor routes wrapped in AppLayout (sidebar) */}
                    <Route element={<PrivateRoutes />}>
                        <Route element={<AppLayout />}>
                            <Route path="/dashboard"           element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                            <Route path="/patients"            element={<ErrorBoundary><Patients /></ErrorBoundary>} />
                            <Route path="/patients/add"        element={<ErrorBoundary><AddPatient /></ErrorBoundary>} />
                            <Route path="/patients/edit/:id"   element={<ErrorBoundary><EditPatient /></ErrorBoundary>} />
                            <Route path="/patients/:id"        element={<ErrorBoundary><PatientDetail /></ErrorBoundary>} />
                            <Route path="/appointments"        element={<ErrorBoundary><Appointments /></ErrorBoundary>} />
                            <Route path="/deleted-appointments" element={<ErrorBoundary><DeletedAppts /></ErrorBoundary>} />
                            <Route path="/referrals"           element={<ErrorBoundary><ReferralsList /></ErrorBoundary>} />
                            <Route path="/notebook"            element={<ErrorBoundary><PrivateNotebook /></ErrorBoundary>} />
                            <Route path="/profile"             element={<ErrorBoundary><Profile /></ErrorBoundary>} />
                            <Route path="/edit-profile"        element={<ErrorBoundary><EditProfile /></ErrorBoundary>} />
                            <Route path="/my-stats"            element={<ErrorBoundary><Statistics /></ErrorBoundary>} />
                        </Route>
                    </Route>

                    {/* Default redirects */}
                    <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
        </div>
    );
}

export default App;
