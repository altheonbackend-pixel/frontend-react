// src/features/statistics/services/statsService.ts

import api from '../../../shared/services/api';

export const getDoctorStats = () =>
    api.get('/doctor/stats/');

export const getDoctorPatientStats = () =>
    api.get('/doctor-patients/stats/');

export const getGlobalStats = () =>
    api.get('/stats/global/');
