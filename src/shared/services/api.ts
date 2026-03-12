// src/shared/services/api.ts — Central axios instance with interceptors

import axios from 'axios';
import { API_BASE_URL } from '../../config';

const api = axios.create({
    baseURL: API_BASE_URL,
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
        if (error.response?.status === 401 && !original._retried) {
            original._retried = true;
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                try {
                    // Use plain axios (not `api`) to avoid triggering this interceptor again
                    const res = await axios.post(`${API_BASE_URL}/token/refresh/`, {
                        refresh: refreshToken,
                    });
                    const newAccess = res.data.access;
                    localStorage.setItem('token', newAccess);
                    original.headers.Authorization = `Bearer ${newAccess}`;
                    return api(original);
                } catch {
                    // Refresh failed — clear all tokens and force re-login
                    localStorage.removeItem('token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                    return Promise.reject(error);
                }
            }
            // No refresh token available — clear stale access token
            localStorage.removeItem('token');
        }
        return Promise.reject(error);
    }
);

export default api;
