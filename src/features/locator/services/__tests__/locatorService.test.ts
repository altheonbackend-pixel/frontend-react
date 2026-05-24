import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared axios instance before importing the service.
// vi.hoisted keeps these defined when the hoisted vi.mock factory runs.
const { get, post, patch, del } = vi.hoisted(() => ({
    get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(),
}));
vi.mock('../../../../shared/services/api', () => ({
    default: { get, post, patch, delete: del },
}));

import { locatorService } from '../locatorService';

beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { results: [] } });
    post.mockReset().mockResolvedValue({ data: { results: [] } });
    patch.mockReset().mockResolvedValue({ data: {} });
    del.mockReset().mockResolvedValue({ data: {} });
});

describe('locatorService.searchDoctors', () => {
    it('drops empty/null params and stringifies the rest', async () => {
        await locatorService.searchDoctors({
            lat: 51.5, lng: -0.12, radius_km: 25,
            specialty: '', q: undefined, accepting_new: true,
        });
        const [url, config] = get.mock.calls[0];
        expect(url).toBe('/patient/doctors/search/');
        expect(config.params).toEqual({
            lat: '51.5', lng: '-0.12', radius_km: '25', accepting_new: '1',
        });
        // Empty/undefined are omitted entirely.
        expect(config.params.specialty).toBeUndefined();
        expect(config.params.q).toBeUndefined();
    });

    it('encodes accepting_new=false as 0', async () => {
        await locatorService.searchDoctors({ accepting_new: false });
        expect(get.mock.calls[0][1].params).toEqual({ accepting_new: '0' });
    });
});

describe('locatorService geocode', () => {
    it('reverse geocode posts lat/lng', async () => {
        post.mockResolvedValueOnce({ data: { result: { latitude: 1, longitude: 2 } } });
        const res = await locatorService.reverseGeocode(1, 2);
        expect(post).toHaveBeenCalledWith('/patient/geocode/', { lat: 1, lng: 2 });
        expect(res).toEqual({ latitude: 1, longitude: 2 });
    });

    it('forward geocode posts query and unwraps results', async () => {
        post.mockResolvedValueOnce({ data: { results: [{ display_name: 'X', latitude: 1, longitude: 2 }] } });
        const res = await locatorService.geocode('london');
        expect(post).toHaveBeenCalledWith('/patient/geocode/', { query: 'london' });
        expect(res).toHaveLength(1);
    });
});

describe('locatorService doctor location CRUD', () => {
    it('setPrimary posts to the set-primary endpoint', async () => {
        patch.mockReset();
        await locatorService.setPrimaryLocation(7);
        expect(post).toHaveBeenCalledWith('/profile/locations/7/set-primary/');
    });

    it('updateLocation patches by id', async () => {
        await locatorService.updateLocation(3, { label: 'New' });
        expect(patch).toHaveBeenCalledWith('/profile/locations/3/', { label: 'New' });
    });
});
