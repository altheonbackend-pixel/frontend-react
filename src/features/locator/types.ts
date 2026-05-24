// Doctor locator / map — shared types (patient discovery + doctor management).

export interface PracticeLocation {
    id: number;
    label: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    full_address: string;
    latitude: number | null;
    longitude: number | null;
    geocode_source?: string;
    geocoded_at?: string | null;
    place_id?: string;
    phone: string;
    is_primary: boolean;
    is_active?: boolean;
    is_visible?: boolean;
    accepts_in_person: boolean;
    has_coords?: boolean;
    is_mappable?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface DoctorSearchResult {
    id: number;
    full_name: string;
    specialty: string;
    specialty_display: string;
    accepting_referrals: boolean;
    next_available: string | null;
    nearest_location: PracticeLocation | null;
    distance_km: number | null;
    avatar_url?: string | null;
}

export interface DoctorSearchResponse {
    count: number;
    page: number;
    page_size: number;
    num_pages: number;
    results: DoctorSearchResult[];
}

export interface DoctorMapPin {
    doctor_id: number;
    location_id: number;
    latitude: number;
    longitude: number;
    full_name: string;
    specialty: string;
    specialty_display: string;
    is_primary: boolean;
}

export interface DoctorMapResponse {
    count: number;
    truncated: boolean;
    results: DoctorMapPin[];
}

export interface PublicDoctorProfile {
    id: number;
    full_name: string;
    specialty: string;
    specialty_display: string;
    accepting_referrals: boolean;
    next_available: string | null;
    consultation_fee: string | null;
    currency: string | null;
    timezone: string;
    languages: string[];
    locations: PracticeLocation[];
    avatar_url?: string | null;
}

export interface GeoResult {
    display_name: string;
    latitude: number;
    longitude: number;
    place_id?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
}

export interface DoctorSearchParams {
    lat?: number;
    lng?: number;
    radius_km?: number;
    q?: string;
    city?: string;
    country?: string;
    specialty?: string;
    accepting_new?: boolean;
    sort?: 'distance' | 'name';
    page?: number;
    page_size?: number;
}

export interface MapBoundsParams {
    north: number;
    south: number;
    east: number;
    west: number;
    specialty?: string;
    accepting_new?: boolean;
}
