import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ───────────────────────────────────────────────────────────────────
// i18n: return the key (with the count for plurals) so assertions are stable.
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o && 'count' in o ? `${k}:${o.count}` : k) }),
}));

// Map is not renderable under jsdom — stub it and expose viewport trigger.
vi.mock('../../../../shared/components/map/LeafletMap', () => ({
    default: ({ onViewportChange }: { onViewportChange?: (b: object) => void }) => {
        onViewportChange?.({ north: 52, south: 51, east: 0, west: -1 });
        return <div data-testid="map" />;
    },
}));

const { searchDoctors, getMapPins, geocode } = vi.hoisted(() => ({
    searchDoctors: vi.fn(), getMapPins: vi.fn(), geocode: vi.fn(),
}));
vi.mock('../../services/locatorService', () => ({
    locatorService: { searchDoctors, getMapPins, geocode },
}));

// specialties fetch via shared api
vi.mock('../../../../shared/services/api', () => ({
    default: { get: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../../../../shared/hooks/usePageTitle', () => ({ usePageTitle: () => {} }));

import FindDoctors from '../FindDoctors';

function renderPage() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={qc}>
            <MemoryRouter initialEntries={['/find-doctors']}>
                <FindDoctors />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    searchDoctors.mockReset();
    getMapPins.mockReset().mockResolvedValue({ count: 0, truncated: false, results: [] });
    geocode.mockReset();
});

describe('FindDoctors', () => {
    it('renders search results from the service', async () => {
        searchDoctors.mockResolvedValue({
            count: 1, page: 1, page_size: 20, num_pages: 1,
            results: [{
                id: 5, full_name: 'Dr. Jane Doe', specialty: 'cardiology',
                specialty_display: 'Cardiology', accepting_referrals: true,
                next_available: null, distance_km: 3.2,
                nearest_location: { full_address: '1 Rd, London' },
            }],
        });
        renderPage();
        expect(await screen.findByText('Dr. Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('Cardiology')).toBeInTheDocument();
        expect(screen.getByText('findDoctors.resultCount:1')).toBeInTheDocument();
    });

    it('shows the empty state when no doctors match', async () => {
        searchDoctors.mockResolvedValue({ count: 0, page: 1, page_size: 20, num_pages: 0, results: [] });
        renderPage();
        expect(await screen.findByText('findDoctors.empty')).toBeInTheDocument();
    });

    it('uses geolocation when "use my location" is clicked', async () => {
        searchDoctors.mockResolvedValue({ count: 0, page: 1, page_size: 20, num_pages: 0, results: [] });
        const getCurrentPosition = vi.fn().mockImplementation((ok) =>
            ok({ coords: { latitude: 51.5, longitude: -0.12 } }));
        Object.defineProperty(globalThis.navigator, 'geolocation', {
            value: { getCurrentPosition }, configurable: true,
        });

        renderPage();
        await screen.findByTestId('map');
        fireEvent.click(screen.getByText('findDoctors.useMyLocation'));

        await waitFor(() => {
            expect(getCurrentPosition).toHaveBeenCalled();
            // A geo search (with lat/lng) should have been issued.
            const calledWithGeo = searchDoctors.mock.calls.some(
                ([p]) => p && p.lat === 51.5 && p.lng === -0.12,
            );
            expect(calledWithGeo).toBe(true);
        });
    });
});
