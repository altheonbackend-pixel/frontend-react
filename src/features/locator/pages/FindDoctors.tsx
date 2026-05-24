import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import LeafletMap, { type MapBounds, type MapMarker } from '../../../shared/components/map/LeafletMap';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { toast } from '../../../shared/components/ui/toast';
import api from '../../../shared/services/api';
import { useAuth } from '../../auth/hooks/useAuth';
import { patientPortalService } from '../../patient-portal/services/patientPortalService';
import { locatorService } from '../services/locatorService';
import type { DoctorSearchResult } from '../types';
import { openDirections } from '../../../shared/utils/directions';
import './FindDoctors.css';

const DEFAULT_CENTER: [number, number] = [46.6, 2.5]; // Western Europe overview
const DEFAULT_ZOOM = 5;
const RADII = [5, 10, 25, 50, 100, 250];

interface Specialty { value: string; label: string; }

function initials(name: string) {
    return name.replace(/^Dr\.?\s*/i, '').split(' ').filter(Boolean).slice(0, 2)
        .map(s => s[0]).join('').toUpperCase() || 'Dr';
}

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
    const { isAuthenticated, userType } = useAuth();

    // Search origin used for distance ranking (null = pure text search).
    const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
    const [radius, setRadius] = useState(25);
    // 'near_me' = location + radius + map (in-person). 'online' = global search
    // with no location filter, for booking video (telemedicine) consultations.
    const [searchMode, setSearchMode] = useState<'near_me' | 'online'>('near_me');
    const online = searchMode === 'online';
    const [specialty, setSpecialty] = useState('');
    const [placeQuery, setPlaceQuery] = useState('');
    const [recenterTo, setRecenterTo] = useState<[number, number] | null>(null);
    const [viewport, setViewport] = useState<MapBounds | null>(null);
    const [geoLoading, setGeoLoading] = useState(false);
    const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
    const debouncedViewport = useDebounced(viewport, 400);

    // ── Default the search to the patient's saved location (if any) ─────────
    const { data: savedSettings } = useQuery({
        queryKey: queryKeys.patientPortal.settings(),
        queryFn: patientPortalService.getSettings,
        enabled: isAuthenticated && userType === 'patient',
        staleTime: 5 * 60_000,
    });
    const appliedSaved = useRef(false);
    useEffect(() => {
        if (appliedSaved.current || origin) return;
        if (savedSettings?.latitude != null && savedSettings?.longitude != null) {
            appliedSaved.current = true;
            const lat = Number(savedSettings.latitude);
            const lng = Number(savedSettings.longitude);
            setOrigin({ lat, lng });
            setRecenterTo([lat, lng]);
        }
    }, [savedSettings, origin]);

    // ── List results ────────────────────────────────────────────────────────
    // Online mode: no location params → backend returns ALL doctors (global).
    // Near-me mode: distance search when origin set, else text search.
    const listParams = useMemo(() => (
        online
            ? { specialty: specialty || undefined }
            : {
                lat: origin?.lat,
                lng: origin?.lng,
                radius_km: origin ? radius : undefined,
                specialty: specialty || undefined,
            }
    ), [online, origin, radius, specialty]);

    const { data: listData, isLoading: listLoading, isError: listError } = useQuery({
        queryKey: queryKeys.locator.search(listParams),
        queryFn: () => locatorService.searchDoctors(listParams),
        staleTime: 60_000,
    });

    // ── Map pins for the current viewport ──────────────────────────────────
    const { data: pinData } = useQuery({
        queryKey: queryKeys.locator.mapPins({ ...debouncedViewport, specialty }),
        queryFn: () => locatorService.getMapPins({
            north: debouncedViewport!.north,
            south: debouncedViewport!.south,
            east: debouncedViewport!.east,
            west: debouncedViewport!.west,
            specialty: specialty || undefined,
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
        // Carry the video intent so the profile defaults the booking to telemedicine.
        navigate(`/find-doctors/${d.id}${online ? '?type=video' : ''}`);
    }, [navigate, online]);

    const results = listData?.results ?? [];

    return (
        <div className="locator">
            <header className="locator__header">
                <h1 className="locator__title">{t('findDoctors.title')}</h1>
                <p className="locator__subtitle">{t('findDoctors.subtitle')}</p>
            </header>

            {/* Mode: near me (in-person, map) vs online (global, video consult) */}
            <div className="locator__mode" role="tablist" aria-label={t('findDoctors.mode.label')}>
                <button
                    type="button"
                    role="tab"
                    aria-selected={!online}
                    className={!online ? 'is-active' : ''}
                    onClick={() => setSearchMode('near_me')}
                >
                    📍 {t('findDoctors.mode.nearMe')}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={online}
                    className={online ? 'is-active' : ''}
                    onClick={() => setSearchMode('online')}
                >
                    📹 {t('findDoctors.mode.online')}
                </button>
            </div>

            {online && (
                <div className="locator__online-note">
                    {t('findDoctors.mode.onlineNote')}
                </div>
            )}

            <div className="locator__toolbar">
                {!online && (
                    <form className="locator__search" onSubmit={searchPlace}>
                        <div className="locator__search-input">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" strokeLinecap="round" />
                            </svg>
                            <input
                                type="text"
                                value={placeQuery}
                                onChange={(e) => setPlaceQuery(e.target.value)}
                                placeholder={t('findDoctors.placePlaceholder')}
                                aria-label={t('findDoctors.placePlaceholder')}
                            />
                        </div>
                        <button type="submit" className="btn btn-secondary btn-sm">{t('findDoctors.search')}</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={useMyLocation} disabled={geoLoading}>
                            {geoLoading ? t('findDoctors.locating') : t('findDoctors.useMyLocation')}
                        </button>
                    </form>
                )}

                <div className="locator__filters">
                    <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} aria-label={t('findDoctors.specialty')}>
                        <option value="">{t('findDoctors.allSpecialties')}</option>
                        {specialties?.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>

                    {!online && (
                        <select
                            value={radius}
                            onChange={(e) => setRadius(Number(e.target.value))}
                            disabled={!origin}
                            aria-label={t('findDoctors.radius')}
                        >
                            {RADII.map(r => <option key={r} value={r}>{t('findDoctors.withinKm', { km: r })}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {!online && (
                <div className="locator__view-toggle" role="tablist">
                    <button type="button" className={mobileView === 'list' ? 'is-active' : ''} onClick={() => setMobileView('list')}>
                        {t('findDoctors.showList')}
                    </button>
                    <button type="button" className={mobileView === 'map' ? 'is-active' : ''} onClick={() => setMobileView('map')}>
                        {t('findDoctors.showMap')}
                    </button>
                </div>
            )}

            <div className="locator__body" data-mobile-view={online ? 'list' : mobileView} data-online={online ? 'true' : undefined}>
                <div className="locator__list">
                    <div className="locator__count">
                        {listLoading ? t('findDoctors.loading') : t('findDoctors.resultCount', { count: listData?.count ?? 0 })}
                    </div>

                    {listError && <div className="error-message">{t('findDoctors.loadError')}</div>}

                    {listLoading && [0, 1, 2, 3].map(i => <div key={i} className="locator__loading-card" />)}

                    {!listLoading && !listError && results.length === 0 && (
                        <div className="locator__empty">
                            <p>{t('findDoctors.empty')}</p>
                            {!online && origin && radius < RADII[RADII.length - 1] && (
                                <button className="btn btn-secondary btn-sm" onClick={() => setRadius(RADII[RADII.length - 1])}>
                                    {t('findDoctors.expandRadius')}
                                </button>
                            )}
                        </div>
                    )}

                    {results.map(d => {
                        const loc = d.nearest_location;
                        const canRoute = !!loc && ((loc.latitude != null && loc.longitude != null) || !!loc.full_address);
                        return (
                            <div
                                key={d.id}
                                className="doc-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => goToDoctor(d)}
                                onKeyDown={(e) => { if (e.key === 'Enter') goToDoctor(d); }}
                            >
                                <div className="doc-card__avatar" aria-hidden="true">
                                    {d.avatar_url
                                        ? <img src={d.avatar_url} alt="" className="doc-card__avatar-img" />
                                        : initials(d.full_name)}
                                </div>
                                <div className="doc-card__body">
                                    <p className="doc-card__name">{d.full_name}</p>
                                    <div className="doc-card__meta">
                                        <span className="doc-card__pill">{d.specialty_display}</span>
                                        {online && (
                                            <span className="doc-card__pill doc-card__pill--video">📹 {t('findDoctors.mode.videoBadge')}</span>
                                        )}
                                        {d.distance_km != null && (
                                            <span className="doc-card__distance">{t('findDoctors.kmAway', { km: d.distance_km })}</span>
                                        )}
                                    </div>
                                    {loc && (
                                        <div className="doc-card__address">
                                            <span aria-hidden="true">📍</span>
                                            <span>{loc.full_address}</span>
                                        </div>
                                    )}
                                    {canRoute && (
                                        <div className="doc-card__actions">
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openDirections({
                                                        lat: loc!.latitude,
                                                        lng: loc!.longitude,
                                                        address: loc!.full_address,
                                                        label: d.full_name,
                                                    });
                                                }}
                                            >
                                                {t('findDoctors.getDirections')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {!online && (
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
                )}
            </div>
        </div>
    );
}
