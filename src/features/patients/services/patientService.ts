// src/features/patients/services/patientService.ts

import api from '../../../shared/services/api';

export const getMyPatients = () =>
    api.get('/doctors/me/patients/');

export const getPatient = (id: string) =>
    api.get(`/patients/${encodeURIComponent(id)}/`);

export const createPatient = (data: Record<string, unknown>) =>
    api.post('/patients/', data);

export const updatePatient = (id: string, data: Record<string, unknown>) =>
    api.patch(`/patients/${encodeURIComponent(id)}/`, data);

export const deletePatient = (id: string) =>
    api.delete(`/patients/${encodeURIComponent(id)}/`);
