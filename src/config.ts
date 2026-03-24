// src/config.ts — Single source of truth for API configuration

export const BASE_URL = import.meta.env.PROD
    ? 'https://backend-django-production-004e.up.railway.app'
    : 'http://127.0.0.1:8000';

export const API_BASE_URL = `${BASE_URL}/api`;
