// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './app/App';
import { AuthProvider } from './features/auth/context/AuthContext';
import { AdminContextProvider } from './features/admin/context/AdminContext';
import ErrorBoundary from './shared/components/ErrorBoundary';
import './i18n';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // Data stays fresh for 1 minute
      gcTime: 5 * 60 * 1000,       // Keep in cache 5 minutes after unmount
      retry: 1,
      refetchOnWindowFocus: false,  // Don't re-fetch on tab switch for medical data
    },
    mutations: {
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AuthProvider>
            <AdminContextProvider>
              <App />
              <Toaster position="top-right" richColors closeButton />
            </AdminContextProvider>
          </AuthProvider>
        </Router>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);