// src/main.tsx
import React, { Suspense } from 'react';

// When Vercel deploys a new version, old chunk hashes no longer exist on the CDN.
// Any user still holding the old index.html will hit 404s on dynamic imports.
// Vite 4.4+ fires this event — we hard-reload once to pull the fresh index.html.
window.addEventListener('vite:preloadError', () => {
    const key = 'vite_chunk_reload_at';
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last > 15_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
    }
});
import ReactDOM from 'react-dom/client';

// Sentry — error monitoring (only initialised when VITE_SENTRY_DSN is set).
// `@sentry/react` is an OPTIONAL dep — install it (`npm install @sentry/react`)
// only when you intend to actually configure a DSN. The dynamic import below
// uses `@vite-ignore` so Vite's dependency scanner does NOT try to resolve the
// package at build / dev-server start time; the import only runs at runtime
// after the DSN env var is set. Without this, missing the optional dep tanks
// the entire app bundle (Vite refuses to pre-transform `main.tsx`).
// CRITICAL: request.data is redacted to prevent patient data leaking to Sentry.
if (import.meta.env.VITE_SENTRY_DSN) {
    // The string literal is held in a variable so Vite's static dependency
    // scanner can't resolve the import target at build time; the package only
    // needs to exist if a DSN is actually configured. `/* @vite-ignore */`
    // alone is not enough in Vite 7 — the import-analysis plugin still tries
    // to resolve literal arguments.
    const sentryPkg = '@sentry/react';
    import(/* @vite-ignore */ sentryPkg).then((Sentry: { init: (opts: Record<string, unknown>) => void }) => {
        Sentry.init({
            dsn: import.meta.env.VITE_SENTRY_DSN,
            environment: import.meta.env.VITE_ENV ?? 'production',
            tracesSampleRate: 0.1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            beforeSend(event: any) {
                // Never send form data — may contain patient names / medical info
                if (event.request?.data) {
                    event.request.data = '[REDACTED]';
                }
                return event;
            },
        });
    }).catch(() => {
        // Optional dep not installed — Sentry stays disabled. Silent by design.
    });
}
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './app/App';
import { AuthProvider } from './features/auth/context/AuthContext';
import { AdminContextProvider } from './features/admin/context/AdminContext';
import { PatientPortalProvider } from './features/patient-portal/context/PatientPortalContext';
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
            <PatientPortalProvider>
              <AdminContextProvider>
                <Suspense fallback={null}>
                  <App />
                </Suspense>
                <Toaster position="top-right" richColors closeButton />
              </AdminContextProvider>
            </PatientPortalProvider>
          </AuthProvider>
        </Router>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
