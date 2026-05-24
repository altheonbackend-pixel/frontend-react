import api from '../../../shared/services/api';
import type {
    DoctorSearchParams,
    DoctorSearchResponse,
    DoctorMapResponse,
    MapBoundsParams,
    PublicDoctorProfile,
    PracticeLocation,
    GeoResult,
} from '../types';

function clean(params: object): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        out[k] = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
    }
    return out;
}

export const locatorService = {
    // ── Patient-facing discovery (public) ──────────────────────────────────
    searchDoctors: (params: DoctorSearchParams) =>
        api.get<DoctorSearchResponse>('/patient/doctors/search/', { params: clean(params) })
            .then(r => r.data),

    getMapPins: (params: MapBoundsParams) =>
        api.get<DoctorMapResponse>('/patient/doctors/map/', { params: clean(params) })
            .then(r => r.data),

    getPublicProfile: (id: number) =>
        api.get<PublicDoctorProfile>(`/patient/doctors/${id}/public-profile/`).then(r => r.data),

    // Public geocode proxy: forward (place search) or reverse ("use my location").
    geocode: (query: string) =>
        api.post<{ results: GeoResult[] }>('/patient/geocode/', { query }).then(r => r.data.results),

    reverseGeocode: (lat: number, lng: number) =>
        api.post<{ result: GeoResult | null }>('/patient/geocode/', { lat, lng }).then(r => r.data.result),

    // ── Doctor-side location management (authenticated) ─────────────────────
    listMyLocations: () =>
        api.get<PracticeLocation[]>('/profile/locations/').then(r => r.data),

    createLocation: (data: Partial<PracticeLocation>) =>
        api.post<PracticeLocation>('/profile/locations/', data).then(r => r.data),

    updateLocation: (id: number, data: Partial<PracticeLocation>) =>
        api.patch<PracticeLocation>(`/profile/locations/${id}/`, data).then(r => r.data),

    deleteLocation: (id: number) =>
        api.delete(`/profile/locations/${id}/`).then(r => r.data),

    setPrimaryLocation: (id: number) =>
        api.post<PracticeLocation>(`/profile/locations/${id}/set-primary/`).then(r => r.data),

    // Doctor geocode proxy (authenticated; forward only).
    geocodeForDoctor: (query: string) =>
        api.post<{ results: GeoResult[] }>('/geocode/', { query }).then(r => r.data.results),
};
