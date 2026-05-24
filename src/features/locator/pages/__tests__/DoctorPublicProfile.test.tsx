import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, d?: string) => (typeof d === 'string' ? d : k) }),
}));

vi.mock('../../../../shared/components/map/LeafletMap', () => ({
    default: () => <div data-testid="map" />,
}));

vi.mock('../../../../shared/components/ui', () => ({
    Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
        (open ? <div data-testid="booking-modal">{children}</div> : null),
    toast: { success: vi.fn(), error: vi.fn() },
    parseApiError: (_e: unknown, f: string) => f,
}));

vi.mock('../../../../shared/hooks/usePageTitle', () => ({ usePageTitle: () => {} }));

const { getPublicProfile, authState } = vi.hoisted(() => ({
    getPublicProfile: vi.fn(),
    authState: { isAuthenticated: false, userType: null as string | null },
}));
vi.mock('../../services/locatorService', () => ({
    locatorService: { getPublicProfile },
}));

vi.mock('../../../patient-portal/services/patientPortalService', () => ({
    patientPortalService: { requestAppointment: vi.fn() },
}));

vi.mock('../../../auth/hooks/useAuth', () => ({
    useAuth: () => authState,
}));

import DoctorPublicProfile from '../DoctorPublicProfile';

const PROFILE = {
    id: 9, full_name: 'Dr. Jane Doe', specialty: 'cardiology', specialty_display: 'Cardiology',
    accepting_referrals: true, next_available: null, consultation_fee: null, currency: null,
    timezone: 'UTC', languages: ['en'],
    locations: [{ id: 1, label: 'Main', full_address: '1 Rd, London', latitude: 51.5, longitude: -0.12, is_primary: true, phone: '', accepts_in_person: true }],
};

function renderProfile() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={qc}>
            <MemoryRouter initialEntries={['/find-doctors/9']}>
                <Routes>
                    <Route path="/find-doctors/:id" element={<DoctorPublicProfile />} />
                    <Route path="/patient/login" element={<div data-testid="login-page">LOGIN</div>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    getPublicProfile.mockReset().mockResolvedValue(PROFILE);
    authState.isAuthenticated = false;
    authState.userType = null;
});

describe('DoctorPublicProfile', () => {
    it('renders the doctor profile and locations', async () => {
        renderProfile();
        expect(await screen.findByText('Dr. Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('1 Rd, London')).toBeInTheDocument();
        expect(screen.getByTestId('map')).toBeInTheDocument();
    });

    it('redirects anonymous users to login when booking', async () => {
        renderProfile();
        await screen.findByText('Dr. Jane Doe');
        fireEvent.click(screen.getByText('findDoctors.booking.cta'));
        // No modal for anon — they are routed to the login page instead.
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
        expect(screen.queryByTestId('booking-modal')).not.toBeInTheDocument();
    });

    it('opens the booking modal for an authenticated patient', async () => {
        authState.isAuthenticated = true;
        authState.userType = 'patient';
        renderProfile();
        await screen.findByText('Dr. Jane Doe');
        fireEvent.click(screen.getByText('findDoctors.booking.cta'));
        expect(screen.getByTestId('booking-modal')).toBeInTheDocument();
    });
});
