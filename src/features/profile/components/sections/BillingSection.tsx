import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, parseApiError } from '../../../../shared/components/ui';
import { useDoctorProfile } from '../../hooks/useDoctorProfile';
import { CURRENCIES } from '../../settingsConstants';

export default function BillingSection() {
    const { t } = useTranslation();
    const { profile, saveProfile } = useDoctorProfile();

    const [fee, setFee] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [taxId, setTaxId] = useState('');
    const [billingEmail, setBillingEmail] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!profile) return;
        setFee(profile.consultation_fee != null ? String(profile.consultation_fee) : '');
        setCurrency(profile.currency || 'USD');
        setTaxId(profile.tax_id || '');
        setBillingEmail(profile.billing_email || '');
    }, [profile]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveProfile({
                consultation_fee: fee.trim() === '' ? null : fee,
                currency,
                tax_id: taxId,
                billing_email: billingEmail,
            });
            toast.success(t('settings.billing.saved'));
        } catch (err) {
            toast.error(parseApiError(err, t('settings.billing.save_error')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="settings-card">
            <div className="settings-card-head">
                <h2 className="settings-card-title">{t('settings.billing.title')}</h2>
                <p className="settings-card-subtitle">{t('settings.billing.subtitle')}</p>
            </div>

            <div className="settings-card-body">
                <div className="settings-grid-2">
                    <div className="form-group">
                        <label htmlFor="consultation_fee">{t('settings.billing.consultation_fee')}</label>
                        <input
                            id="consultation_fee"
                            type="number"
                            min="0"
                            step="0.01"
                            className="input"
                            placeholder="0.00"
                            value={fee}
                            onChange={e => setFee(e.target.value)}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('settings.billing.consultation_fee_hint')}</span>
                    </div>
                    <div className="form-group">
                        <label htmlFor="currency">{t('settings.billing.currency')}</label>
                        <select id="currency" className="select-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                            {CURRENCIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ marginTop: '0.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                        {t('settings.billing.invoicing_title')}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
                        {t('settings.billing.invoicing_subtitle')}
                    </p>
                    <div className="settings-grid-2">
                        <div className="form-group">
                            <label htmlFor="tax_id">{t('settings.billing.tax_id')}</label>
                            <input id="tax_id" type="text" className="input" value={taxId} onChange={e => setTaxId(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="billing_email">{t('settings.billing.billing_email')}</label>
                            <input id="billing_email" type="email" className="input" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div style={{
                    marginTop: '0.5rem', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-subtle)', fontSize: '0.8rem', color: 'var(--text-muted)',
                }}>
                    {t('settings.billing.future_note')}
                </div>
            </div>

            <div className="settings-card-footer">
                <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                    {saving ? t('common.saving') : t('settings.save_changes')}
                </button>
            </div>
        </div>
    );
}
