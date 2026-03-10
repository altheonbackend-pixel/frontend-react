// src/app/App.tsx

import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Shared components
import Header from '../shared/components/Header';
import PrivateRoutes from '../shared/components/PrivateRoutes';

// Auth feature
import { useAuth } from '../features/auth/hooks/useAuth';
import LandingPage from '../features/auth/components/LandingPage';
import Register from '../features/auth/components/Register';
import Dashboard from '../features/auth/components/Dashboard';

// Patient feature
import Patients from '../features/patients/components/Patients';
import PatientDetail from '../features/patients/components/PatientDetail';
import AddPatient from '../features/patients/components/AddPatient';
import EditPatient from '../features/patients/components/EditPatientPage';

// Appointment feature
import Appointments from '../features/appointments/components/Appointments';
import DeletedAppointments from '../features/appointments/components/DeletedAppointments';

// Notes feature
import Notes from '../features/notes/components/Notes';

// Clinics feature
import ClinicList from '../features/clinics/components/Clinics';
import ClinicDetail from '../features/clinics/components/ClinicDetail';
import ClinicForm from '../features/clinics/components/ClinicForm';

// Forum feature
import Forum from '../features/forum/components/Forum';

// Profile feature
import Profile from '../features/profile/components/Profile';
import EditProfile from '../features/profile/components/EditProfile';

// Referrals feature
import ReferralsList from '../features/referrals/components/ReferralsList';

// Statistics feature
import Statistics from '../features/statistics/components/Statistics';
import StatisticsGlobale from '../features/statistics/components/StatisticsGlobale';

import './App.css';

function App() {
    const { isAuthenticated, authIsLoading } = useAuth();
    const [refreshPatients, setRefreshPatients] = useState(false);

    const handlePatientAdded = () => {
        setRefreshPatients(prev => !prev);
    };

    if (authIsLoading) {
        return <div>Chargement de l'application...</div>;
    }

    return (
        <div className="App">
            {isAuthenticated && <Header />}
            
            <Routes>
                {/* 1. Page d'inscription (reste séparée) */}
                <Route path="/register" element={<Register />} />
                
                {/* 2. Page d'Accueil/Connexion (utilise le nouveau composant Home) */}
                <Route path="/login" element={<LandingPage />} />
                
                {/* Routes protégées par PrivateRoutes */}
                <Route element={<PrivateRoutes />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/patients" element={<Patients refreshPatients={refreshPatients} />} />
                    <Route path="/patients/:id" element={<PatientDetail />} />
                    <Route path="/patients/add" element={<AddPatient onPatientAdded={handlePatientAdded} />} />
                    <Route path="/patients/edit/:id" element={<EditPatient />} />
                    <Route path="/appointments" element={<Appointments />} />
                    <Route path="/deleted-appointments" element={<DeletedAppointments />} />
                    <Route path="/notes" element={<Notes />} />
                    
                    <Route path="/referrals" element={<ReferralsList />} />

                    <Route path="/clinics" element={<ClinicList />} />
                    <Route path="/clinics/add" element={<ClinicForm />} />
                    <Route path="/clinics/edit/:id" element={<ClinicForm />} />
                    <Route path="/clinics/:id" element={<ClinicDetail />} />
                    
                    <Route path="/forum" element={<Forum />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/edit-profile" element={<EditProfile />} />
                    
                    <Route path="/my-stats" element={<Statistics />} />
                    <Route path="/global-stats" element={<StatisticsGlobale />} />
                    
                </Route>
                
                {/* Redirection par défaut */}
                <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
    );
}

export default App;
