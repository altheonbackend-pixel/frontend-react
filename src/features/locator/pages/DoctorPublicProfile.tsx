import { useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import LeafletMap, { type MapMarker } from '../../../shared/components/map/LeafletMap';
import { Modal, toast, parseApiError } from '../../../shared/components/ui';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { queryKeys } from '../../../shared/queryKeys';
import { useAuth } from '../../auth/hooks/useAuth';
import { patientPortalService } from '../../patient-portal/services/patientPortalService';
import { locatorService } from '../services/locatorService';
import './FindDoctors.css';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
            <div style={{ color: 'var(--text-primary)' }}>{value}</div>
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
    const [apptDate, setApptDate] = useState('');
    const [reason, setReason] = useState('');
    const [apptType, setApptType] = useState('in_person');

    const bookMutation = useMutation({
        mutationFn: () => patientPortalService.requestAppointment({
            doctor_id: doctorId,
            appointment_date: new Date(apptDate).toISOString(),
            reason: reason.trim(),
            appointment_type: apptType,
        }),
        onSuccess: () => {
            toast.success(t('findDoctors.booking.success'));
            setBookingOpen(false);
            navigate('/patient/appointments');
        },
        onError: (err) => toast.error(parseApiError(err, t('findDoctors.booking.error'))),
    });

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
            // Round-trip back to this profile after sign-in.
            navigate(`/patient/login?next=${encodeURIComponent(location.pathname)}`);
        }
    }

    if (isLoading) {
        return <div className="locator"><p>{t('findDoctors.loading')}</p></div>;
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
        <div className="locator">
            <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/find-doctors')}>
                ← {t('findDoctors.backToSearch')}
            </button>

            <div style={{ display: 'grid', gap: '1.25rem' }}>
                <div>
                    <h1 style={{ margin: '0 0 0.25rem' }}>{doctor.full_name}</h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.05rem' }}>{doctor.specialty_display}</p>
                </div>

                <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={onBookClick}>
                    {t('findDoctors.booking.cta')}
                </button>

                <div>
                    <InfoRow label={t('findDoctors.profile.acceptingNew')} value={doctor.accepting_referrals ? t('common.yes', 'Yes') : t('common.no', 'No')} />
                    {doctor.consultation_fee && (
                        <InfoRow label={t('findDoctors.profile.fee')} value={`${doctor.consultation_fee} ${doctor.currency ?? ''}`} />
                    )}
                    {doctor.languages?.length > 0 && (
                        <InfoRow label={t('findDoctors.profile.languages')} value={doctor.languages.join(', ').toUpperCase()} />
                    )}
                </div>

                <div>
                    <h2 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>{t('findDoctors.profile.locations')}</h2>
                    {doctor.locations.length === 0 && <p style={{ color: 'var(--text-muted)' }}>{t('findDoctors.profile.noLocations')}</p>}
                    {doctor.locations.map(l => (
                        <div key={l.id} className="doc-card" style={{ cursor: 'default', marginBottom: '0.5rem' }}>
                            <p className="doc-card__name">
                                {l.label || l.city}
                                {l.is_primary && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: 'var(--brand)' }}>★ {t('findDoctors.profile.primary')}</span>}
                            </p>
                            <div className="doc-card__address">{l.full_address}</div>
                            {l.phone && <div className="doc-card__meta"><span>{l.phone}</span></div>}
                        </div>
                    ))}
                </div>

                {center && (
                    <LeafletMap center={center} zoom={13} markers={markers} height="360px" ariaLabel={t('findDoctors.mapLabel')} />
                )}
            </div>

            <Modal
                open={bookingOpen}
                onClose={() => setBookingOpen(false)}
                title={t('findDoctors.booking.title')}
                dirty={!!apptDate || !!reason}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setBookingOpen(false)}>{t('common.cancel', 'Cancel')}</button>
                        <button
                            className="btn btn-primary"
                            disabled={!apptDate || !reason.trim() || bookMutation.isPending}
                            onClick={() => bookMutation.mutate()}
                        >
                            {bookMutation.isPending ? t('findDoctors.booking.submitting') : t('findDoctors.booking.submit')}
                        </button>
                    </>
                }
            >
                <div style={{ display: 'grid', gap: '0.875rem' }}>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('findDoctors.booking.dateLabel')}</span>
                        <input
                            type="datetime-local"
                            value={apptDate}
                            min={new Date().toISOString().slice(0, 16)}
                            onChange={(e) => setApptDate(e.target.value)}
                            style={{ padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: 8 }}
                        />
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('findDoctors.booking.typeLabel')}</span>
                        <select value={apptType} onChange={(e) => setApptType(e.target.value)} style={{ padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: 8 }}>
                            <option value="in_person">{t('findDoctors.booking.inPerson')}</option>
                            <option value="telemedicine">{t('findDoctors.booking.telemedicine')}</option>
                        </select>
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('findDoctors.booking.reasonLabel')}</span>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            placeholder={t('findDoctors.booking.reasonPlaceholder')}
                            style={{ padding: '0.5rem', border: '1px solid var(--border-light)', borderRadius: 8, resize: 'vertical' }}
                        />
                    </label>
                </div>
            </Modal>
        </div>
    );
}
