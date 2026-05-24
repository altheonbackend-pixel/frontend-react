import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import LeafletMap, { type MapBounds, type MapMarker } from '../../../shared/components/map/LeafletMap';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { toast } from '../../../shared/components/ui/toast';
import api from '../../../shared/services/api';
import { locatorService } from '../services/locatorService';
import type { DoctorSearchResult } from '../types';
import './FindDoctors.css';

const DEFAULT_CENTER: [number, number] = [46.6, 2.5]; // Western Europe overview
const DEFAULT_ZOOM = 5;
const RADII = [5, 10, 25, 50, 100, 250];

interface Specialty { value: string; label: string; }

/** Tiny inline debounce — avoids a new shared dependency for one screen. */
function useDebounced<T>(value: T, ms: number): T {
    const [v, setV] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setV(value), ms);
        return () => clearTimeout(id);
    }, [value, ms]);
    return v;
}

export default function FindDoctors() {
    const { t } = useTranslation();
    usePageTitle(t('findDoctors.title'));
    const navigate = useNavigate();

    // Search origin used for distance ranking (null = pure text search).
    const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
    const [radius, setRadius] = useState(25);
    const [specialty, setSpecialty] = useState('');
    const [acceptingNew, setAcceptingNew] = useState(false);
    const [placeQuery, setPlaceQuery] = useState('');
    const [recenterTo, setRecenterTo] = useState<[number, number] | null>(null);
    const [viewport, setViewport] = useState<MapBounds | null>(null);
    const [geoLoading, setGeoLoading] = useState(false);
    const debouncedViewport = useDebounced(viewport, 400);

    // ── List results (distance search when origin set, else text search) ────
    const listParams = useMemo(() => ({
        lat: origin?.lat,
        lng: origin?.lng,
        radius_km: origin ? radius : undefined,
        specialty: specialty || undefined,
        accepting_new: acceptingNew || undefined,
    }), [origin, radius, specialty, acceptingNew]);

    const { data: listData, isLoading: listLoading, isError: listError } = useQuery({
        queryKey: queryKeys.locator.search(listParams),
        queryFn: () => locatorService.searchDoctors(listParams),
        staleTime: 60_000,
    });

    // ── Map pins for the current viewport ──────────────────────────────────
    const { data: pinData } = useQuery({
        queryKey: queryKeys.locator.mapPins({
            ...debouncedViewport, specialty, acceptingNew,
        }),
        queryFn: () => locatorService.getMapPins({
            north: debouncedViewport!.north,
            south: debouncedViewport!.south,
            east: debouncedViewport!.east,
            west: debouncedViewport!.west,
            specialty: specialty || undefined,
            accepting_new: acceptingNew || undefined,
        }),
        enabled: !!debouncedViewport,
        staleTime: 30_000,
    });

    // ── Specialty options ──────────────────────────────────────────────────
    const { data: specialties } = useQuery({
        queryKey: ['locator', 'specialties'],
        queryFn: () => api.get<Specialty[]>('/specialties/').then(r => r.data),
        staleTime: 60 * 60_000,
    });

    const markers: MapMarker[] = useMemo(() => (pinData?.results ?? []).map(p => ({
        id: p.location_id,
        lat: p.latitude,
        lng: p.longitude,
        primary: p.is_primary,
        // Cluster mode builds popups imperatively from these fields.
        title: p.full_name,
        subtitle: p.specialty_display,
        viewLabel: t('findDoctors.viewProfile'),
        onView: () => navigate(`/find-doctors/${p.doctor_id}`),
    })), [pinData, navigate, t]);

    // ── Actions ────────────────────────────────────────────────────────────
    const useMyLocation = useCallback(() => {
        if (!('geolocation' in navigator)) {
            toast.error(t('findDoctors.geoUnsupported'));
            return;
        }
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setOrigin({ lat: latitude, lng: longitude });
                setRecenterTo([latitude, longitude]);
                setGeoLoading(false);
            },
            () => {
                setGeoLoading(false);
                toast.error(t('findDoctors.geoDenied'));
            },
            { timeout: 10_000 },
        );
    }, [t]);

    const searchPlace = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        const q = placeQuery.trim();
        if (!q) return;
        try {
            const results = await locatorService.geocode(q);
            if (!results.length) {
                toast.error(t('findDoctors.placeNotFound'));
                return;
            }
            const top = results[0];
            setOrigin({ lat: top.latitude, lng: top.longitude });
            setRecenterTo([top.latitude, top.longitude]);
        } catch {
            toast.error(t('findDoctors.geocodeError'));
        }
    }, [placeQuery, t]);

    const goToDoctor = useCallback((d: DoctorSearchResult) => {
        if (d.nearest_location?.latitude != null && d.nearest_location?.longitude != null) {
            setRecenterTo([d.nearest_location.latitude, d.nearest_location.longitude]);
        }
        navigate(`/find-doctors/${d.id}`);
    }, [navigate]);

    const results = listData?.results ?? [];

    return (
        <div className="locator">
            <h1 style={{ margin: 0 }}>{t('findDoctors.title')}</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t('findDoctors.subtitle')}</p>

            <div className="locator__toolbar">
                <form className="locator__search" onSubmit={searchPlace}>
                    <input
                        type="text"
                        value={placeQuery}
                        onChange={(e) => setPlaceQuery(e.target.value)}
                        placeholder={t('findDoctors.placePlaceholder')}
                        aria-label={t('findDoctors.placePlaceholder')}
                    />
                    <button type="submit" className="btn btn-secondary btn-sm">{t('findDoctors.search')}</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={useMyLocation} disabled={geoLoading}>
                        {geoLoading ? t('findDoctors.locating') : t('findDoctors.useMyLocation')}
                    </button>
                </form>

                <div className="locator__filters">
                    <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} aria-label={t('findDoctors.specialty')}>
                        <option value="">{t('findDoctors.allSpecialties')}</option>
                        {specialties?.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>

                    <select
                        value={radius}
                        onChange={(e) => setRadius(Number(e.target.value))}
                        disabled={!origin}
                        aria-label={t('findDoctors.radius')}
                    >
                        {RADII.map(r => <option key={r} value={r}>{t('findDoctors.withinKm', { km: r })}</option>)}
                    </select>

                    <label className="locator__checkbox">
                        <input
                            type="checkbox"
                            checked={acceptingNew}
                            onChange={(e) => setAcceptingNew(e.target.checked)}
                        />
                        {t('findDoctors.acceptingNew')}
                    </label>
                </div>
            </div>

            <div className="locator__body">
                <div className="locator__list">
                    <div className="locator__count">
                        {listLoading
                            ? t('findDoctors.loading')
                            : t('findDoctors.resultCount', { count: listData?.count ?? 0 })}
                    </div>

                    {listError && <div className="error-message">{t('findDoctors.loadError')}</div>}

                    {!listLoading && !listError && results.length === 0 && (
                        <div className="locator__empty">
                            <p>{t('findDoctors.empty')}</p>
                            {origin && radius < RADII[RADII.length - 1] && (
                                <button className="btn btn-secondary btn-sm" onClick={() => setRadius(RADII[RADII.length - 1])}>
                                    {t('findDoctors.expandRadius')}
                                </button>
                            )}
                        </div>
                    )}

                    {results.map(d => (
                        <div
                            key={d.id}
                            className="doc-card"
                            role="button"
                            tabIndex={0}
                            onClick={() => goToDoctor(d)}
                            onKeyDown={(e) => { if (e.key === 'Enter') goToDoctor(d); }}
                        >
                            <p className="doc-card__name">{d.full_name}</p>
                            <div className="doc-card__meta">
                                <span>{d.specialty_display}</span>
                                {d.distance_km != null && (
                                    <span className="doc-card__distance">{t('findDoctors.kmAway', { km: d.distance_km })}</span>
                                )}
                                {d.accepting_referrals && <span>{t('findDoctors.acceptingBadge')}</span>}
                            </div>
                            {d.nearest_location && (
                                <div className="doc-card__address">{d.nearest_location.full_address}</div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="locator__map">
                    {pinData?.truncated && (
                        <div className="locator__banner">{t('findDoctors.zoomIn')}</div>
                    )}
                    <LeafletMap
                        center={DEFAULT_CENTER}
                        zoom={DEFAULT_ZOOM}
                        markers={markers}
                        cluster
                        recenterTo={recenterTo}
                        recenterZoom={12}
                        onViewportChange={(b) => setViewport(b)}
                        height="100%"
                        ariaLabel={t('findDoctors.mapLabel')}
                    />
                </div>
            </div>
        </div>
    );
}
