// src/shared/services/api.ts — Central axios instance with interceptors

import axios from 'axios';
import { API_BASE_URL } from '../../config';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000, // 15-second timeout prevents requests hanging indefinitely
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: auto-inject auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// --- Concurrent 401 refresh queue ---
// Prevents race condition where multiple simultaneous requests all try to refresh
// the token independently. Only one refresh is in-flight at a time; subsequent
// 401s queue up and are resolved/rejected in bulk once the refresh completes.
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let refreshRejecters: Array<(err: unknown) => void> = [];

function onRefreshed(newToken: string) {
    refreshSubscribers.forEach((cb) => cb(newToken));
    refreshSubscribers = [];
    refreshRejecters = [];
}

function onRefreshFailed(err: unknown) {
    refreshRejecters.forEach((cb) => cb(err));
    refreshSubscribers = [];
    refreshRejecters = [];
}

function addRefreshSubscriber(resolve: (token: string) => void, reject: (err: unknown) => void) {
    refreshSubscribers.push(resolve);
    refreshRejecters.push(reject);
}

// Response interceptor: silent token refresh on 401.
// On first 401, attempt a refresh using the stored refresh token.
// If the refresh succeeds, the original request is retried transparently.
// If the refresh also fails (or no refresh token is stored), clear all tokens
// and redirect to /login (full page reload, which also clears React state).
// AuthContext may register an additional interceptor on top of this to clear
// in-memory auth state (user, profile, isAuthenticated).
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (error.response?.status !== 401 || original._retried) {
            return Promise.reject(error);
        }

        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            localStorage.removeItem('token');
            return Promise.reject(error);
        }

        // If a refresh is already in-flight, queue this request
        if (isRefreshing) {
            return new Promise<string>((resolve, reject) => {
                addRefreshSubscriber(resolve, reject);
            }).then((newToken) => {
                original.headers.Authorization = `Bearer ${newToken}`;
                return api(original);
            });
        }

        original._retried = true;
        isRefreshing = true;

        try {
            // Use plain axios (not `api`) to avoid triggering this interceptor again
            const res = await axios.post(`${API_BASE_URL}/token/refresh/`, {
                refresh: refreshToken,
            });
            const newAccess: string = res.data.access;
            localStorage.setItem('token', newAccess);
            // SimpleJWT ROTATE_REFRESH_TOKENS: store the rotated refresh token if provided
            if (res.data.refresh) {
                localStorage.setItem('refresh_token', res.data.refresh);
            }
            original.headers.Authorization = `Bearer ${newAccess}`;
            onRefreshed(newAccess);
            return api(original);
        } catch (refreshError) {
            onRefreshFailed(refreshError);
            localStorage.removeItem('token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
