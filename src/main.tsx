// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './app/App';
import { AuthProvider } from './features/auth/context/AuthContext';
import { AdminContextProvider } from './features/admin/context/AdminContext';
import ErrorBoundary from './shared/components/ErrorBoundary';
import './i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <AdminContextProvider>
            <App />
            <Toaster position="top-right" richColors closeButton />
          </AdminContextProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  </React.StrictMode>
);