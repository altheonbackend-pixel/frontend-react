import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import LeafletMap from '../../../../shared/components/map/LeafletMap';
import { toast, parseApiError, Dialog } from '../../../../shared/components/ui';
import { Switch } from '../../../../shared/components/Switch';
import { queryKeys } from '../../../../shared/queryKeys';
import { locatorService } from '../../../locator/services/locatorService';
import type { PracticeLocation } from '../../../locator/types';

type Draft = Partial<PracticeLocation>;

const EMPTY: Draft = {
    label: '', address_line1: '', address_line2: '', city: '', state: '',
    postal_code: '', country: '', phone: '', latitude: null, longitude: null,
    is_visible: true, accepts_in_person: true,
};

export default function LocationsSection() {
    const { t } = useTranslation();
    const qc = useQueryClient();

    const { data: locations = [], isLoading } = useQuery({
        queryKey: queryKeys.locator.myLocations(),
        queryFn: () => locatorService.listMyLocations(),
    });

    const [editing, setEditing] = useState<Draft | null>(null);
    const [geocoding, setGeocoding] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<PracticeLocation | null>(null);

    const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.locator.myLocations() });

    const saveMutation = useMutation({
        mutationFn: (d: Draft) =>
            d.id ? locatorService.updateLocation(d.id, d) : locatorService.createLocation(d),
        onSuccess: () => {
            toast.success(t('doctorLocations.saved'));
            setEditing(null);
            invalidate();
        },
        onError: (err) => toast.error(parseApiError(err, t('doctorLocations.saveError'))),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => locatorService.deleteLocation(id),
        onSuccess: () => { toast.success(t('doctorLocations.deleted')); setConfirmDelete(null); invalidate(); },
        onError: (err) => toast.error(parseApiError(err, t('doctorLocations.deleteError'))),
    });

    const primaryMutation = useMutation({
        mutationFn: (id: number) => locatorService.setPrimaryLocation(id),
        onSuccess: () => { toast.success(t('doctorLocations.primarySet')); invalidate(); },
        onError: (err) => toast.error(parseApiError(err, t('doctorLocations.saveError'))),
    });

    async function findOnMap() {
        if (!editing) return;
        const query = [editing.address_line1, editing.city, editing.state, editing.postal_code, editing.country]
            .filter(Boolean).join(', ');
        if (!query.trim()) { toast.error(t('doctorLocations.enterAddress')); return; }
        setGeocoding(true);
        try {
            const results = await locatorService.geocodeForDoctor(query);
            if (!results.length) { toast.error(t('doctorLocations.notFound')); return; }
            const top = results[0];
            setEditing({ ...editing, latitude: top.latitude, longitude: top.longitude });
            toast.success(t('doctorLocations.pinPlaced'));
        } catch (err) {
            toast.error(parseApiError(err, t('doctorLocations.geocodeError')));
        } finally {
            setGeocoding(false);
        }
    }

    function save() {
        if (!editing) return;
        if (!editing.address_line1?.trim() || !editing.city?.trim() || !editing.country?.trim()) {
            toast.error(t('doctorLocations.requiredFields'));
            return;
        }
        saveMutation.mutate(editing);
    }

    const hasCoords = editing?.latitude != null && editing?.longitude != null;
    const ungeocoded = locations.filter(l => !l.has_coords);

    return (
        <div className="settings-card">
            <div className="settings-card-head">
                <h2 className="settings-card-title">{t('doctorLocations.title')}</h2>
                <p className="settings-card-subtitle">{t('doctorLocations.subtitle')}</p>
            </div>

            <div className="settings-card-body">
                {isLoading && <p>{t('common.loading', 'Loading…')}</p>}

                {!editing && (
                    <>
                        {locations.length === 0 && !isLoading && (
                            <p style={{ color: 'var(--text-muted)' }}>{t('doctorLocations.empty')}</p>
                        )}

                        {/* Reminder: locations without a map pin never appear in patient search. */}
                        {ungeocoded.length > 0 && (
                            <div
                                role="alert"
                                style={{
                                    marginBottom: '0.75rem', padding: '0.625rem 0.875rem',
                                    borderRadius: '8px', fontSize: '0.85rem',
                                    background: 'var(--warning-bg, #fef3c7)',
                                    color: 'var(--warning-text, #92400e)',
                                    border: '1px solid var(--warning-border, #fde68a)',
                                }}
                            >
                                ⚠️ {t('doctorLocations.ungeocodedReminder', { count: ungeocoded.length })}
                            </div>
                        )}
                        <div style={{ display: 'grid', gap: '0.625rem' }}>
                            {locations.map(loc => (
                                <div key={loc.id} className="doc-card" style={{ cursor: 'default' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <div>
                                            <p className="doc-card__name">
                                                {loc.label || loc.city}
                                                {loc.is_primary && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: 'var(--brand)' }}>★ {t('doctorLocations.primary')}</span>}
                                                {!loc.is_visible && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('doctorLocations.hidden')}</span>}
                                                {!loc.has_coords && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: 'var(--danger, #dc2626)' }}>{t('doctorLocations.noPin')}</span>}
                                            </p>
                                            <div className="doc-card__address">{loc.full_address}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                            {!loc.is_primary && (
                                                <button className="btn btn-secondary btn-sm" onClick={() => primaryMutation.mutate(loc.id)}>
                                                    {t('doctorLocations.makePrimary')}
                                                </button>
                                            )}
                                            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(loc)}>
                                                {t('common.edit', 'Edit')}
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(loc)}>
                                                {t('common.delete', 'Delete')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...EMPTY })}>
                                + {t('doctorLocations.addLocation')}
                            </button>
                        </div>
                    </>
                )}

                {editing && (
                    <div style={{ display: 'grid', gap: '0.875rem' }}>
                        <div className="form-group">
                            <label>{t('doctorLocations.label')}</label>
                            <input className="input" value={editing.label ?? ''} onChange={e => setEditing({ ...editing, label: e.target.value })} placeholder={t('doctorLocations.labelPlaceholder')} />
                        </div>
                        <div className="form-group">
                            <label>{t('doctorLocations.address1')} *</label>
                            <input className="input" value={editing.address_line1 ?? ''} onChange={e => setEditing({ ...editing, address_line1: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>{t('doctorLocations.address2')}</label>
                            <input className="input" value={editing.address_line2 ?? ''} onChange={e => setEditing({ ...editing, address_line2: e.target.value })} />
                        </div>
                        <div className="settings-grid-2">
                            <div className="form-group">
                                <label>{t('doctorLocations.city')} *</label>
                                <input className="input" value={editing.city ?? ''} onChange={e => setEditing({ ...editing, city: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{t('doctorLocations.state')}</label>
                                <input className="input" value={editing.state ?? ''} onChange={e => setEditing({ ...editing, state: e.target.value })} />
                            </div>
                        </div>
                        <div className="settings-grid-2">
                            <div className="form-group">
                                <label>{t('doctorLocations.postalCode')}</label>
                                <input className="input" value={editing.postal_code ?? ''} onChange={e => setEditing({ ...editing, postal_code: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{t('doctorLocations.country')} *</label>
                                <input className="input" value={editing.country ?? ''} onChange={e => setEditing({ ...editing, country: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>{t('doctorLocations.phone')}</label>
                            <input className="input" value={editing.phone ?? ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={findOnMap} disabled={geocoding}>
                                {geocoding ? t('doctorLocations.locating') : t('doctorLocations.findOnMap')}
                            </button>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {hasCoords ? t('doctorLocations.dragHint') : t('doctorLocations.geocodeHint')}
                            </span>
                        </div>

                        <LeafletMap
                            center={hasCoords ? [editing.latitude as number, editing.longitude as number] : [20, 0]}
                            zoom={hasCoords ? 15 : 2}
                            recenterTo={hasCoords ? [editing.latitude as number, editing.longitude as number] : null}
                            recenterZoom={15}
                            draggableMarker={hasCoords ? { lat: editing.latitude as number, lng: editing.longitude as number } : null}
                            onMarkerDrag={(lat, lng) => setEditing({ ...editing, latitude: lat, longitude: lng })}
                            onMapClick={(lat, lng) => setEditing({ ...editing, latitude: lat, longitude: lng })}
                            height="320px"
                            ariaLabel={t('doctorLocations.mapLabel')}
                        />

                        <div className="settings-toggle-row">
                            <div>
                                <div className="settings-toggle-text-title">{t('doctorLocations.visible')}</div>
                                <div className="settings-toggle-text-sub">{t('doctorLocations.visibleHint')}</div>
                            </div>
                            <Switch checked={editing.is_visible ?? true} onChange={(v) => setEditing({ ...editing, is_visible: v })} label={t('doctorLocations.visible')} />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary btn-sm" disabled={saveMutation.isPending} onClick={save}>
                                {saveMutation.isPending ? t('common.saving') : t('settings.save_changes')}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <Dialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                title={t('doctorLocations.deleteTitle')}
                tone="danger"
                confirmLabel={t('common.delete', 'Delete')}
                onConfirm={() => { if (confirmDelete) deleteMutation.mutate(confirmDelete.id); }}
                message={t('doctorLocations.deleteConfirm', { name: confirmDelete?.label || confirmDelete?.city })}
            />
        </div>
    );
}
