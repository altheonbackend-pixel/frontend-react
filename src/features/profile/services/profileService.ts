// src/features/profile/services/profileService.ts

import api from '../../../shared/services/api';

export const getProfile = () =>
    api.get('/profile/');

export const updateProfile = (data: Record<string, unknown>) =>
    api.patch('/profile/update/', data);

export const getDoctors = () =>
    api.get('/doctors/');
