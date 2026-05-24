// Opens Google Maps with turn-by-turn directions to the given destination.
// On mobile, Google Maps URLs handle the geo: intent automatically when the
// Maps app is installed; on desktop they open the web map.
//
// Prefer coords (precise) — fall back to an address query when coords missing.

interface DirectionsTarget {
    lat?: number | null;
    lng?: number | null;
    address?: string | null;
    label?: string | null;
}

export function buildDirectionsUrl({ lat, lng, address, label }: DirectionsTarget): string | null {
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        const dest = `${lat},${lng}`;
        const params = new URLSearchParams({ api: '1', destination: dest });
        // Including a place name helps Google Maps label the pin on arrival.
        if (label) params.set('destination_place_id', '');
        return `https://www.google.com/maps/dir/?${params.toString()}`;
    }
    const query = (address || label || '').trim();
    if (!query) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export function openDirections(target: DirectionsTarget): boolean {
    const url = buildDirectionsUrl(target);
    if (!url) return false;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
}
