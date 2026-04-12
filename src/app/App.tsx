// src/app/App.tsx

import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Shared components (small — loaded eagerly)
import Header from '../shared/components/Header';
import PrivateRoutes from '../shared/components/PrivateRoutes';
import AccessLevelRoute from '../shared/components/AccessLevelRoute';

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
import AdminClinicList from '../features/admin/components/AdminClinicList';
import AdminForumModeration from '../features/admin/components/AdminForumModeration';

// Code-split lazy imports — each becomes a separate chunk
const Dashboard = lazy(() => import('../features/auth/components/Dashboard'));
const Patients = lazy(() => import('../features/patients/components/Patients'));
const PatientDetail = lazy(() => import('../features/patients/components/PatientDetail'));
const AddPatient = lazy(() => import('../features/patients/components/AddPatient'));
const EditPatient = lazy(() => import('../features/patients/components/EditPatientPage'));
const Appointments = lazy(() => import('../features/appointments/components/Appointments'));
const DeletedAppointments = lazy(() => import('../features/appointments/components/DeletedAppointments'));
// Notes feature removed — replaced by Private Notebook + Quick Note per v1 spec
const ClinicList = lazy(() => import('../features/clinics/components/Clinics'));
const ClinicDetail = lazy(() => import('../features/clinics/components/ClinicDetail'));
const ClinicForm = lazy(() => import('../features/clinics/components/ClinicForm'));
const Forum = lazy(() => import('../features/forum/components/Forum'));
const Profile = lazy(() => import('../features/profile/components/Profile'));
const EditProfile = lazy(() => import('../features/profile/components/EditProfile'));
const ReferralsList = lazy(() => import('../features/referrals/components/ReferralsList'));
const Statistics = lazy(() => import('../features/statistics/components/Statistics'));
const Prescriptions = lazy(() => import('../features/prescriptions/components/Prescriptions'));
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
                    <Route path="/clinics" element={<AdminClinicList />} />
                    <Route path="/forum" element={<AdminForumModeration />} />
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
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/patients" element={<Patients refreshPatients={refreshPatients} />} />
                        <Route path="/patients/:id" element={<PatientDetail />} />
                        <Route path="/patients/add" element={<AddPatient onPatientAdded={handlePatientAdded} />} />
                        <Route path="/patients/edit/:id" element={<EditPatient />} />
                        <Route path="/appointments" element={<Appointments />} />
                        <Route path="/deleted-appointments" element={<DeletedAppointments />} />
                        {/* /notes route removed — replaced by /notebook per v1 spec */}

                        <Route path="/referrals" element={<ReferralsList />} />

                        <Route path="/clinics" element={<ClinicList />} />
                        <Route path="/clinics/add" element={<ClinicForm />} />
                        <Route path="/clinics/edit/:id" element={<ClinicForm />} />
                        <Route path="/clinics/:id" element={<ClinicDetail />} />

                        <Route path="/forum" element={<Forum />} />
                        <Route path="/prescriptions" element={<Prescriptions />} />
                        <Route path="/notebook" element={<PrivateNotebook />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/edit-profile" element={<EditProfile />} />

                        {/* Personal stats: open to all doctors — every doctor should see their own caseload */}
                        <Route path="/my-stats" element={<Statistics />} />

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
