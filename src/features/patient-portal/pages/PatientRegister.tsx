// 3-step patient self-registration
// Step 1: Personal  →  Step 2: Location & Timezone  →  Step 3: Security

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import api from '../../../shared/services/api';

// ── Schemas ───────────────────────────────────────────────────────────────────

const createStep1Schema = (t: TFunction) => z.object({
    first_name:    z.string().min(1, t('patient_portal.auth.error.first_name_required')),
    last_name:     z.string().min(1, t('patient_portal.auth.error.last_name_required')),
    email:         z.string().email(t('patient_portal.auth.error.valid_email')),
    date_of_birth: z.string().optional(),
    phone_number:  z.string().optional(),
});

const createStep2Schema = () => z.object({
    address:  z.string().optional(),
    timezone: z.string().optional(),
});

const createStep3Schema = (t: TFunction) => z.object({
    password:         z.string().min(8, t('patient_portal.auth.error.password_too_short')),
    confirm_password: z.string().min(1, t('patient_portal.auth.error.confirm_password_required')),
    terms_accepted:   z.boolean().refine(v => v === true, {
        message: t('patient_portal.auth.error.accept_terms'),
    }),
}).refine(d => d.password === d.confirm_password, {
    message: t('patient_portal.auth.error.passwords_mismatch'),
    path: ['confirm_password'],
});

type Step1Data = z.infer<ReturnType<typeof createStep1Schema>>;
type Step2Data = z.infer<ReturnType<typeof createStep2Schema>>;
type Step3Data = z.infer<ReturnType<typeof createStep3Schema>>;
type AllData   = Partial<Step1Data & Step2Data & Step3Data>;

const STEPS = ['personal', 'location', 'security'] as const;

const TIMEZONES = [
    { value: 'UTC',                 labelKey: 'patient_portal.timezones.utc' },
    { value: 'Asia/Karachi',        labelKey: 'patient_portal.timezones.asia_karachi' },
    { value: 'Asia/Kolkata',        labelKey: 'patient_portal.timezones.asia_kolkata' },
    { value: 'Asia/Dhaka',          labelKey: 'patient_portal.timezones.asia_dhaka' },
    { value: 'Asia/Dubai',          labelKey: 'patient_portal.timezones.asia_dubai' },
    { value: 'Asia/Riyadh',         labelKey: 'patient_portal.timezones.asia_riyadh' },
    { value: 'Asia/Baghdad',        labelKey: 'patient_portal.timezones.asia_baghdad' },
    { value: 'Asia/Istanbul',       labelKey: 'patient_portal.timezones.asia_istanbul' },
    { value: 'Europe/London',       labelKey: 'patient_portal.timezones.europe_london' },
    { value: 'Europe/Paris',        labelKey: 'patient_portal.timezones.europe_paris' },
    { value: 'Europe/Berlin',       labelKey: 'patient_portal.timezones.europe_berlin' },
    { value: 'Africa/Cairo',        labelKey: 'patient_portal.timezones.africa_cairo' },
    { value: 'Africa/Lagos',        labelKey: 'patient_portal.timezones.africa_lagos' },
    { value: 'Africa/Nairobi',      labelKey: 'patient_portal.timezones.africa_nairobi' },
    { value: 'America/New_York',    labelKey: 'patient_portal.timezones.america_new_york' },
    { value: 'America/Chicago',     labelKey: 'patient_portal.timezones.america_chicago' },
    { value: 'America/Los_Angeles', labelKey: 'patient_portal.timezones.america_los_angeles' },
    { value: 'Australia/Sydney',    labelKey: 'patient_portal.timezones.australia_sydney' },
];

const EyeOn = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
);
const EyeOff = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
);

export default function PatientRegister() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const step1Schema = useMemo(() => createStep1Schema(t), [t]);
    const step2Schema = useMemo(() => createStep2Schema(), []);
    const step3Schema = useMemo(() => createStep3Schema(t), [t]);

    const [step, setStep] = useState(0);
    const [formData, setFormData] = useState<AllData>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successInfo, setSuccessInfo] = useState<{ merged: boolean } | null>(null);

    const s1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema), defaultValues: formData });
    const s2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema), defaultValues: formData });
    const s3 = useForm<Step3Data>({ resolver: zodResolver(step3Schema), defaultValues: formData });

    const handleNext1 = s1.handleSubmit(data => { setFormData(p => ({ ...p, ...data })); setStep(1); });
    const handleNext2 = s2.handleSubmit(data => { setFormData(p => ({ ...p, ...data })); setStep(2); });

    const handleSubmit3 = s3.handleSubmit(async data => {
        setError(null);
        setSubmitting(true);
        const d = { ...formData, ...data };
        try {
            const res = await api.post('/patient/register/', {
                first_name:    d.first_name,
                last_name:     d.last_name,
                email:         d.email,
                date_of_birth: d.date_of_birth || null,
                phone_number:  d.phone_number || '',
                address:       d.address || '',
                timezone:      d.timezone || 'UTC',
                password:      d.password,
                confirm_password: d.confirm_password,
                terms_accepted: true,
            });
            setSuccessInfo({ merged: res.data.merged });
            const missingFields: string[] = res.data.missing_fields || [];
            const dest = missingFields.length > 0
                ? `/patient/complete-profile?fields=${missingFields.join(',')}`
                : '/patient/dashboard';
            setTimeout(() => navigate(dest, { replace: true }), 2500);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const resp = err.response.data;
                const msg = typeof resp === 'object'
                    ? Object.values(resp).flat().join(' ')
                    : t('patient_portal.auth.register.error_failed');
                setError(msg);
            } else {
                setError(t('patient_portal.common.error.network_retry'));
            }
        } finally {
            setSubmitting(false);
        }
    });

    if (successInfo) {
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
                        <div className="patient-auth-headline">{t('patient_portal.auth.headline')}</div>
                    </div>
                </div>
                <div className="patient-auth-right">
                    <div className="patient-auth-card" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <div className="patient-auth-card-title">{t('patient_portal.auth.register.success_title')}</div>
                        <div className="patient-auth-card-sub" style={{ marginTop: '0.5rem' }}>
                            {successInfo.merged
                                ? t('patient_portal.auth.register.success_merged')
                                : t('patient_portal.auth.register.success_new')}
                        </div>
                        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {t('patient_portal.auth.register.redirecting')}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                    <div className="patient-auth-headline">{t('patient_portal.auth.headline')}</div>
                    <div className="patient-auth-sub">
                        {t('patient_portal.auth.register.left_subtitle')}
                    </div>
                    <ul className="patient-auth-features">
                        <li><span className="feature-dot feature-dot--green" />{t('patient_portal.auth.register.feature_browse')}</li>
                        <li><span className="feature-dot feature-dot--blue" />{t('patient_portal.auth.features.appointments')}</li>
                        <li><span className="feature-dot feature-dot--purple" />{t('patient_portal.auth.register.feature_records')}</li>
                        <li><span className="feature-dot feature-dot--orange" />{t('patient_portal.auth.features.notifications')}</li>
                    </ul>
                </div>
                <div className="patient-auth-left-footer">
                    {t('patient_portal.auth.register.have_account')} <Link to="/patient/login" className="patient-auth-link">{t('patient_portal.auth.sign_in_arrow')}</Link>
                </div>
            </div>

            <div className="patient-auth-right">
                <div className="patient-auth-card">
                    {/* Step indicator */}
                    <div className="auth-steps" style={{ marginBottom: '1.25rem' }}>
                        {STEPS.map((label, i) => (
                            <div
                                key={label}
                                className={`auth-step-dot${i === step ? ' active' : i < step ? ' done' : ''}`}
                                title={t(`patient_portal.auth.register.steps.${label}`)}
                            />
                        ))}
                        <span className="auth-step-label">{t('patient_portal.auth.register.step_label', { current: step + 1, total: STEPS.length, label: t(`patient_portal.auth.register.steps.${STEPS[step]}`) })}</span>
                    </div>

                    {/* ── Step 1: Personal ── */}
                    {step === 0 && (
                        <>
                            <div className="patient-auth-card-title">{t('patient_portal.auth.register.title')}</div>
                            <div className="patient-auth-card-sub">{t('patient_portal.auth.register.personal_information')}</div>
                            <form onSubmit={handleNext1} className="patient-auth-form" style={{ marginTop: '1.25rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-group">
                                        <label htmlFor="first_name">{t('patient_portal.auth.register.first_name')}</label>
                                        <input id="first_name" placeholder="Sara" {...s1.register('first_name')} />
                                        {s1.formState.errors.first_name && <span className="form-field-error">{s1.formState.errors.first_name.message}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="last_name">{t('patient_portal.auth.register.last_name')}</label>
                                        <input id="last_name" placeholder="Ahmed" {...s1.register('last_name')} />
                                        {s1.formState.errors.last_name && <span className="form-field-error">{s1.formState.errors.last_name.message}</span>}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="reg_email">{t('patient_portal.auth.email_address')}</label>
                                    <input id="reg_email" type="email" autoComplete="email" placeholder="you@example.com" {...s1.register('email')} />
                                    {s1.formState.errors.email && <span className="form-field-error">{s1.formState.errors.email.message}</span>}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-group">
                                        <label htmlFor="date_of_birth">{t('patient_portal.profile.date_of_birth')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t('patient_portal.common.optional_parenthetical')}</span></label>
                                        <input id="date_of_birth" type="date" {...s1.register('date_of_birth')} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="phone_number">{t('patient_portal.profile.phone_number')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t('patient_portal.common.optional_parenthetical')}</span></label>
                                        <input id="phone_number" type="tel" placeholder="+92 300 0000000" {...s1.register('phone_number')} />
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
                                    {t('patient_portal.auth.register.next')}
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Step 2: Location & Timezone ── */}
                    {step === 1 && (
                        <>
                            <div className="patient-auth-card-title">{t('patient_portal.auth.register.location_title')}</div>
                            <div className="patient-auth-card-sub">{t('patient_portal.auth.register.location_subtitle')}</div>
                            <form onSubmit={handleNext2} className="patient-auth-form" style={{ marginTop: '1.25rem' }}>
                                <div className="form-group">
                                    <label htmlFor="address">{t('patient_portal.profile.address')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t('patient_portal.common.optional_parenthetical')}</span></label>
                                    <input id="address" placeholder="123 Main St, City" {...s2.register('address')} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="timezone">{t('patient_portal.settings.timezone')}</label>
                                    <select id="timezone" {...s2.register('timezone')} style={{ width: '100%' }}>
                                        {TIMEZONES.map(tz => (
                                            <option key={tz.value} value={tz.value}>{t(tz.labelKey)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(0)}>{t('patient_portal.common.back')}</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>{t('patient_portal.auth.register.next')}</button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Step 3: Security ── */}
                    {step === 2 && (
                        <>
                            <div className="patient-auth-card-title">{t('patient_portal.auth.register.create_password')}</div>
                            <div className="patient-auth-card-sub">{t('patient_portal.auth.register.password_subtitle')}</div>
                            <form onSubmit={handleSubmit3} className="patient-auth-form" style={{ marginTop: '1.25rem' }}>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}

                                <div className="form-group">
                                    <label htmlFor="password">{t('patient_portal.auth.password')}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder={t('patient_portal.auth.minimum_8_characters_short')}
                                            style={{ paddingRight: '2.75rem' }}
                                            {...s3.register('password')}
                                        />
                                        <button type="button" onClick={() => setShowPassword(p => !p)} className="btn-ghost" style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)' }} aria-label={showPassword ? t('patient_portal.common.hide') : t('patient_portal.common.show')}>
                                            {showPassword ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                    {s3.formState.errors.password && <span className="form-field-error">{s3.formState.errors.password.message}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="confirm_password">{t('patient_portal.auth.register.confirm_password')}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="confirm_password"
                                            type={showConfirm ? 'text' : 'password'}
                                            placeholder={t('patient_portal.auth.repeat_password')}
                                            style={{ paddingRight: '2.75rem' }}
                                            {...s3.register('confirm_password')}
                                        />
                                        <button type="button" onClick={() => setShowConfirm(p => !p)} className="btn-ghost" style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)' }} aria-label={showConfirm ? t('patient_portal.common.hide') : t('patient_portal.common.show')}>
                                            {showConfirm ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                    {s3.formState.errors.confirm_password && <span className="form-field-error">{s3.formState.errors.confirm_password.message}</span>}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '8px 0 4px' }}>
                                    <input type="checkbox" id="terms" {...s3.register('terms_accepted')} style={{ marginTop: '3px', flexShrink: 0 }} />
                                    <label htmlFor="terms" style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        {t('patient_portal.claim.complete.accept_terms')}{' '}
                                        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{t('patient_portal.auth.register.terms')}</a>
                                        {' '}{t('patient_portal.common.and')}{' '}
                                        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{t('patient_portal.auth.register.privacy')}</a>.
                                    </label>
                                </div>
                                {s3.formState.errors.terms_accepted && <span className="form-field-error">{s3.formState.errors.terms_accepted.message}</span>}

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                                    <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>{t('patient_portal.common.back')}</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={submitting}>
                                        {submitting ? t('patient_portal.auth.register.creating_account') : t('patient_portal.auth.create_account_short')}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        {t('patient_portal.auth.footer_line1')}<br />
                        {t('patient_portal.auth.footer_line2')}
                    </div>
                </div>
            </div>
        </div>
    );
}
