// src/features/consultations/services/consultationService.ts

import api from '../../../shared/services/api';

export const getConsultations = () =>
    api.get('/consultations/');

export const createConsultation = (data: Record<string, unknown>) =>
    api.post('/consultations/', data);

export const updateConsultation = (id: number, data: Record<string, unknown>) =>
    api.patch(`/consultations/${id}/`, data);

export const deleteConsultation = (id: number) =>
    api.delete(`/consultations/${id}/`);
