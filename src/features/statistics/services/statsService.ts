// src/features/statistics/services/statsService.ts

import api from '../../../shared/services/api';

export const getDoctorStats = () =>
    api.get('/doctors/stats/');

export const getDoctorPatientStats = () =>
    api.get('/doctors/patients/stats/');

export const getGlobalStats = () =>
    api.get('/stats/global/');
