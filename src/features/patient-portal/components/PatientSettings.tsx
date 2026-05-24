import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { Switch } from '../../../shared/components/Switch';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast, parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService, type PatientPortalSettings, type ProfileUpdateRequest } from '../services/patientPortalService';
import { normalizePortalLanguage } from '../utils/i18n';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';
import { useAuth } from '../../auth/hooks/useAuth';
import LeafletMap from '../../../shared/components/map/LeafletMap';
import { locatorService } from '../../locator/services/locatorService';
import '../../../shared/styles/settings-ui.css';

const EDITABLE_FIELDS = [
    'phone_number',
    'email',
    'address',
    'emergency_contact_name',
    'emergency_contact_number',
] as const;

const NOTIFICATION_PREFS = [
    'email_notifications',
    'appointment_reminders',
    'lab_result_notifications',
    'visit_summary_notifications',
    'marketing_emails',
] as const;

const LANGUAGE_OPTIONS = [
    { value: 'en', labelKey: 'patient_portal.language.en' },
    { value: 'fr', labelKey: 'patient_portal.language.fr' },
];

const TIMEZONE_OPTIONS = [
    { value: 'UTC', labelKey: 'patient_portal.timezones.utc' },
    { value: 'Asia/Karachi', labelKey: 'patient_portal.timezones.asia_karachi' },
    { value: 'Asia/Kolkata', labelKey: 'patient_portal.timezones.asia_kolkata' },
    { value: 'Asia/Dhaka', labelKey: 'patient_portal.timezones.asia_dhaka' },
    { value: 'Asia/Dubai', labelKey: 'patient_portal.timezones.asia_dubai' },
    { value: 'Asia/Riyadh', labelKey: 'patient_portal.timezones.asia_riyadh' },
    { value: 'Asia/Baghdad', labelKey: 'patient_portal.timezones.asia_baghdad' },
    { value: 'Asia/Istanbul', labelKey: 'patient_portal.timezones.asia_istanbul' },
    { value: 'Europe/London', labelKey: 'patient_portal.timezones.europe_london' },
    { value: 'Europe/Paris', labelKey: 'patient_portal.timezones.europe_paris' },
    { value: 'Europe/Berlin', labelKey: 'patient_portal.timezones.europe_berlin' },
    { value: 'Africa/Cairo', labelKey: 'patient_portal.timezones.africa_cairo' },
    { value: 'Africa/Lagos', labelKey: 'patient_portal.timezones.africa_lagos' },
    { value: 'Africa/Nairobi', labelKey: 'patient_portal.timezones.africa_nairobi' },
    { value: 'America/New_York', labelKey: 'patient_portal.timezones.america_new_york' },
    { value: 'America/Chicago', labelKey: 'patient_portal.timezones.america_chicago' },
    { value: 'America/Los_Angeles', labelKey: 'patient_portal.timezones.america_los_angeles' },
    { value: 'Australia/Sydney', labelKey: 'patient_portal.timezones.australia_sydney' },
];

const STATUS_BADGE: Record<string, { labelKey: string; style: React.CSSProperties }> = {
    pending:  { labelKey: 'patient_portal.settings.update_status.pending', style: { background: 'var(--warning-subtle, #fff3cd)', color: 'var(--warning, #856404)' } },
    approved: { labelKey: 'patient_portal.settings.update_status.approved', style: { background: 'var(--success-subtle, #d1e7dd)', color: 'var(--success, #0a3622)' } },
    rejected: { labelKey: 'patient_portal.settings.update_status.rejected', style: { background: 'var(--danger-subtle, #f8d7da)',  color: 'var(--danger, #58151c)' } },
};

export type PatientSettingsSection = 'preferences' | 'location' | 'security' | 'notifications' | 'requests' | 'all';

export default function PatientSettings({ asTab = false, section = 'all' }: { asTab?: boolean; section?: PatientSettingsSection }) {
    const show = (s: PatientSettingsSection) => section === 'all' || section === s;
    const { t, i18n } = useTranslation();
    usePageTitle(t('patient_portal.settings.document_title'));
    const queryClient = useQueryClient();
    const { setPatientLanguage } = useAuth();
    const { formatDate } = useFormatDateTime();
    const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
    const [pwError, setPwError] = useState('');

    // ── Saved-location editor state (null draft = use the saved value) ─────────
    const [locDraft, setLocDraft] = useState<{ lat: number | null; lng: number | null; label: string } | null>(null);
    const [placeQuery, setPlaceQuery] = useState('');
    const [geocoding, setGeocoding] = useState(false);
    const [locating, setLocating] = useState(false);

    // ── Profile update request state ──────────────────────────────────────────
    const [updateFields, setUpdateFields] = useState<Record<string, string>>({});
    const [updateMessage, setUpdateMessage] = useState('');
    const [showUpdateForm, setShowUpdateForm] = useState(false);

    const { mutate: changePassword, isPending: isChangingPw } = useMutation({
        mutationFn: () => patientPortalService.changePassword(pwForm),
        onSuccess: () => {
            toast.success(t('patient_portal.settings.toast.password_changed'));
            setPwForm({ current_password: '', new_password: '', confirm_password: '' });
            setPwError('');
        },
        onError: (err) => setPwError(parseApiError(err, t('patient_portal.settings.error.change_password'))),
    });

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pwForm.new_password !== pwForm.confirm_password) {
            setPwError(t('patient_portal.auth.error.passwords_mismatch'));
            return;
        }
        if (pwForm.new_password.length < 8) {
            setPwError(t('patient_portal.auth.error.password_too_short'));
            return;
        }
        setPwError('');
        changePassword();
    };

    const { data: updateRequests = [] } = useQuery<ProfileUpdateRequest[]>({
        queryKey: queryKeys.patientPortal.profileUpdateRequests(),
        queryFn: patientPortalService.getProfileUpdateRequests,
        staleTime: 60_000,
    });

    const { mutate: submitRequest, isPending: isSubmitting } = useMutation({
        mutationFn: () => patientPortalService.submitProfileUpdateRequest({
            requested_fields: updateFields,
            message: updateMessage,
        }),
        onSuccess: () => {
            toast.success(t('patient_portal.settings.toast.update_request_submitted'));
            setShowUpdateForm(false);
            setUpdateFields({});
            setUpdateMessage('');
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.profileUpdateRequests() });
        },
        onError: (err) => toast.error(parseApiError(err, t('patient_portal.common.error.submit_request'))),
    });

    const hasPendingRequest = updateRequests.some(r => r.status === 'pending');

    const handleUpdateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const filled = Object.fromEntries(Object.entries(updateFields).filter(([, v]) => v.trim()));
        if (Object.keys(filled).length === 0) {
            toast.error(t('patient_portal.settings.error.no_update_fields'));
            return;
        }
        submitRequest();
    };

    const { data: settings, isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.settings(),
        queryFn: patientPortalService.getSettings,
        staleTime: 5 * 60_000,
    });

    const { mutate: save, isPending } = useMutation({
        mutationFn: (data: Partial<PatientPortalSettings>) => patientPortalService.updateSettings(data),
        onSuccess: (updated) => {
            const language = normalizePortalLanguage(updated.preferred_language);
            queryClient.setQueryData(queryKeys.patientPortal.settings(), updated);
            // Sync AuthContext FIRST so the session-restore effect in App.tsx
            // (which reconciles i18n against patientProfile.preferred_language)
            // doesn't read the stale login value and revert this switch.
            setPatientLanguage(language);
            if (language !== i18n.resolvedLanguage) {
                i18n.changeLanguage(language);
            }
            toast.success(t('patient_portal.settings.toast.preference_saved'));
        },
        onError: (err) => toast.error(parseApiError(err, t('patient_portal.settings.error.save_preference'))),
    });

    // Dedicated location mutation — avoids the language-sync + "preference saved"
    // toast that the generic `save` performs.
    const { mutate: persistLocation, isPending: isSavingLoc } = useMutation({
        mutationFn: (data: Partial<PatientPortalSettings>) => patientPortalService.updateSettings(data),
        onSuccess: (updated) => {
            queryClient.setQueryData(queryKeys.patientPortal.settings(), updated);
            setLocDraft(null);
        },
        onError: (err) => toast.error(parseApiError(err, t('patientLocation.saveError'))),
    });

    if (isLoading) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.settings.title')} subtitle={t('patient_portal.settings.subtitle')} />}
                <div className="settings-card"><div className="settings-card-body"><TabSkeleton rows={4} /></div></div>
            </>
        );
    }

    if (isError || !settings) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.settings.title')} subtitle={t('patient_portal.settings.subtitle')} />}
                <div className="error-message" style={{ margin: '1rem' }}>{t('patient_portal.settings.error.load')}</div>
            </>
        );
    }

    const toggle = (key: keyof Omit<PatientPortalSettings, 'preferred_language' | 'timezone'>) => {
        save({ [key]: !settings[key] });
    };

    // ── Saved location helpers ────────────────────────────────────────────────
    const loc = locDraft ?? {
        lat: settings.latitude != null ? Number(settings.latitude) : null,
        lng: settings.longitude != null ? Number(settings.longitude) : null,
        label: settings.location_label || '',
    };
    const hasLoc = loc.lat != null && loc.lng != null;
    const locDirty = locDraft !== null;

    async function findPlace() {
        if (!placeQuery.trim()) { toast.error(t('patientLocation.enterPlace')); return; }
        setGeocoding(true);
        try {
            const results = await locatorService.geocode(placeQuery);
            if (!results.length) { toast.error(t('patientLocation.notFound')); return; }
            const top = results[0];
            setLocDraft({ lat: top.latitude, lng: top.longitude, label: top.display_name || placeQuery });
        } catch {
            toast.error(t('patientLocation.geocodeError'));
        } finally {
            setGeocoding(false);
        }
    }

    function useMyLocation() {
        if (!('geolocation' in navigator)) { toast.error(t('patientLocation.geoUnsupported')); return; }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = Math.round(pos.coords.latitude * 1e6) / 1e6;
                const lng = Math.round(pos.coords.longitude * 1e6) / 1e6;
                let label = loc.label;
                try {
                    const r = await locatorService.reverseGeocode(lat, lng);
                    if (r?.display_name) label = r.display_name;
                } catch { /* keep existing label */ }
                setLocDraft({ lat, lng, label });
                setLocating(false);
            },
            () => { toast.error(t('patientLocation.geoDenied')); setLocating(false); },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    }

    function saveLocation() {
        persistLocation({ latitude: loc.lat, longitude: loc.lng, location_label: loc.label }, {
            onSuccess: () => toast.success(t('patientLocation.saved')),
        });
    }

    function clearLocation() {
        persistLocation({ latitude: null, longitude: null, location_label: '' }, {
            onSuccess: () => { setPlaceQuery(''); toast.success(t('patientLocation.cleared')); },
        });
    }

    return (
        <>
            {!asTab && (
                <PageHeader
                    title={t('patient_portal.settings.title')}
                    subtitle={t('patient_portal.settings.subtitle')}
                />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* ── Language & timezone ── */}
                {show('preferences') && (
                <div className="settings-card">
                    <div className="settings-card-head">
                        <h2 className="settings-card-title">{t('patient_portal.settings.language_section')}</h2>
                    </div>
                    <div className="settings-card-body">
                        <div className="settings-grid-2">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="preferred_language">{t('patient_portal.settings.preferred_language')}</label>
                                <select
                                    id="preferred_language"
                                    className="select-input"
                                    value={normalizePortalLanguage(settings.preferred_language)}
                                    disabled={isPending}
                                    onChange={e => save({ preferred_language: e.target.value })}
                                >
                                    {LANGUAGE_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="timezone">{t('patient_portal.settings.timezone')}</label>
                                <select
                                    id="timezone"
                                    className="select-input"
                                    value={settings.timezone || 'UTC'}
                                    disabled={isPending}
                                    onChange={e => save({ timezone: e.target.value })}
                                >
                                    {TIMEZONE_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                                    ))}
                                </select>
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    {t('patient_portal.settings.timezone_hint')}
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* ── My location ── */}
                {show('location') && (
                <div className="settings-card">
                    <div className="settings-card-head">
                        <h2 className="settings-card-title">{t('patientLocation.title')}</h2>
                        <p className="settings-card-subtitle">{t('patientLocation.subtitle')}</p>
                    </div>
                    <div className="settings-card-body">
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                            <input
                                className="input"
                                style={{ flex: '1 1 220px' }}
                                placeholder={t('patientLocation.searchPlaceholder')}
                                value={placeQuery}
                                onChange={e => setPlaceQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); findPlace(); } }}
                            />
                            <button type="button" className="btn btn-secondary btn-sm" onClick={findPlace} disabled={geocoding}>
                                {geocoding ? t('patientLocation.searching') : t('patientLocation.search')}
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={useMyLocation} disabled={locating}>
                                {locating ? t('patientLocation.locating') : t('patientLocation.useMyLocation')}
                            </button>
                        </div>

                        {hasLoc && loc.label && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
                                📍 {loc.label}
                            </p>
                        )}

                        <LeafletMap
                            center={hasLoc ? [loc.lat as number, loc.lng as number] : [20, 0]}
                            zoom={hasLoc ? 13 : 2}
                            recenterTo={hasLoc ? [loc.lat as number, loc.lng as number] : null}
                            recenterZoom={13}
                            draggableMarker={hasLoc ? { lat: loc.lat as number, lng: loc.lng as number } : null}
                            onMarkerDrag={(lat, lng) => setLocDraft({ lat, lng, label: loc.label })}
                            onMapClick={(lat, lng) => setLocDraft({ lat, lng, label: loc.label })}
                            height="300px"
                            ariaLabel={t('patientLocation.mapLabel')}
                        />
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
                            {hasLoc ? t('patientLocation.dragHint') : t('patientLocation.emptyHint')}
                        </p>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-primary btn-sm" onClick={saveLocation} disabled={!locDirty || isSavingLoc || !hasLoc}>
                                {isSavingLoc ? t('common.saving') : t('patientLocation.saveLocation')}
                            </button>
                            {(hasLoc || locDirty) && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={clearLocation} disabled={isSavingLoc}>
                                    {t('patientLocation.clear')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                )}

                {/* ── Change password ── */}
                {show('security') && (
                <form className="settings-card" onSubmit={handlePasswordSubmit}>
                    <div className="settings-card-head">
                        <h2 className="settings-card-title">{t('patient_portal.settings.change_password')}</h2>
                    </div>
                    <div className="settings-card-body">
                        {pwError && <div className="error-message" style={{ marginBottom: '0.75rem' }}>{pwError}</div>}
                        <div className="form-group">
                            <label htmlFor="current_password">{t('patient_portal.settings.current_password')}</label>
                            <input
                                id="current_password"
                                type="password"
                                className="input"
                                value={pwForm.current_password}
                                autoComplete="current-password"
                                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="settings-grid-2">
                            <div className="form-group">
                                <label htmlFor="new_password">{t('patient_portal.settings.new_password')}</label>
                                <input
                                    id="new_password"
                                    type="password"
                                    className="input"
                                    value={pwForm.new_password}
                                    autoComplete="new-password"
                                    onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="confirm_password">{t('patient_portal.settings.confirm_new_password')}</label>
                                <input
                                    id="confirm_password"
                                    type="password"
                                    className="input"
                                    value={pwForm.confirm_password}
                                    autoComplete="new-password"
                                    onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                    <div className="settings-card-footer">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={isChangingPw}>
                            {isChangingPw ? t('patient_portal.common.saving') : t('patient_portal.settings.change_password_action')}
                        </button>
                    </div>
                </form>
                )}

                {/* ── Notification preferences ── */}
                {show('notifications') && (
                <div className="settings-card">
                    <div className="settings-card-head">
                        <h2 className="settings-card-title">{t('patient_portal.settings.notification_preferences')}</h2>
                    </div>
                    <div className="settings-card-body">
                        {NOTIFICATION_PREFS.map(key => (
                            <div key={key} className="settings-toggle-row">
                                <div>
                                    <div className="settings-toggle-text-title">{t(`patient_portal.settings.notifications.${key}.title`)}</div>
                                    <div className="settings-toggle-text-sub">{t(`patient_portal.settings.notifications.${key}.subtitle`)}</div>
                                </div>
                                <Switch
                                    checked={Boolean(settings[key])}
                                    disabled={isPending}
                                    onChange={() => toggle(key)}
                                    label={t(`patient_portal.settings.notifications.${key}.title`)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
                )}

                {/* ── Request profile update ── */}
                {show('requests') && (
                <div className="settings-card">
                    <div className="settings-card-head">
                        <h2 className="settings-card-title">{t('patient_portal.settings.request_profile_update')}</h2>
                    </div>
                    <div className="settings-card-body">
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0, marginBottom: '1rem' }}>
                            {t('patient_portal.settings.request_profile_update_intro')}
                        </p>

                        {updateRequests.length > 0 && (
                            <div style={{ marginBottom: '1rem', display: 'grid', gap: '0.5rem' }}>
                                {updateRequests.slice(0, 3).map(r => {
                                    const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
                                    return (
                                        <div key={r.id} style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    {formatDate(r.created_at)}
                                                </span>
                                                <span style={{ ...badge.style, padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    {t(badge.labelKey)}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem' }}>
                                                {Object.entries(r.requested_fields).map(([k, v]) => (
                                                    <span key={k} style={{ marginRight: '1rem' }}><strong>{t(`patient_portal.settings.editable_fields.${k}.label`, { defaultValue: k.replace(/_/g, ' ') })}:</strong> {v}</span>
                                                ))}
                                            </div>
                                            {r.doctor_note && (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                    {t('patient_portal.settings.doctor_note', { note: r.doctor_note })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {hasPendingRequest ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                                {t('patient_portal.settings.pending_request_notice')}
                            </p>
                        ) : !showUpdateForm ? (
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowUpdateForm(true)}>
                                {t('patient_portal.settings.request_profile_update_action')}
                            </button>
                        ) : (
                            <form onSubmit={handleUpdateSubmit} className="form" style={{ maxWidth: 480 }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 0, marginBottom: '0.75rem' }}>
                                    {t('patient_portal.settings.fill_changed_fields')}
                                </p>
                                {EDITABLE_FIELDS.map(key => (
                                    <div className="form-group" key={key}>
                                        <label htmlFor={`update_${key}`}>{t(`patient_portal.settings.editable_fields.${key}.label`)}</label>
                                        <input
                                            id={`update_${key}`}
                                            type="text"
                                            className="input"
                                            placeholder={t(`patient_portal.settings.editable_fields.${key}.placeholder`)}
                                            value={updateFields[key] ?? ''}
                                            onChange={e => setUpdateFields(f => ({ ...f, [key]: e.target.value }))}
                                        />
                                    </div>
                                ))}
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label htmlFor="update_message">{t('patient_portal.settings.message_to_doctor')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('patient_portal.common.optional_parenthetical')}</span></label>
                                    <textarea
                                        id="update_message"
                                        className="textarea"
                                        rows={3}
                                        placeholder={t('patient_portal.settings.message_placeholder')}
                                        value={updateMessage}
                                        onChange={e => setUpdateMessage(e.target.value)}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                    <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
                                        {isSubmitting ? t('patient_portal.common.submitting') : t('patient_portal.settings.submit_request')}
                                    </button>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowUpdateForm(false); setUpdateFields({}); setUpdateMessage(''); }}>
                                        {t('common.cancel')}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
                )}
            </div>
        </>
    );
}
