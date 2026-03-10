// src/features/appointments/services/appointmentService.ts

import api from '../../../shared/services/api';

export const getAppointments = () =>
    api.get('/appointments/');

export const createAppointment = (data: Record<string, unknown>) =>
    api.post('/appointments/', data);

export const updateAppointment = (id: number, data: Record<string, unknown>) =>
    api.patch(`/appointments/${id}/`, data);

export const deleteAppointment = (id: number, data: { reason: string; comment: string }) =>
    api.delete(`/appointments/${id}/`, { data });

export const getDeletedAppointments = () =>
    api.get('/appointments/deleted/');
