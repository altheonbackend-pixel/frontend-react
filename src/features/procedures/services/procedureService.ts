// src/features/procedures/services/procedureService.ts

import api from '../../../shared/services/api';

export const getMedicalProcedures = () =>
    api.get('/medical-procedures/');

export const createMedicalProcedure = (data: FormData) =>
    api.post('/medical-procedures/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export const deleteMedicalProcedure = (id: number) =>
    api.delete(`/medical-procedures/${id}/`);
