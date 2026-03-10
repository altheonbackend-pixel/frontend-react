// src/features/referrals/services/referralService.ts

import api from '../../../shared/services/api';

export const getReferrals = () =>
    api.get('/referrals/');

export const createReferral = (data: Record<string, unknown>) =>
    api.post('/referrals/', data);

export const updateReferral = (id: number, data: Record<string, unknown>) =>
    api.patch(`/referrals/${id}/`, data);

export const deleteReferral = (id: number) =>
    api.delete(`/referrals/${id}/`);
