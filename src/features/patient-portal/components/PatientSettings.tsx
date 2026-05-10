import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast, parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService, type PatientPortalSettings, type ProfileUpdateRequest } from '../services/patientPortalService';
import { normalizePortalLanguage } from '../utils/i18n';

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

export default function PatientSettings({ asTab = false }: { asTab?: boolean }) {
    const { t, i18n } = useTranslation();
    usePageTitle(t('patient_portal.settings.document_title'));
    const queryClient = useQueryClient();
    const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
    const [pwError, setPwError] = useState('');

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
            if (language !== i18n.resolvedLanguage) {
                i18n.changeLanguage(language);
            }
            toast.success(t('patient_portal.settings.toast.preference_saved'));
        },
        onError: (err) => toast.error(parseApiError(err, t('patient_portal.settings.error.save_preference'))),
    });

    if (isLoading) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.settings.title')} subtitle="" />}
                <SectionCard title={t('patient_portal.common.loading')}><TabSkeleton rows={4} /></SectionCard>
            </>
        );
    }

    if (isError || !settings) {
        return (
            <>
                {!asTab && <PageHeader title={t('patient_portal.settings.title')} subtitle="" />}
                <div className="error-message" style={{ margin: '1rem' }}>{t('patient_portal.settings.error.load')}</div>
            </>
        );
    }

    const toggle = (key: keyof Omit<PatientPortalSettings, 'preferred_language' | 'timezone'>) => {
        save({ [key]: !settings[key] });
    };

    return (
        <>
            {!asTab && (
                <PageHeader
                    title={t('patient_portal.settings.title')}
                    subtitle={t('patient_portal.settings.subtitle')}
                />
            )}

            <div style={{ display: 'grid', gap: '1rem' }}>
                <SectionCard title={t('patient_portal.settings.language_section')}>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="preferred_language">{t('patient_portal.settings.preferred_language')}</label>
                            <select
                                id="preferred_language"
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
                </SectionCard>

                <SectionCard title={t('patient_portal.settings.change_password')}>
                    <form onSubmit={handlePasswordSubmit} className="form" style={{ maxWidth: 440 }}>
                        {pwError && <div className="error-message" style={{ marginBottom: '0.75rem' }}>{pwError}</div>}
                        <div className="form-group">
                            <label htmlFor="current_password">{t('patient_portal.settings.current_password')}</label>
                            <input
                                id="current_password"
                                type="password"
                                value={pwForm.current_password}
                                autoComplete="current-password"
                                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="new_password">{t('patient_portal.settings.new_password')}</label>
                            <input
                                id="new_password"
                                type="password"
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
                                value={pwForm.confirm_password}
                                autoComplete="new-password"
                                onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={isChangingPw} style={{ marginTop: '1rem' }}>
                            {isChangingPw ? t('patient_portal.common.saving') : t('patient_portal.settings.change_password_action')}
                        </button>
                    </form>
                </SectionCard>

                <SectionCard title={t('patient_portal.settings.notification_preferences')}>
                    <div style={{ display: 'grid', gap: '0.875rem' }}>
                        {NOTIFICATION_PREFS.map(key => (
                            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', padding: '0.95rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t(`patient_portal.settings.notifications.${key}.title`)}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t(`patient_portal.settings.notifications.${key}.subtitle`)}</div>
                                </div>
                                <button
                                    type="button"
                                    disabled={isPending}
                                    className={`btn btn-sm ${settings[key] ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => toggle(key)}
                                >
                                    {settings[key] ? t('patient_portal.common.on') : t('patient_portal.common.off')}
                                </button>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title={t('patient_portal.settings.request_profile_update')}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
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
                                                {new Date(r.created_at).toLocaleDateString()}
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
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            {t('patient_portal.settings.pending_request_notice')}
                        </p>
                    ) : !showUpdateForm ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowUpdateForm(true)}>
                            {t('patient_portal.settings.request_profile_update_action')}
                        </button>
                    ) : (
                        <form onSubmit={handleUpdateSubmit} className="form" style={{ maxWidth: 480 }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                                {t('patient_portal.settings.fill_changed_fields')}
                            </p>
                            {EDITABLE_FIELDS.map(key => (
                                <div className="form-group" key={key}>
                                    <label htmlFor={`update_${key}`}>{t(`patient_portal.settings.editable_fields.${key}.label`)}</label>
                                    <input
                                        id={`update_${key}`}
                                        type="text"
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
                </SectionCard>
            </div>
        </>
    );
}
