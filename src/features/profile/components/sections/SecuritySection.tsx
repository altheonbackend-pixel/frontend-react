import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../../shared/services/api';
import { toast, parseApiError } from '../../../../shared/components/ui';
import { TwoFactorSetup } from '../TwoFactorSetup';

export default function SecuritySection() {
    const { t } = useTranslation();
    const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (form.new_password !== form.confirm_password) {
            setError(t('profile.password.error.mismatch'));
            return;
        }
        if (form.new_password.length < 8) {
            setError(t('profile.password.error.too_short'));
            return;
        }
        setSaving(true);
        try {
            await api.post('/change-password/', {
                current_password: form.current_password,
                new_password: form.new_password,
            });
            toast.success(t('profile.password.success'));
            setForm({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
            setError(parseApiError(err, t('profile.password.error.failed')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* ── Change password ── */}
            <form className="settings-card" onSubmit={handleSubmit}>
                <div className="settings-card-head">
                    <h2 className="settings-card-title">{t('profile.password.change')}</h2>
                    <p className="settings-card-subtitle">{t('settings.security.password_subtitle')}</p>
                </div>
                <div className="settings-card-body">
                    {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
                    <div className="form-group" style={{ maxWidth: 440 }}>
                        <label htmlFor="current_password">{t('profile.password.current')}</label>
                        <input
                            id="current_password"
                            type="password"
                            className="input"
                            autoComplete="current-password"
                            value={form.current_password}
                            onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="settings-grid-2">
                        <div className="form-group">
                            <label htmlFor="new_password">{t('profile.password.new')}</label>
                            <input
                                id="new_password"
                                type="password"
                                className="input"
                                autoComplete="new-password"
                                value={form.new_password}
                                onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirm_password">{t('profile.password.confirm_new')}</label>
                            <input
                                id="confirm_password"
                                type="password"
                                className="input"
                                autoComplete="new-password"
                                value={form.confirm_password}
                                onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                                required
                            />
                        </div>
                    </div>
                </div>
                <div className="settings-card-footer">
                    <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={saving || !form.current_password || !form.new_password}
                    >
                        {saving ? t('common.saving') : t('profile.password.update')}
                    </button>
                </div>
            </form>

            {/* ── Two-factor authentication ── */}
            <TwoFactorSetup />
        </div>
    );
}
