import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, parseApiError } from '../../../../shared/components/ui';
import { useDoctorProfile } from '../../hooks/useDoctorProfile';

const LANGUAGES = [
    { value: 'en', labelKey: 'patient_portal.language.en' },
    { value: 'fr', labelKey: 'patient_portal.language.fr' },
];

export default function PreferencesSection() {
    const { t, i18n } = useTranslation();
    const { profile, saveProfile } = useDoctorProfile();
    const [saving, setSaving] = useState(false);

    const current = profile?.locale || (i18n.language?.startsWith('fr') ? 'fr' : 'en');

    const handleChange = async (lang: string) => {
        setSaving(true);
        try {
            await i18n.changeLanguage(lang);
            await saveProfile({ locale: lang });
            toast.success(t('settings.preferences.saved'));
        } catch (err) {
            toast.error(parseApiError(err, t('settings.preferences.save_error')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="settings-card">
            <div className="settings-card-head">
                <h2 className="settings-card-title">{t('settings.preferences.title')}</h2>
                <p className="settings-card-subtitle">{t('settings.preferences.subtitle')}</p>
            </div>
            <div className="settings-card-body">
                <div className="form-group" style={{ marginBottom: 0, maxWidth: 380 }}>
                    <label htmlFor="locale">{t('settings.preferences.language')}</label>
                    <select
                        id="locale"
                        className="select-input"
                        value={current}
                        disabled={saving}
                        onChange={e => handleChange(e.target.value)}
                    >
                        {LANGUAGES.map(l => (
                            <option key={l.value} value={l.value}>{t(l.labelKey)}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
