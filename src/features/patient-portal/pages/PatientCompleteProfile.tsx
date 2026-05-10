import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast } from '../../../shared/components/ui';
import api from '../../../shared/services/api';

const FIELD_META: Record<string, { labelKey: string; type: string; placeholderKey: string }> = {
    date_of_birth: { labelKey: 'patient_portal.profile.date_of_birth', type: 'date', placeholderKey: '' },
    phone_number: { labelKey: 'patient_portal.profile.phone_number', type: 'tel', placeholderKey: 'patient_portal.settings.editable_fields.phone_number.placeholder' },
    address: { labelKey: 'patient_portal.profile.address', type: 'text', placeholderKey: 'patient_portal.settings.editable_fields.address.placeholder' },
};

export default function PatientCompleteProfile() {
    const { t } = useTranslation();
    usePageTitle(t('patient_portal.auth.complete_profile.document_title'));
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const fields = (searchParams.get('fields') || '').split(',').filter(f => f in FIELD_META);

    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(fields.map(f => [f, '']))
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (fields.length === 0) {
        navigate('/patient/dashboard', { replace: true });
        return null;
    }

    const handleChange = (field: string, value: string) => {
        setValues(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const payload: Record<string, string | null> = {};
            for (const field of fields) {
                payload[field] = values[field] || null;
            }
            await api.patch('/patient/profile/', payload);
            toast.success(t('patient_portal.auth.complete_profile.toast.updated'));
            navigate('/patient/dashboard', { replace: true });
        } catch {
            setError(t('patient_portal.auth.complete_profile.error.save'));
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = () => navigate('/patient/dashboard', { replace: true });

    return (
        <div className="patient-auth-shell">
            <div className="patient-auth-left">
                <div className="patient-auth-brand">
                    <div className="patient-auth-logo">
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                            <circle cx="18" cy="18" r="18" fill="var(--accent)" />
                            <path d="M18 10v16M10 18h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div className="patient-auth-brand-name">{t('patient_portal.brand.full')}</div>
                </div>
                <div className="patient-auth-left-body">
                    <div className="patient-auth-headline">{t('patient_portal.auth.complete_profile.headline')}</div>
                    <div className="patient-auth-sub">
                        {t('patient_portal.auth.complete_profile.left_subtitle')}
                    </div>
                    <ul className="patient-auth-features">
                        <li><span className="feature-dot feature-dot--green" />{t('patient_portal.auth.complete_profile.feature_contact')}</li>
                        <li><span className="feature-dot feature-dot--blue" />{t('patient_portal.auth.complete_profile.feature_reminders')}</li>
                        <li><span className="feature-dot feature-dot--purple" />{t('patient_portal.auth.complete_profile.feature_settings')}</li>
                    </ul>
                </div>
            </div>

            <div className="patient-auth-right">
                <div className="patient-auth-card">
                    <div className="patient-auth-card-header">
                        <div className="patient-auth-card-title">{t('patient_portal.auth.complete_profile.title')}</div>
                        <div className="patient-auth-card-sub">
                            {t('patient_portal.auth.complete_profile.subtitle')}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="patient-auth-form" noValidate>
                        {error && <div className="patient-auth-error" role="alert">{error}</div>}

                        {fields.map(field => {
                            const meta = FIELD_META[field];
                            return (
                                <div className="form-group" key={field}>
                                    <label htmlFor={field}>{t(meta.labelKey)}</label>
                                    <input
                                        id={field}
                                        type={meta.type}
                                        value={values[field]}
                                        onChange={e => handleChange(field, e.target.value)}
                                        placeholder={meta.placeholderKey ? t(meta.placeholderKey) : ''}
                                        disabled={loading}
                                    />
                                </div>
                            );
                        })}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center' }}
                            disabled={loading}
                        >
                            {loading ? t('patient_portal.common.saving') : t('patient_portal.auth.complete_profile.save_continue')}
                        </button>
                    </form>

                    <div className="patient-auth-divider"><span>{t('patient_portal.common.or')}</span></div>

                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={handleSkip}
                        disabled={loading}
                    >
                        {t('patient_portal.auth.complete_profile.skip')}
                    </button>

                    <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {t('patient_portal.auth.complete_profile.update_later')}
                    </div>
                </div>
            </div>
        </div>
    );
}
