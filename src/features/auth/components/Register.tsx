// src/features/auth/components/Register.tsx
// 5-step wizard: Personal → Professional → Location → Schedule → Security

import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import axios from 'axios';
import api from '../../../shared/services/api';
import type { SpecialtyChoice } from '../../../shared/types';

// ── Zod schemas per step ──────────────────────────────────────────────────────

const createStep1Schema = (t: TFunction) => z.object({
    first_name:   z.string().min(1, t('register.error.first_name_required')),
    last_name:    z.string().min(1, t('register.error.last_name_required')),
    email:        z.string().email(t('register.error.valid_email')),
    phone_number: z.string().optional(),
});

const createStep2Schema = (t: TFunction) => z.object({
    specialty:      z.string().min(1, t('register.error.specialty_required')),
    license_number: z.string().optional(),
});

const createStep3Schema = () => z.object({
    country:  z.string().optional(),
    city:     z.string().optional(),
    address:  z.string().optional(),
    timezone: z.string().optional(),
});

const createStep4Schema = (t: TFunction) => z.object({
    mon:           z.boolean().optional(),
    tue:           z.boolean().optional(),
    wed:           z.boolean().optional(),
    thu:           z.boolean().optional(),
    fri:           z.boolean().optional(),
    sat:           z.boolean().optional(),
    sun:           z.boolean().optional(),
    working_start: z.string().min(1, t('register.error.start_time_required')),
    working_end:   z.string().min(1, t('register.error.end_time_required')),
}).refine(
    d => d.mon || d.tue || d.wed || d.thu || d.fri || d.sat || d.sun,
    { message: t('register.error.working_day_required'), path: ['mon'] }
).refine(
    d => !d.working_start || !d.working_end || d.working_start < d.working_end,
    { message: t('register.error.end_after_start'), path: ['working_end'] }
);

const createStep5Schema = (t: TFunction) => z.object({
    password:         z.string().min(8, t('register.error.minimum_8')),
    confirm_password: z.string().min(1, t('register.error.confirm_password')),
    terms_accepted:   z.boolean().refine(val => val === true, {
        message: t('register.error.accept_terms'),
    }),
}).refine(d => d.password === d.confirm_password, {
    message: t('register.error.passwords_mismatch'),
    path: ['confirm_password'],
});

type Step1Data = z.infer<ReturnType<typeof createStep1Schema>>;
type Step2Data = z.infer<ReturnType<typeof createStep2Schema>>;
type Step3Data = z.infer<ReturnType<typeof createStep3Schema>>;
type Step4Data = z.infer<ReturnType<typeof createStep4Schema>>;
type Step5Data = z.infer<ReturnType<typeof createStep5Schema>>;
type AllData   = Partial<Step1Data & Step2Data & Step3Data & Step4Data & Step5Data>;

const STEPS = ['personal', 'professional', 'location', 'schedule', 'security'] as const;

const DAYS = [
    { labelKey: 'datetime.weekday_short.mon', key: 'mon' as const, value: 0 },
    { labelKey: 'datetime.weekday_short.tue', key: 'tue' as const, value: 1 },
    { labelKey: 'datetime.weekday_short.wed', key: 'wed' as const, value: 2 },
    { labelKey: 'datetime.weekday_short.thu', key: 'thu' as const, value: 3 },
    { labelKey: 'datetime.weekday_short.fri', key: 'fri' as const, value: 4 },
    { labelKey: 'datetime.weekday_short.sat', key: 'sat' as const, value: 5 },
    { labelKey: 'datetime.weekday_short.sun', key: 'sun' as const, value: 6 },
];

const TIMEZONES = [
    { value: 'UTC',                 labelKey: 'patient_portal.timezones.utc' },
    { value: 'Africa/Dakar',        labelKey: 'timezones.africa_dakar' },
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

const COUNTRIES = [
    'pakistan', 'india', 'bangladesh', 'united_arab_emirates', 'saudi_arabia',
    'iraq', 'turkey', 'united_kingdom', 'france', 'germany', 'egypt',
    'nigeria', 'kenya', 'senegal', 'united_states', 'canada', 'australia', 'other',
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

export default function Register() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const step1Schema = useMemo(() => createStep1Schema(t), [t]);
    const step2Schema = useMemo(() => createStep2Schema(t), [t]);
    const step3Schema = useMemo(() => createStep3Schema(), []);
    const step4Schema = useMemo(() => createStep4Schema(t), [t]);
    const step5Schema = useMemo(() => createStep5Schema(t), [t]);
    const [step, setStep] = useState(0);
    const [formData, setFormData] = useState<AllData>({});
    const [specialties, setSpecialties] = useState<SpecialtyChoice[]>([]);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        api.get('/auth/specialties/').then(r => setSpecialties(r.data)).catch(() => {});
    }, []);

    const s1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema), defaultValues: formData });
    const s2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema), defaultValues: { specialty: 'general_practice', ...formData } });
    const s3 = useForm<Step3Data>({ resolver: zodResolver(step3Schema), defaultValues: formData });
    const s4 = useForm<Step4Data>({
        resolver: zodResolver(step4Schema),
        defaultValues: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false, working_start: '09:00', working_end: '17:00', ...formData },
    });
    const s5 = useForm<Step5Data>({ resolver: zodResolver(step5Schema), defaultValues: formData });

    const handleNext1 = s1.handleSubmit(data => { setFormData(prev => ({ ...prev, ...data })); setStep(1); });
    const handleNext2 = s2.handleSubmit(data => { setFormData(prev => ({ ...prev, ...data })); setStep(2); });
    const handleNext3 = s3.handleSubmit(data => { setFormData(prev => ({ ...prev, ...data })); setStep(3); });
    const handleNext4 = s4.handleSubmit(data => { setFormData(prev => ({ ...prev, ...data })); setStep(4); });

    const handleSubmit5 = s5.handleSubmit(async data => {
        setError(null);
        setSubmitting(true);
        const d = { ...formData, ...data };

        const working_days = DAYS
            .filter(day => d[day.key])
            .map(day => day.value);

        try {
            await api.post('/register/doctor/', {
                first_name:     d.first_name,
                last_name:      d.last_name,
                email:          d.email,
                phone_number:   d.phone_number ?? '',
                password:       d.password,
                specialty:      d.specialty ?? 'general_practice',
                license_number: d.license_number ?? '',
                country:        d.country ?? '',
                city:           d.city ?? '',
                address:        d.address ?? '',
                timezone:       d.timezone ?? 'UTC',
                working_days,
                working_start:  d.working_start ?? '09:00',
                working_end:    d.working_end ?? '17:00',
                terms_accepted: d.terms_accepted ?? true,
            });
            setSuccess(true);
            setTimeout(() => navigate('/login', { replace: true }), 2500);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const resp = err.response.data;
                const msg = typeof resp === 'object'
                    ? Object.values(resp).flat().join(' ')
                    : t('register.error.failed');
                setError(msg);
            } else {
                setError(t('register.error.network'));
            }
        } finally {
            setSubmitting(false);
        }
    });

    if (success) {
        return (
            <div className="auth-split">
                <div className="auth-split-left">
                    <div className="auth-split-monogram">A</div>
                    <div className="auth-split-brand">
                        <div className="auth-split-title">{t('brand.full')}</div>
                        <div className="auth-split-subtitle">{t('register.success_welcome')}</div>
                    </div>
                </div>
                <div className="auth-split-right">
                    <div className="auth-card-v2" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <h2 className="auth-card-v2-title">{t('register.success_pending_title')}</h2>
                        <p className="auth-card-v2-subtitle">{t('register.success_pending_body')}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-split">
            <div className="auth-split-left">
                <div className="auth-split-monogram">A</div>
                <div className="auth-split-brand">
                    <div className="auth-split-title">{t('brand.full')}</div>
                    <div className="auth-split-subtitle">{t('register.left_subtitle')}</div>
                </div>
                <div className="auth-split-features">
                    <div className="auth-split-feature"><div className="auth-split-feature-icon">✓</div>{t('register.feature_patient_management')}</div>
                    <div className="auth-split-feature"><div className="auth-split-feature-icon">✓</div>{t('register.feature_scheduling')}</div>
                    <div className="auth-split-feature"><div className="auth-split-feature-icon">✓</div>{t('register.feature_referrals')}</div>
                </div>
            </div>

            <div className="auth-split-right">
                <div className="auth-card-v2">
                    {/* Step indicator */}
                    <div className="auth-steps">
                        {STEPS.map((label, i) => (
                            <div
                                key={label}
                                className={`auth-step-dot${i === step ? ' active' : i < step ? ' done' : ''}`}
                                title={t(`register.steps.${label}`)}
                            />
                        ))}
                        <span className="auth-step-label">{t('register.step_label', { current: step + 1, total: STEPS.length, label: t(`register.steps.${STEPS[step]}`) })}</span>
                    </div>

                    {/* ── Step 1: Personal ── */}
                    {step === 0 && (
                        <>
                            <h2 className="auth-card-v2-title">{t('register.details_title')}</h2>
                            <p className="auth-card-v2-subtitle">{t('register.details_subtitle')}</p>
                            <form onSubmit={handleNext1} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-field">
                                        <label htmlFor="first_name">{t('register.first_name')}</label>
                                        <input id="first_name" className="input" placeholder="Ahmed" {...s1.register('first_name')} />
                                        {s1.formState.errors.first_name && <span className="form-field-error">{s1.formState.errors.first_name.message}</span>}
                                    </div>
                                    <div className="form-field">
                                        <label htmlFor="last_name">{t('register.last_name')}</label>
                                        <input id="last_name" className="input" placeholder="Siddiqui" {...s1.register('last_name')} />
                                        {s1.formState.errors.last_name && <span className="form-field-error">{s1.formState.errors.last_name.message}</span>}
                                    </div>
                                </div>
                                <div className="form-field">
                                    <label htmlFor="reg_email">{t('register.email')}</label>
                                    <input id="reg_email" type="email" className="input" placeholder="you@hospital.com" autoComplete="email" {...s1.register('email')} />
                                    {s1.formState.errors.email && <span className="form-field-error">{s1.formState.errors.email.message}</span>}
                                </div>
                                <div className="form-field">
                                    <label htmlFor="phone_number">{t('register.phone_number')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t('common.optional_parenthetical')}</span></label>
                                    <input id="phone_number" type="tel" className="input" placeholder="+92 300 0000000" {...s1.register('phone_number')} />
                                </div>
                                <button type="submit" className="btn btn-primary btn-lg btn-full" style={{ marginTop: '0.5rem' }}>{t('common.next')}</button>
                            </form>
                        </>
                    )}

                    {/* ── Step 2: Professional ── */}
                    {step === 1 && (
                        <>
                            <h2 className="auth-card-v2-title">{t('register.professional_title')}</h2>
                            <p className="auth-card-v2-subtitle">{t('register.professional_subtitle')}</p>
                            <form onSubmit={handleNext2} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="form-field">
                                    <label htmlFor="specialty">{t('register.specialty')}</label>
                                    <select id="specialty" className="input select-input" {...s2.register('specialty')}>
                                        {specialties.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        {specialties.length === 0 && <option value="general_practice">{t('specialties.general_practice')}</option>}
                                    </select>
                                    {s2.formState.errors.specialty && <span className="form-field-error">{s2.formState.errors.specialty.message}</span>}
                                </div>
                                <div className="form-field">
                                    <label htmlFor="license_number">{t('register.license')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t('common.optional_parenthetical')}</span></label>
                                    <input id="license_number" className="input" placeholder="PKR-XXXXX" {...s2.register('license_number')} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(0)}>{t('common.back')}</button>
                                    <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }}>{t('common.next')}</button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Step 3: Location ── */}
                    {step === 2 && (
                        <>
                            <h2 className="auth-card-v2-title">{t('register.location_title')}</h2>
                            <p className="auth-card-v2-subtitle">{t('register.location_subtitle')}</p>
                            <form onSubmit={handleNext3} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-field">
                                        <label htmlFor="country">{t('register.country')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t('common.optional_parenthetical')}</span></label>
                                        <select id="country" className="input select-input" {...s3.register('country')}>
                                            <option value="">{t('register.select_country')}</option>
                                            {COUNTRIES.map(c => <option key={c} value={c}>{t(`countries.${c}`)}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label htmlFor="city">{t('register.city')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t('common.optional_parenthetical')}</span></label>
                                        <input id="city" className="input" placeholder="Karachi" {...s3.register('city')} />
                                    </div>
                                </div>
                                <div className="form-field">
                                    <label htmlFor="address">{t('register.clinic_address')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t('common.optional_parenthetical')}</span></label>
                                    <input id="address" className="input" placeholder="123 Clinic St, Building 4" {...s3.register('address')} />
                                </div>
                                <div className="form-field">
                                    <label htmlFor="timezone">{t('register.timezone')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t('common.optional_parenthetical')}</span></label>
                                    <select id="timezone" className="input select-input" {...s3.register('timezone')}>
                                        {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{t(tz.labelKey)}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(1)}>{t('common.back')}</button>
                                    <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }}>{t('common.next')}</button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Step 4: Working Schedule ── */}
                    {step === 3 && (
                        <>
                            <h2 className="auth-card-v2-title">{t('register.schedule_title')}</h2>
                            <p className="auth-card-v2-subtitle">{t('register.schedule_subtitle')}</p>
                            <form onSubmit={handleNext4} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div className="form-field">
                                    <label>{t('register.working_days')}</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                                        {DAYS.map(day => {
                                            const checked = s4.watch(day.key);
                                            return (
                                                <label
                                                    key={day.key}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '48px',
                                                        height: '40px',
                                                        borderRadius: '8px',
                                                        border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                                                        background: checked ? 'var(--accent)' : 'transparent',
                                                        color: checked ? '#fff' : 'var(--text-secondary)',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        userSelect: 'none',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    <input type="checkbox" {...s4.register(day.key)} style={{ display: 'none' }} />
                                                    {t(day.labelKey)}
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {s4.formState.errors.mon && (
                                        <span className="form-field-error">{s4.formState.errors.mon.message}</span>
                                    )}
                                </div>

                                <div className="form-field">
                                    <label>{t('register.working_hours')}</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.375rem' }}>
                                        <div className="form-field" style={{ margin: 0 }}>
                                            <label htmlFor="working_start" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('register.start_time')}</label>
                                            <input id="working_start" type="time" className="input" {...s4.register('working_start')} />
                                            {s4.formState.errors.working_start && <span className="form-field-error">{s4.formState.errors.working_start.message}</span>}
                                        </div>
                                        <div className="form-field" style={{ margin: 0 }}>
                                            <label htmlFor="working_end" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('register.end_time')}</label>
                                            <input id="working_end" type="time" className="input" {...s4.register('working_end')} />
                                            {s4.formState.errors.working_end && <span className="form-field-error">{s4.formState.errors.working_end.message}</span>}
                                        </div>
                                    </div>
                                </div>

                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '-0.5rem 0 0' }}>
                                    {t('register.schedule_hint')}
                                </p>

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                                    <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(2)}>{t('common.back')}</button>
                                    <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }}>{t('common.next')}</button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Step 5: Security ── */}
                    {step === 4 && (
                        <>
                            <h2 className="auth-card-v2-title">{t('register.password_title')}</h2>
                            <p className="auth-card-v2-subtitle">{t('register.password_subtitle')}</p>
                            <form onSubmit={handleSubmit5} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {error && <div className="error-message">{error}</div>}
                                <div className="form-field">
                                    <label htmlFor="reg_password">{t('register.password')}</label>
                                    <div className="password-field-wrap">
                                        <input id="reg_password" type={showPassword ? 'text' : 'password'} className="input" placeholder={t('register.password_placeholder')} {...s5.register('password')} />
                                        <button type="button" className="password-toggle" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? t('common.hide') : t('common.show')}>
                                            {showPassword ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                    {s5.formState.errors.password && <span className="form-field-error">{s5.formState.errors.password.message}</span>}
                                </div>
                                <div className="form-field">
                                    <label htmlFor="confirm_password">{t('register.confirm_password')}</label>
                                    <div className="password-field-wrap">
                                        <input id="confirm_password" type={showConfirm ? 'text' : 'password'} className="input" placeholder={t('register.confirm_password_placeholder')} {...s5.register('confirm_password')} />
                                        <button type="button" className="password-toggle" onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? t('common.hide') : t('common.show')}>
                                            {showConfirm ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                    {s5.formState.errors.confirm_password && <span className="form-field-error">{s5.formState.errors.confirm_password.message}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '8px 0 4px' }}>
                                    <input type="checkbox" id="terms_accepted" {...s5.register('terms_accepted')} style={{ marginTop: '3px', flexShrink: 0 }} />
                                    <label htmlFor="terms_accepted" style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        {t('register.accept_terms_prefix')}{' '}
                                        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{t('register.terms')}</a>
                                        {' '}{t('common.and')}{' '}
                                        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{t('register.privacy')}</a>.
                                    </label>
                                </div>
                                {s5.formState.errors.terms_accepted && (
                                    <span className="form-field-error">{s5.formState.errors.terms_accepted.message}</span>
                                )}
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(3)}>{t('common.back')}</button>
                                    <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={submitting}>
                                        {submitting ? t('register.creating_account') : t('register.create_account')}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {t('register.have_account')}{' '}
                        <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('login.submit')}</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
