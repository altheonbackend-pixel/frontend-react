// src/features/auth/components/Register.tsx
// 4-step wizard: Personal → Professional → Location → Security

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
type AllData   = Partial<Step1Data & Step2Data & Step3Data & Step4Data>;

const STEPS = ['Personal', 'Professional', 'Location', 'Security'];

const TIMEZONES = [
    { value: 'UTC',                  label: 'UTC (Coordinated Universal Time)' },
    { value: 'Asia/Karachi',         label: 'Pakistan (UTC+5)' },
    { value: 'Asia/Kolkata',         label: 'India (UTC+5:30)' },
    { value: 'Asia/Dhaka',           label: 'Bangladesh (UTC+6)' },
    { value: 'Asia/Dubai',           label: 'UAE (UTC+4)' },
    { value: 'Asia/Riyadh',          label: 'Saudi Arabia (UTC+3)' },
    { value: 'Asia/Baghdad',         label: 'Iraq (UTC+3)' },
    { value: 'Asia/Istanbul',        label: 'Turkey (UTC+3)' },
    { value: 'Europe/London',        label: 'United Kingdom (UTC+0/+1)' },
    { value: 'Europe/Paris',         label: 'France / Central Europe (UTC+1/+2)' },
    { value: 'Europe/Berlin',        label: 'Germany (UTC+1/+2)' },
    { value: 'Africa/Cairo',         label: 'Egypt (UTC+2)' },
    { value: 'Africa/Lagos',         label: 'Nigeria (UTC+1)' },
    { value: 'Africa/Nairobi',       label: 'Kenya / East Africa (UTC+3)' },
    { value: 'America/New_York',     label: 'US Eastern (UTC-5/-4)' },
    { value: 'America/Chicago',      label: 'US Central (UTC-6/-5)' },
    { value: 'America/Los_Angeles',  label: 'US Pacific (UTC-8/-7)' },
    { value: 'Australia/Sydney',     label: 'Australia Eastern (UTC+10/+11)' },
];

const COUNTRIES = [
    'Pakistan', 'India', 'Bangladesh', 'United Arab Emirates', 'Saudi Arabia',
    'Iraq', 'Turkey', 'United Kingdom', 'France', 'Germany', 'Egypt',
    'Nigeria', 'Kenya', 'United States', 'Canada', 'Australia', 'Other',
];

// Eye icon components
const EyeOn = () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
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
    const s4 = useForm<Step4Data>({ resolver: zodResolver(step4Schema), defaultValues: formData });

    const handleNext1 = s1.handleSubmit(data => {
        setFormData(prev => ({ ...prev, ...data }));
        setStep(1);
    });

    const handleNext2 = s2.handleSubmit(data => {
        setFormData(prev => ({ ...prev, ...data }));
        setStep(2);
    });

    const handleNext3 = s3.handleSubmit(data => {
        setFormData(prev => ({ ...prev, ...data }));
        setStep(3);
    });

    const handleSubmit4 = s4.handleSubmit(async data => {
        setError(null);
        setSubmitting(true);
        const payload = { ...formData, ...data };
        try {
            await api.post('/register/doctor/', {
                first_name:     payload.first_name,
                last_name:      payload.last_name,
                email:          payload.email,
                phone_number:   payload.phone_number ?? '',
                password:       payload.password,
                specialty:      payload.specialty ?? 'general_practice',
                license_number: payload.license_number ?? '',
                country:        payload.country ?? '',
                city:           payload.city ?? '',
                address:        payload.address ?? '',
                timezone:       payload.timezone ?? 'UTC',
                terms_accepted: payload.terms_accepted ?? true,
            });
            setSuccess(true);
            setTimeout(() => navigate('/login', { replace: true }), 2500);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const d = err.response.data;
                const msg = typeof d === 'object'
                    ? Object.values(d).flat().join(' ')
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

                    {/* ── Step 1: Personal Info ── */}
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
                                <button type="submit" className="btn btn-primary btn-lg btn-full" style={{ marginTop: '0.5rem' }}>
                                    Next →
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Step 2: Professional Details ── */}
                    {step === 1 && (
                        <>
                            <h2 className="auth-card-v2-title">Professional details</h2>
                            <p className="auth-card-v2-subtitle">Your specialty and medical license</p>
                            <form onSubmit={handleNext2} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="form-field">
                                    <label htmlFor="specialty">Specialty</label>
                                    <select id="specialty" className="input select-input" {...s2.register('specialty')}>
                                        {specialties.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                        {specialties.length === 0 && (
                                            <option value="general_practice">General Practice</option>
                                        )}
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

                    {/* ── Step 3: Practice Location ── */}
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
                                            {COUNTRIES.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
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
                                        {TIMEZONES.map(tz => (
                                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
                                    <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }}>Next →</button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Step 4: Security ── */}
                    {step === 3 && (
                        <>
                            <h2 className="auth-card-v2-title">Create a password</h2>
                            <p className="auth-card-v2-subtitle">Choose a strong password and accept our terms</p>
                            <form onSubmit={handleSubmit4} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {error && <div className="error-message">{error}</div>}
                                <div className="form-field">
                                    <label htmlFor="reg_password">Password</label>
                                    <div className="password-field-wrap">
                                        <input id="reg_password" type={showPassword ? 'text' : 'password'} className="input" placeholder="Min. 8 characters" {...s4.register('password')} />
                                        <button type="button" className="password-toggle" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide' : 'Show'}>
                                            {showPassword ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                    {s4.formState.errors.password && <span className="form-field-error">{s4.formState.errors.password.message}</span>}
                                </div>
                                <div className="form-field">
                                    <label htmlFor="confirm_password">Confirm password</label>
                                    <div className="password-field-wrap">
                                        <input id="confirm_password" type={showConfirm ? 'text' : 'password'} className="input" placeholder="Repeat your password" {...s4.register('confirm_password')} />
                                        <button type="button" className="password-toggle" onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? 'Hide' : 'Show'}>
                                            {showConfirm ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                    {s4.formState.errors.confirm_password && <span className="form-field-error">{s4.formState.errors.confirm_password.message}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '8px 0 4px' }}>
                                    <input
                                        type="checkbox"
                                        id="terms_accepted"
                                        {...s4.register('terms_accepted')}
                                        style={{ marginTop: '3px', flexShrink: 0 }}
                                    />
                                    <label htmlFor="terms_accepted" style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        I accept the{' '}
                                        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Terms of Service</a>
                                        {' '}and{' '}
                                        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Privacy Notice</a>.
                                    </label>
                                </div>
                                {s4.formState.errors.terms_accepted && (
                                    <span className="form-field-error">{s4.formState.errors.terms_accepted.message}</span>
                                )}
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
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
