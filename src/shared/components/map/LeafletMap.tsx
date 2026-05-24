// Shared Leaflet map wrapper. All map-provider specifics live here so the rest
// of the app stays provider-agnostic (swap to Google/Mapbox by editing this file).
import { useEffect, useMemo, type ReactNode } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Marker clustering (pure Leaflet plugin — augments L with markerClusterGroup).
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix Leaflet's default marker icons under a bundler (Vite). Without this the
// markers 404 because Leaflet builds icon URLs relative to the CSS file.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// A red-tinted icon for the doctor's primary location / selected pin.
const primaryIcon = new L.Icon({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: 'leaflet-marker-primary',
});

export interface MapMarker {
    id: string | number;
    lat: number;
    lng: number;
    popup?: ReactNode;
    primary?: boolean;
    // Used in cluster mode, where popups are built imperatively (HTML, escaped).
    title?: string;
    subtitle?: string;
    onView?: () => void;
    viewLabel?: string;
}

// Escape user-controlled strings before they go into an imperative popup's HTML.
function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ));
}

export interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

interface LeafletMapProps {
    center: [number, number];
    zoom?: number;
    markers?: MapMarker[];
    height?: string;
    /** Imperatively re-center when this tuple changes. */
    recenterTo?: [number, number] | null;
    recenterZoom?: number;
    onMarkerClick?: (id: string | number) => void;
    onViewportChange?: (bounds: MapBounds, center: [number, number], zoom: number) => void;
    /** Show a single draggable marker (used in the doctor location editor). */
    draggableMarker?: { lat: number; lng: number } | null;
    onMarkerDrag?: (lat: number, lng: number) => void;
    /** Drop a pin where the user clicks (location editor). */
    onMapClick?: (lat: number, lng: number) => void;
    /** Group nearby markers into clusters (discovery map). */
    cluster?: boolean;
    className?: string;
    ariaLabel?: string;
}

// Imperative cluster layer — markercluster manages its own layers, so we add
// plain L.marker objects to a cluster group rather than react-leaflet <Marker>s.
function ClusterLayer({
    markers,
    onMarkerClick,
}: {
    markers: MapMarker[];
    onMarkerClick?: (id: string | number) => void;
}) {
    const map = useMap();
    useEffect(() => {
        const group = L.markerClusterGroup({
            chunkedLoading: true,
            showCoverageOnHover: false,
            maxClusterRadius: 50,
        });
        markers.forEach((m) => {
            const marker = L.marker([m.lat, m.lng], m.primary ? { icon: primaryIcon } : {});
            const hasPopup = m.title || m.subtitle || m.onView;
            if (hasPopup) {
                const html =
                    (m.title ? `<div class="map-popup__name">${escapeHtml(m.title)}</div>` : '') +
                    (m.subtitle ? `<div class="map-popup__spec">${escapeHtml(m.subtitle)}</div>` : '') +
                    (m.onView ? `<button class="btn btn-primary btn-sm" data-view="1">${escapeHtml(m.viewLabel ?? 'View')}</button>` : '');
                marker.bindPopup(html);
                if (m.onView) {
                    marker.on('popupopen', (e) => {
                        const el = (e.popup as L.Popup).getElement();
                        const btn = el?.querySelector('[data-view]');
                        btn?.addEventListener('click', () => m.onView?.(), { once: true });
                    });
                }
            }
            if (onMarkerClick) marker.on('click', () => onMarkerClick(m.id));
            group.addLayer(marker);
        });
        map.addLayer(group);
        return () => { map.removeLayer(group); };
    }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}

function ViewportWatcher({ onViewportChange }: { onViewportChange?: LeafletMapProps['onViewportChange'] }) {
    const map = useMapEvents({
        moveend: () => emit(),
        zoomend: () => emit(),
    });
    function emit() {
        if (!onViewportChange) return;
        const b = map.getBounds();
        const c = map.getCenter();
        onViewportChange(
            { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
            [c.lat, c.lng],
            map.getZoom(),
        );
    }
    return null;
}

function Recenter({ to, zoom }: { to: [number, number] | null | undefined; zoom?: number }) {
    const map = useMap();
    useEffect(() => {
        if (to) map.flyTo(to, zoom ?? map.getZoom(), { duration: 0.6 });
    }, [to?.[0], to?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}

function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
    useMapEvents({
        click: (e) => onMapClick?.(e.latlng.lat, e.latlng.lng),
    });
    return null;
}

export function LeafletMap({
    center,
    zoom = 12,
    markers = [],
    height = '420px',
    recenterTo,
    recenterZoom,
    onMarkerClick,
    onViewportChange,
    draggableMarker,
    onMarkerDrag,
    onMapClick,
    cluster = false,
    className,
    ariaLabel,
}: LeafletMapProps) {
    const renderedMarkers = useMemo(() => markers, [markers]);
    const useCluster = cluster && !draggableMarker;

    return (
        <div className={className} style={{ height, width: '100%' }} role="region" aria-label={ariaLabel}>
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%', borderRadius: '12px' }}
                scrollWheelZoom
            >
                <TileLayer
                    // OSM usage policy requires attribution to be visible.
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                />
                <ViewportWatcher onViewportChange={onViewportChange} />
                <Recenter to={recenterTo} zoom={recenterZoom} />
                {onMapClick && <ClickHandler onMapClick={onMapClick} />}

                {useCluster ? (
                    <ClusterLayer markers={renderedMarkers} onMarkerClick={onMarkerClick} />
                ) : (
                    renderedMarkers.map((m) => (
                        <Marker
                            key={m.id}
                            position={[m.lat, m.lng]}
                            icon={m.primary ? primaryIcon : undefined}
                            eventHandlers={{ click: () => onMarkerClick?.(m.id) }}
                        >
                            {m.popup && <Popup>{m.popup}</Popup>}
                        </Marker>
                    ))
                )}

                {draggableMarker && (
                    <Marker
                        draggable
                        position={[draggableMarker.lat, draggableMarker.lng]}
                        icon={primaryIcon}
                        eventHandlers={{
                            dragend: (e) => {
                                const ll = (e.target as L.Marker).getLatLng();
                                onMarkerDrag?.(ll.lat, ll.lng);
                            },
                        }}
                    />
                )}
            </MapContainer>
        </div>
    );
}

export default LeafletMap;
