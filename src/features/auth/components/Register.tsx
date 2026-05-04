// src/features/auth/components/Register.tsx
// 5-step wizard: Personal → Professional → Location → Schedule → Security

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../../shared/services/api';
import type { SpecialtyChoice } from '../../../shared/types';

// ── Zod schemas per step ──────────────────────────────────────────────────────

const step1Schema = z.object({
    first_name:   z.string().min(1, 'First name is required'),
    last_name:    z.string().min(1, 'Last name is required'),
    email:        z.string().email('Please enter a valid email'),
    phone_number: z.string().optional(),
});

const step2Schema = z.object({
    specialty:      z.string().min(1, 'Please select a specialty'),
    license_number: z.string().optional(),
});

const step3Schema = z.object({
    country:  z.string().optional(),
    city:     z.string().optional(),
    address:  z.string().optional(),
    timezone: z.string().optional(),
});

const step4Schema = z.object({
    mon:           z.boolean().optional(),
    tue:           z.boolean().optional(),
    wed:           z.boolean().optional(),
    thu:           z.boolean().optional(),
    fri:           z.boolean().optional(),
    sat:           z.boolean().optional(),
    sun:           z.boolean().optional(),
    working_start: z.string().min(1, 'Start time is required'),
    working_end:   z.string().min(1, 'End time is required'),
}).refine(
    d => d.mon || d.tue || d.wed || d.thu || d.fri || d.sat || d.sun,
    { message: 'Please select at least one working day', path: ['mon'] }
).refine(
    d => !d.working_start || !d.working_end || d.working_start < d.working_end,
    { message: 'End time must be after start time', path: ['working_end'] }
);

const step5Schema = z.object({
    password:         z.string().min(8, 'Minimum 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
    terms_accepted:   z.boolean().refine(val => val === true, {
        message: 'You must accept the Terms of Service and Privacy Notice to register.',
    }),
}).refine(d => d.password === d.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Step4Data = z.infer<typeof step4Schema>;
type Step5Data = z.infer<typeof step5Schema>;
type AllData   = Partial<Step1Data & Step2Data & Step3Data & Step4Data & Step5Data>;

const STEPS = ['Personal', 'Professional', 'Location', 'Schedule', 'Security'];

const DAYS = [
    { label: 'Mon', key: 'mon' as const, value: 0 },
    { label: 'Tue', key: 'tue' as const, value: 1 },
    { label: 'Wed', key: 'wed' as const, value: 2 },
    { label: 'Thu', key: 'thu' as const, value: 3 },
    { label: 'Fri', key: 'fri' as const, value: 4 },
    { label: 'Sat', key: 'sat' as const, value: 5 },
    { label: 'Sun', key: 'sun' as const, value: 6 },
];

const TIMEZONES = [
    { value: 'UTC',                 label: 'UTC (Coordinated Universal Time)' },
    { value: 'Africa/Dakar',        label: 'Senegal / West Africa (UTC+0)' },
    { value: 'Asia/Karachi',        label: 'Pakistan (UTC+5)' },
    { value: 'Asia/Kolkata',        label: 'India (UTC+5:30)' },
    { value: 'Asia/Dhaka',          label: 'Bangladesh (UTC+6)' },
    { value: 'Asia/Dubai',          label: 'UAE (UTC+4)' },
    { value: 'Asia/Riyadh',         label: 'Saudi Arabia (UTC+3)' },
    { value: 'Asia/Baghdad',        label: 'Iraq (UTC+3)' },
    { value: 'Asia/Istanbul',       label: 'Turkey (UTC+3)' },
    { value: 'Europe/London',       label: 'United Kingdom (UTC+0/+1)' },
    { value: 'Europe/Paris',        label: 'France / Central Europe (UTC+1/+2)' },
    { value: 'Europe/Berlin',       label: 'Germany (UTC+1/+2)' },
    { value: 'Africa/Cairo',        label: 'Egypt (UTC+2)' },
    { value: 'Africa/Lagos',        label: 'Nigeria (UTC+1)' },
    { value: 'Africa/Nairobi',      label: 'Kenya / East Africa (UTC+3)' },
    { value: 'America/New_York',    label: 'US Eastern (UTC-5/-4)' },
    { value: 'America/Chicago',     label: 'US Central (UTC-6/-5)' },
    { value: 'America/Los_Angeles', label: 'US Pacific (UTC-8/-7)' },
    { value: 'Australia/Sydney',    label: 'Australia Eastern (UTC+10/+11)' },
];

const COUNTRIES = [
    'Pakistan', 'India', 'Bangladesh', 'United Arab Emirates', 'Saudi Arabia',
    'Iraq', 'Turkey', 'United Kingdom', 'France', 'Germany', 'Egypt',
    'Nigeria', 'Kenya', 'Senegal', 'United States', 'Canada', 'Australia', 'Other',
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
    const navigate = useNavigate();
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
                    : 'Registration failed. Please try again.';
                setError(msg);
            } else {
                setError('Network error. Please try again.');
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
                        <div className="auth-split-title">Altheon Connect</div>
                        <div className="auth-split-subtitle">Welcome to the network</div>
                    </div>
                </div>
                <div className="auth-split-right">
                    <div className="auth-card-v2" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <h2 className="auth-card-v2-title">Account created!</h2>
                        <p className="auth-card-v2-subtitle">Your account is ready. Redirecting to login…</p>
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
                    <div className="auth-split-title">Altheon Connect</div>
                    <div className="auth-split-subtitle">Join the clinical excellence network</div>
                </div>
                <div className="auth-split-features">
                    <div className="auth-split-feature"><div className="auth-split-feature-icon">✓</div>Secure patient management</div>
                    <div className="auth-split-feature"><div className="auth-split-feature-icon">✓</div>Smart appointment scheduling</div>
                    <div className="auth-split-feature"><div className="auth-split-feature-icon">✓</div>Professional referral network</div>
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
                                title={label}
                            />
                        ))}
                        <span className="auth-step-label">Step {step + 1} of {STEPS.length} — {STEPS[step]}</span>
                    </div>

                    {/* ── Step 1: Personal ── */}
                    {step === 0 && (
                        <>
                            <h2 className="auth-card-v2-title">Your details</h2>
                            <p className="auth-card-v2-subtitle">Your name, email, and contact number</p>
                            <form onSubmit={handleNext1} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-field">
                                        <label htmlFor="first_name">First name</label>
                                        <input id="first_name" className="input" placeholder="Ahmed" {...s1.register('first_name')} />
                                        {s1.formState.errors.first_name && <span className="form-field-error">{s1.formState.errors.first_name.message}</span>}
                                    </div>
                                    <div className="form-field">
                                        <label htmlFor="last_name">Last name</label>
                                        <input id="last_name" className="input" placeholder="Siddiqui" {...s1.register('last_name')} />
                                        {s1.formState.errors.last_name && <span className="form-field-error">{s1.formState.errors.last_name.message}</span>}
                                    </div>
                                </div>
                                <div className="form-field">
                                    <label htmlFor="reg_email">Email address</label>
                                    <input id="reg_email" type="email" className="input" placeholder="you@hospital.com" autoComplete="email" {...s1.register('email')} />
                                    {s1.formState.errors.email && <span className="form-field-error">{s1.formState.errors.email.message}</span>}
                                </div>
                                <div className="form-field">
                                    <label htmlFor="phone_number">Phone number <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                    <input id="phone_number" type="tel" className="input" placeholder="+92 300 0000000" {...s1.register('phone_number')} />
                                </div>
                                <button type="submit" className="btn btn-primary btn-lg btn-full" style={{ marginTop: '0.5rem' }}>Next →</button>
                            </form>
                        </>
                    )}

                    {/* ── Step 2: Professional ── */}
                    {step === 1 && (
                        <>
                            <h2 className="auth-card-v2-title">Professional details</h2>
                            <p className="auth-card-v2-subtitle">Your specialty and medical license</p>
                            <form onSubmit={handleNext2} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="form-field">
                                    <label htmlFor="specialty">Specialty</label>
                                    <select id="specialty" className="input select-input" {...s2.register('specialty')}>
                                        {specialties.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        {specialties.length === 0 && <option value="general_practice">General Practice</option>}
                                    </select>
                                    {s2.formState.errors.specialty && <span className="form-field-error">{s2.formState.errors.specialty.message}</span>}
                                </div>
                                <div className="form-field">
                                    <label htmlFor="license_number">License number <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                    <input id="license_number" className="input" placeholder="PKR-XXXXX" {...s2.register('license_number')} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(0)}>← Back</button>
                                    <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }}>Next →</button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Step 3: Location ── */}
                    {step === 2 && (
                        <>
                            <h2 className="auth-card-v2-title">Practice location</h2>
                            <p className="auth-card-v2-subtitle">Where you practice and your timezone</p>
                            <form onSubmit={handleNext3} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-field">
                                        <label htmlFor="country">Country <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                        <select id="country" className="input select-input" {...s3.register('country')}>
                                            <option value="">Select country</option>
                                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label htmlFor="city">City <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                        <input id="city" className="input" placeholder="Karachi" {...s3.register('city')} />
                                    </div>
                                </div>
                                <div className="form-field">
                                    <label htmlFor="address">Clinic address <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                    <input id="address" className="input" placeholder="123 Clinic St, Building 4" {...s3.register('address')} />
                                </div>
                                <div className="form-field">
                                    <label htmlFor="timezone">Timezone <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                    <select id="timezone" className="input select-input" {...s3.register('timezone')}>
                                        {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
                                    <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }}>Next →</button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Step 4: Working Schedule ── */}
                    {step === 3 && (
                        <>
                            <h2 className="auth-card-v2-title">Working schedule</h2>
                            <p className="auth-card-v2-subtitle">Set your working days and hours so patients can book appointments</p>
                            <form onSubmit={handleNext4} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div className="form-field">
                                    <label>Working days</label>
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
                                                    {day.label}
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {s4.formState.errors.mon && (
                                        <span className="form-field-error">{s4.formState.errors.mon.message}</span>
                                    )}
                                </div>

                                <div className="form-field">
                                    <label>Working hours</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.375rem' }}>
                                        <div className="form-field" style={{ margin: 0 }}>
                                            <label htmlFor="working_start" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Start time</label>
                                            <input id="working_start" type="time" className="input" {...s4.register('working_start')} />
                                            {s4.formState.errors.working_start && <span className="form-field-error">{s4.formState.errors.working_start.message}</span>}
                                        </div>
                                        <div className="form-field" style={{ margin: 0 }}>
                                            <label htmlFor="working_end" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>End time</label>
                                            <input id="working_end" type="time" className="input" {...s4.register('working_end')} />
                                            {s4.formState.errors.working_end && <span className="form-field-error">{s4.formState.errors.working_end.message}</span>}
                                        </div>
                                    </div>
                                </div>

                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '-0.5rem 0 0' }}>
                                    These hours apply to all selected days. You can set per-day hours from your profile settings later.
                                </p>

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                                    <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
                                    <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }}>Next →</button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Step 5: Security ── */}
                    {step === 4 && (
                        <>
                            <h2 className="auth-card-v2-title">Create a password</h2>
                            <p className="auth-card-v2-subtitle">Choose a strong password and accept our terms</p>
                            <form onSubmit={handleSubmit5} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {error && <div className="error-message">{error}</div>}
                                <div className="form-field">
                                    <label htmlFor="reg_password">Password</label>
                                    <div className="password-field-wrap">
                                        <input id="reg_password" type={showPassword ? 'text' : 'password'} className="input" placeholder="Min. 8 characters" {...s5.register('password')} />
                                        <button type="button" className="password-toggle" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide' : 'Show'}>
                                            {showPassword ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                    {s5.formState.errors.password && <span className="form-field-error">{s5.formState.errors.password.message}</span>}
                                </div>
                                <div className="form-field">
                                    <label htmlFor="confirm_password">Confirm password</label>
                                    <div className="password-field-wrap">
                                        <input id="confirm_password" type={showConfirm ? 'text' : 'password'} className="input" placeholder="Repeat your password" {...s5.register('confirm_password')} />
                                        <button type="button" className="password-toggle" onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? 'Hide' : 'Show'}>
                                            {showConfirm ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                    {s5.formState.errors.confirm_password && <span className="form-field-error">{s5.formState.errors.confirm_password.message}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '8px 0 4px' }}>
                                    <input type="checkbox" id="terms_accepted" {...s5.register('terms_accepted')} style={{ marginTop: '3px', flexShrink: 0 }} />
                                    <label htmlFor="terms_accepted" style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        I accept the{' '}
                                        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Terms of Service</a>
                                        {' '}and{' '}
                                        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Privacy Notice</a>.
                                    </label>
                                </div>
                                {s5.formState.errors.terms_accepted && (
                                    <span className="form-field-error">{s5.formState.errors.terms_accepted.message}</span>
                                )}
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(3)}>← Back</button>
                                    <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={submitting}>
                                        {submitting ? 'Creating account…' : 'Create account'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
