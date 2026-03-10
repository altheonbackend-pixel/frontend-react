// src/features/auth/services/authService.ts

import api from '../../../shared/services/api';

export const loginUser = (credentials: { email: string; password: string }) =>
    api.post('/login/', credentials);

export const registerDoctor = (data: Record<string, unknown>) =>
    api.post('/register/doctor/', data);

export const getDoctorProfile = () =>
    api.get('/profile/');

export const updateDoctorProfile = (data: Record<string, unknown>) =>
    api.patch('/profile/update/', data);
