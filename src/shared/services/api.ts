// src/shared/services/api.ts — Central axios instance with interceptors

import axios from 'axios';
import { API_BASE_URL } from '../../config';

// Logout callback registered by AuthContext after login so api.ts can trigger
// logout without importing AuthContext (avoids circular dependencies).
let _logoutRef: (() => void) | null = null;
export function setLogoutCallback(fn: () => void) { _logoutRef = fn; }

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    withCredentials: true,  // Send httpOnly auth cookies on every request (cross-origin safe)
    headers: {
        'Content-Type': 'application/json',
    },
});

// No request interceptor for Authorization header — the httpOnly 'access_token' cookie
// is attached automatically by the browser on every request. Tokens never touch JS memory.

// --- Concurrent 401 refresh queue ---
// Prevents race condition where multiple simultaneous 401 responses all try to refresh
// independently. Only one refresh is in-flight at a time; subsequent 401s queue up and
// are resolved/rejected in bulk once the refresh completes.
let isRefreshing = false;
let refreshSubscribers: Array<() => void> = [];
let refreshRejecters: Array<(err: unknown) => void> = [];

function onRefreshed() {
    refreshSubscribers.forEach((cb) => cb());
    refreshSubscribers = [];
    refreshRejecters = [];
}

function onRefreshFailed(err: unknown) {
    refreshRejecters.forEach((cb) => cb(err));
    refreshSubscribers = [];
    refreshRejecters = [];
}

function addRefreshSubscriber(resolve: () => void, reject: (err: unknown) => void) {
    refreshSubscribers.push(resolve);
    refreshRejecters.push(reject);
}

// Response interceptor: silent token refresh on 401.
// On first 401, POST to /token/refresh/ — the refresh_token httpOnly cookie is sent
// automatically. If refresh succeeds (new access_token cookie is set by the server),
// the original request is retried. If refresh fails, redirect to /login.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (error.response?.status !== 401 || original._retried) {
            return Promise.reject(error);
        }

        // Never attempt a token refresh when the 401 came from an auth endpoint —
        // the login endpoint returns 401 for bad credentials (not expiry), and
        // the refresh endpoint itself can't be refreshed. Without this guard the
        // interceptor swallows the real error and surfaces "Refresh token not found."
        const url: string = original.url ?? '';
        if (url.includes('/login/') || url.includes('/token/refresh/')) {
            return Promise.reject(error);
        }

        // If a refresh is already in-flight, queue this request until it resolves
        if (isRefreshing) {
            return new Promise<void>((resolve, reject) => {
                addRefreshSubscriber(resolve, reject);
            }).then(() => api(original));
        }

        original._retried = true;
        isRefreshing = true;

        try {
            // POST to refresh endpoint — refresh_token cookie is sent automatically.
            // Server sets a new access_token cookie in the response.
            // No body needed; no token to read from the response.
            await axios.post(`${API_BASE_URL}/token/refresh/`, {}, { withCredentials: true, timeout: 10000 });
            onRefreshed();
            return api(original);
        } catch (refreshError) {
            onRefreshFailed(refreshError);
            _logoutRef?.();
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
