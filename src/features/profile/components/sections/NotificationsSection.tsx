import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, parseApiError } from '../../../../shared/components/ui';
import api from '../../../../shared/services/api';
import { useDoctorProfile } from '../../hooks/useDoctorProfile';
import { Switch } from '../../../../shared/components/Switch';

type PrefKey = 'sms_alerts_enabled' | 'push_alerts_enabled';

const PREFS: PrefKey[] = ['push_alerts_enabled', 'sms_alerts_enabled'];

interface TestSmsResult {
    ok: boolean;
    status: string;
    backend: string;
    delivers_externally: boolean;
    phone: string;
}

export default function NotificationsSection() {
    const { t } = useTranslation();
    const { profile, saveProfile } = useDoctorProfile();
    const [busy, setBusy] = useState<PrefKey | null>(null);
    const [testingSms, setTestingSms] = useState(false);

    const toggle = async (key: PrefKey, next: boolean) => {
        setBusy(key);
        try {
            await saveProfile({ [key]: next });
            toast.success(t('settings.notifications.saved'));
        } catch (err) {
            toast.error(parseApiError(err, t('settings.notifications.save_error')));
        } finally {
            setBusy(null);
        }
    };

    const sendTestSms = async () => {
        setTestingSms(true);
        try {
            const { data } = await api.post<TestSmsResult>('/settings/test-sms/', {});
            if (data.delivers_externally) {
                toast.success(t('settings.notifications.test_sms_sent', { phone: data.phone }));
            } else {
                // Backend accepted it but the active backend only logs (console/dev).
                toast.info(t('settings.notifications.test_sms_logged', { backend: data.backend }));
            }
        } catch (err) {
            toast.error(parseApiError(err, t('settings.notifications.test_sms_error')));
        } finally {
            setTestingSms(false);
        }
    };

    const hasPhone = Boolean(profile?.phone_number);

    return (
        <div className="settings-card">
            <div className="settings-card-head">
                <h2 className="settings-card-title">{t('settings.notifications.title')}</h2>
                <p className="settings-card-subtitle">{t('settings.notifications.subtitle')}</p>
            </div>

            <div className="settings-card-body">
                {PREFS.map(key => (
                    <div className="settings-toggle-row" key={key}>
                        <div>
                            <div className="settings-toggle-text-title">{t(`settings.notifications.${key}.title`)}</div>
                            <div className="settings-toggle-text-sub">{t(`settings.notifications.${key}.subtitle`)}</div>
                        </div>
                        <Switch
                            checked={Boolean(profile?.[key])}
                            disabled={busy === key}
                            onChange={next => toggle(key, next)}
                            label={t(`settings.notifications.${key}.title`)}
                        />
                    </div>
                ))}
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1rem', marginBottom: 0 }}>
                    {t('settings.notifications.phi_note')}
                </p>

                {/* Verify SMS delivery end-to-end */}
                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="settings-toggle-text-title">{t('settings.notifications.test_sms_title')}</div>
                    <div className="settings-toggle-text-sub" style={{ marginBottom: '0.75rem' }}>
                        {hasPhone
                            ? t('settings.notifications.test_sms_hint', { phone: profile?.phone_number })
                            : t('settings.notifications.test_sms_no_phone')}
                    </div>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!hasPhone || testingSms}
                        onClick={sendTestSms}
                    >
                        {testingSms ? t('settings.notifications.test_sms_sending') : t('settings.notifications.test_sms_button')}
                    </button>
                </div>
            </div>
        </div>
    );
}
