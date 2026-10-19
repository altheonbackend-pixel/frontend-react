export const BASE_URL = import.meta.env.VITE_API_URL
  || 'https://backend-django-bl18.onrender.com';

export const API_BASE_URL = `${BASE_URL}/api/v1`;
/** Feature switches. The consultation workspace replaces the drawer form;
 *  set VITE_CONSULT_WORKSPACE=off to fall back to the drawer. */
export const FEATURES = {
    consultationWorkspace: import.meta.env.VITE_CONSULT_WORKSPACE !== 'off',
};

export const consultationWorkspacePath = (patientId: string, consultationId?: number | null) =>
    `/patients/${patientId}/visit/${consultationId ?? 'new'}`;
