import { useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import LeafletMap, { type MapMarker } from '../../../shared/components/map/LeafletMap';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { useAuth } from '../../auth/hooks/useAuth';
import RequestAppointmentModal from '../../patient-portal/components/RequestAppointmentModal';
import { locatorService } from '../services/locatorService';
import { openDirections } from '../../../shared/utils/directions';
import './FindDoctors.css';

function initials(name: string) {
    return name.replace(/^Dr\.?\s*/i, '').split(' ').filter(Boolean).slice(0, 2)
        .map(s => s[0]).join('').toUpperCase() || 'Dr';
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
        <div className="docprofile__info-row">
            <div className="docprofile__info-label">{label}</div>
            <div className="docprofile__info-value">{value}</div>
        </div>
    );
}

export default function DoctorPublicProfile() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const doctorId = Number(id);
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, userType } = useAuth();

    const { data: doctor, isLoading, isError } = useQuery({
        queryKey: queryKeys.locator.publicProfile(doctorId),
        queryFn: () => locatorService.getPublicProfile(doctorId),
        enabled: !!doctorId,
        staleTime: 5 * 60_000,
    });

    usePageTitle(doctor?.full_name ?? t('findDoctors.profile.title'));

    const [bookingOpen, setBookingOpen] = useState(false);
    // Arriving from the "Online consultation" search (?type=video) pre-selects
    // a telemedicine visit in the booking modal.
    const bookingType: 'in_person' | 'telemedicine' =
        new URLSearchParams(location.search).get('type') === 'video' ? 'telemedicine' : 'in_person';

    const markers: MapMarker[] = useMemo(() => (doctor?.locations ?? [])
        .filter(l => l.latitude != null && l.longitude != null)
        .map(l => ({
            id: l.id,
            lat: l.latitude as number,
            lng: l.longitude as number,
            primary: l.is_primary,
            popup: <div className="map-popup__name">{l.label || l.full_address}</div>,
        })), [doctor]);

    const center: [number, number] | null = markers.length
        ? [markers[0].lat, markers[0].lng]
        : null;

    function onBookClick() {
        if (isAuthenticated && userType === 'patient') {
            setBookingOpen(true);
        } else {
            navigate(`/patient/login?next=${encodeURIComponent(location.pathname)}`);
        }
    }

    if (isLoading) {
        return (
            <div className="locator">
                <div className="locator__loading-card" style={{ height: 110 }} />
                <div className="locator__loading-card" style={{ height: 220 }} />
            </div>
        );
    }
    if (isError || !doctor) {
        return (
            <div className="locator">
                <div className="error-message">{t('findDoctors.profile.notFound')}</div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/find-doctors')}>
                    {t('findDoctors.backToSearch')}
                </button>
            </div>
        );
    }

    return (
        <div className="locator docprofile">
            <button className="btn btn-secondary btn-sm docprofile__back" onClick={() => navigate('/find-doctors')}>
                ← {t('findDoctors.backToSearch')}
            </button>

            {/* ── Hero ── */}
            <section className="docprofile__hero">
                <div className="docprofile__avatar" aria-hidden="true">
                    {doctor.avatar_url
                        ? <img src={doctor.avatar_url} alt="" className="docprofile__avatar-img" />
                        : initials(doctor.full_name)}
                </div>
                <div className="docprofile__hero-body">
                    <h1 className="docprofile__name">{doctor.full_name}</h1>
                    <p className="docprofile__specialty">{doctor.specialty_display}</p>
                    <div className="docprofile__badges">
                        {doctor.languages?.length > 0 && (
                            <span className="doc-card__pill">{doctor.languages.join(' · ').toUpperCase()}</span>
                        )}
                        {doctor.consultation_fee && (
                            <span className="doc-card__pill">
                                {doctor.consultation_fee} {doctor.currency ?? ''}
                            </span>
                        )}
                    </div>
                </div>
            </section>

            {/* ── 2-column grid: info+locations | sticky CTA ── */}
            <div className="docprofile__grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="docprofile__card">
                        <h2>{t('findDoctors.profile.about')}</h2>
                        {doctor.consultation_fee && (
                            <InfoRow label={t('findDoctors.profile.fee')} value={`${doctor.consultation_fee} ${doctor.currency ?? ''}`} />
                        )}
                        {doctor.languages?.length > 0 && (
                            <InfoRow label={t('findDoctors.profile.languages')} value={doctor.languages.join(', ').toUpperCase()} />
                        )}
                        <InfoRow label={t('findDoctors.profile.timezone')} value={doctor.timezone} />
                    </div>

                    <div className="docprofile__card">
                        <h2>{t('findDoctors.profile.locations')}</h2>
                        {doctor.locations.length === 0 && (
                            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{t('findDoctors.profile.noLocations')}</p>
                        )}
                        {doctor.locations.map(l => {
                            const canRoute = (l.latitude != null && l.longitude != null) || !!l.full_address;
                            return (
                                <div key={l.id} className="docprofile__loc">
                                    <p className="docprofile__loc-name">
                                        {l.label || l.city}
                                        {l.is_primary && <span className="docprofile__star">★ {t('findDoctors.profile.primary')}</span>}
                                    </p>
                                    <div className="docprofile__loc-addr">{l.full_address}</div>
                                    {l.phone && <div className="docprofile__loc-phone">📞 {l.phone}</div>}
                                    {canRoute && (
                                        <div className="doc-card__actions" style={{ marginTop: '0.5rem' }}>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-xs"
                                                onClick={() => openDirections({
                                                    lat: l.latitude,
                                                    lng: l.longitude,
                                                    address: l.full_address,
                                                    label: l.label || doctor.full_name,
                                                })}
                                            >
                                                {t('findDoctors.getDirections')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {center && (
                        <div className="docprofile__map">
                            <LeafletMap center={center} zoom={13} markers={markers} height="360px" ariaLabel={t('findDoctors.mapLabel')} />
                        </div>
                    )}
                </div>

                <aside className="docprofile__card docprofile__cta-card" aria-label={t('findDoctors.booking.title')}>
                    <h2>{t('findDoctors.booking.title')}</h2>
                    <button className="btn btn-primary" onClick={onBookClick}>
                        {t('findDoctors.booking.cta')}
                    </button>
                    <p className="docprofile__cta-hint">
                        {isAuthenticated && userType === 'patient'
                            ? t('findDoctors.booking.hintLoggedIn')
                            : t('findDoctors.booking.hintAnon')}
                    </p>
                </aside>
            </div>

            <RequestAppointmentModal
                open={bookingOpen}
                onClose={() => setBookingOpen(false)}
                lockedDoctorId={doctorId}
                lockedDoctorName={doctor.full_name}
                defaultAppointmentType={bookingType}
            />
        </div>
    );
}
