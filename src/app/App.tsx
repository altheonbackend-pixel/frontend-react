// src/app/App.tsx

import { useState, lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import AdminPatientList from '../features/admin/components/AdminPatientList';
import PatientLayout from '../features/patient-portal/components/PatientLayout';
import PatientLoginPage from '../features/patient-portal/pages/PatientLoginPage';
import PatientClaim from '../features/patient-portal/pages/PatientClaim';
import PatientForgotPassword from '../features/patient-portal/pages/PatientForgotPassword';
import PatientResetPassword from '../features/patient-portal/pages/PatientResetPassword';

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
const PatientDashboard  = lazy(() => import('../features/patient-portal/components/PatientDashboard'));
const PatientAppointments = lazy(() => import('../features/patient-portal/components/PatientAppointments'));
const PatientVisits     = lazy(() => import('../features/patient-portal/components/PatientVisits'));
const PatientMedications = lazy(() => import('../features/patient-portal/components/PatientMedications'));
const PatientLabs       = lazy(() => import('../features/patient-portal/components/PatientLabs'));
const PatientNotifications = lazy(() => import('../features/patient-portal/components/PatientNotifications'));
const PatientProfile    = lazy(() => import('../features/patient-portal/components/PatientProfile'));
const PatientSettings   = lazy(() => import('../features/patient-portal/components/PatientSettings'));

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
                    <Route path="/patients"          element={<AdminPatientList />} />
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
    const location = useLocation();

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

    if (isAuthenticated && userType === 'patient') {
        return (
            <div className="App">
                <a href="#main-content" className="skip-link">Skip to main content</a>
                <Suspense fallback={<PageLoader message="Loading portal" />}>
                    <Routes>
                        <Route element={<PrivateRoutes />}>
                            <Route element={<PatientLayout />}>
                                <Route path="/patient/dashboard" element={<ErrorBoundary resetKey={location.pathname}><PatientDashboard /></ErrorBoundary>} />
                                <Route path="/patient/appointments" element={<ErrorBoundary resetKey={location.pathname}><PatientAppointments /></ErrorBoundary>} />
                                <Route path="/patient/visits" element={<ErrorBoundary resetKey={location.pathname}><PatientVisits /></ErrorBoundary>} />
                                <Route path="/patient/medications" element={<ErrorBoundary resetKey={location.pathname}><PatientMedications /></ErrorBoundary>} />
                                <Route path="/patient/labs" element={<ErrorBoundary resetKey={location.pathname}><PatientLabs /></ErrorBoundary>} />
                                <Route path="/patient/notifications" element={<ErrorBoundary resetKey={location.pathname}><PatientNotifications /></ErrorBoundary>} />
                                <Route path="/patient/profile" element={<ErrorBoundary resetKey={location.pathname}><PatientProfile /></ErrorBoundary>} />
                                <Route path="/patient/settings" element={<ErrorBoundary resetKey={location.pathname}><PatientSettings /></ErrorBoundary>} />
                            </Route>
                        </Route>
                        {/* Public patient routes (accessible even when logged in as patient) */}
                        <Route path="/patient/login" element={<PatientLoginPage />} />
                        <Route path="/patient/claim" element={<PatientClaim />} />
                        <Route path="/patient/forgot-password" element={<PatientForgotPassword />} />
                        <Route path="/patient/reset-password" element={<PatientResetPassword />} />
                        <Route path="/login" element={<PatientLoginPage />} />
                        <Route path="/" element={<Navigate to="/patient/dashboard" replace />} />
                        <Route path="*" element={<Navigate to="/patient/dashboard" replace />} />
                    </Routes>
                </Suspense>
            </div>
        );
    }

    // ── Doctor app (sidebar layout) ────────────────────────────────────────────
    return (
        <div className="App">
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <Suspense fallback={<PageLoader message="Loading" />}>
                <Routes>
                    {/* Public routes (no sidebar) */}
                    <Route path="/register"        element={<Register />} />
                    <Route path="/login"           element={<LandingPage />} />
                    <Route path="/verify-email"    element={<VerifyEmail />} />
                    <Route path="/complete-profile" element={<CompleteProfile />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password"  element={<ResetPassword />} />
                    {/* Patient-specific public routes */}
                    <Route path="/patient/login"          element={<PatientLoginPage />} />
                    <Route path="/patient/claim"          element={<PatientClaim />} />
                    <Route path="/patient/forgot-password" element={<PatientForgotPassword />} />
                    <Route path="/patient/reset-password"  element={<PatientResetPassword />} />

                    {/* Protected doctor routes wrapped in AppLayout (sidebar) */}
                    <Route element={<PrivateRoutes />}>
                        <Route element={<AppLayout />}>
                            <Route path="/dashboard"           element={<ErrorBoundary resetKey={location.pathname}><Dashboard /></ErrorBoundary>} />
                            <Route path="/patients"            element={<ErrorBoundary resetKey={location.pathname}><Patients /></ErrorBoundary>} />
                            <Route path="/patients/add"        element={<ErrorBoundary resetKey={location.pathname}><AddPatient /></ErrorBoundary>} />
                            <Route path="/patients/edit/:id"   element={<ErrorBoundary resetKey={location.pathname}><EditPatient /></ErrorBoundary>} />
                            <Route path="/patients/:id"        element={<ErrorBoundary resetKey={location.pathname}><PatientDetail /></ErrorBoundary>} />
                            <Route path="/appointments"        element={<ErrorBoundary resetKey={location.pathname}><Appointments /></ErrorBoundary>} />
                            <Route path="/deleted-appointments" element={<ErrorBoundary resetKey={location.pathname}><DeletedAppts /></ErrorBoundary>} />
                            <Route path="/referrals"           element={<ErrorBoundary resetKey={location.pathname}><ReferralsList /></ErrorBoundary>} />
                            <Route path="/notebook"            element={<ErrorBoundary resetKey={location.pathname}><PrivateNotebook /></ErrorBoundary>} />
                            <Route path="/profile"             element={<ErrorBoundary resetKey={location.pathname}><Profile /></ErrorBoundary>} />
                            <Route path="/edit-profile"        element={<ErrorBoundary resetKey={location.pathname}><EditProfile /></ErrorBoundary>} />
                            <Route path="/my-stats"            element={<ErrorBoundary resetKey={location.pathname}><Statistics /></ErrorBoundary>} />
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
