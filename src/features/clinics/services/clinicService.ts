// src/features/clinics/services/clinicService.ts

import api from '../../../shared/services/api';

export const getWorkplaces = () =>
    api.get('/workplaces/');

export const getWorkplace = (id: number) =>
    api.get(`/workplaces/${id}/`);

export const createWorkplace = (data: Record<string, unknown>) =>
    api.post('/workplaces/', data);

export const updateWorkplace = (id: number, data: Record<string, unknown>) =>
    api.patch(`/workplaces/${id}/`, data);

export const deleteWorkplace = (id: number) =>
    api.delete(`/workplaces/${id}/`);

export const getWorkplaceStatistics = (id: number) =>
    api.get(`/workplaces/${id}/statistics/`);
