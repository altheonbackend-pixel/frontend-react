// 3-step patient self-registration
// Step 1: Personal  →  Step 2: Location & Timezone  →  Step 3: Security

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../../../shared/services/api';

// ── Schemas ───────────────────────────────────────────────────────────────────

const step1Schema = z.object({
    first_name:    z.string().min(1, 'First name is required'),
    last_name:     z.string().min(1, 'Last name is required'),
    email:         z.string().email('Please enter a valid email'),
    date_of_birth: z.string().optional(),
    phone_number:  z.string().optional(),
});

const step2Schema = z.object({
    address:  z.string().optional(),
    timezone: z.string().optional(),
});

const step3Schema = z.object({
    password:         z.string().min(8, 'Minimum 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
    terms_accepted:   z.boolean().refine(v => v === true, {
        message: 'You must accept the Terms of Service to register.',
    }),
}).refine(d => d.password === d.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type AllData   = Partial<Step1Data & Step2Data & Step3Data>;

const STEPS = ['Personal', 'Location', 'Security'];

const TIMEZONES = [
    { value: 'UTC',                 label: 'UTC' },
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
    const navigate = useNavigate();

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
                    : 'Registration failed. Please try again.';
                setError(msg);
            } else {
                setError('Network error. Please try again.');
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
                        <div className="patient-auth-brand-name">Altheon Patient Portal</div>
                    </div>
                    <div className="patient-auth-left-body">
                        <div className="patient-auth-headline">Your health, clear and connected.</div>
                    </div>
                </div>
                <div className="patient-auth-right">
                    <div className="patient-auth-card" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <div className="patient-auth-card-title">Account created!</div>
                        <div className="patient-auth-card-sub" style={{ marginTop: '0.5rem' }}>
                            {successInfo.merged
                                ? 'We found an existing patient record linked to your email. Your account is now connected to your health records.'
                                : 'Your account is ready. You can now browse doctors and book appointments.'}
                        </div>
                        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Redirecting to your dashboard…
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
                    <div className="patient-auth-brand-name">Altheon Patient Portal</div>
                </div>
                <div className="patient-auth-left-body">
                    <div className="patient-auth-headline">Your health, clear and connected.</div>
                    <div className="patient-auth-sub">
                        Create your account to browse doctors, request appointments, and access your health records.
                    </div>
                    <ul className="patient-auth-features">
                        <li><span className="feature-dot feature-dot--green" />Browse doctors by specialty</li>
                        <li><span className="feature-dot feature-dot--blue" />Request and track appointments</li>
                        <li><span className="feature-dot feature-dot--purple" />View your health records</li>
                        <li><span className="feature-dot feature-dot--orange" />Stay notified about your care</li>
                    </ul>
                </div>
                <div className="patient-auth-left-footer">
                    Already have an account? <Link to="/patient/login" className="patient-auth-link">Sign in →</Link>
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
                                title={label}
                            />
                        ))}
                        <span className="auth-step-label">Step {step + 1} of {STEPS.length} — {STEPS[step]}</span>
                    </div>

                    {/* ── Step 1: Personal ── */}
                    {step === 0 && (
                        <>
                            <div className="patient-auth-card-title">Create your account</div>
                            <div className="patient-auth-card-sub">Your personal information</div>
                            <form onSubmit={handleNext1} className="patient-auth-form" style={{ marginTop: '1.25rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-group">
                                        <label htmlFor="first_name">First name</label>
                                        <input id="first_name" placeholder="Sara" {...s1.register('first_name')} />
                                        {s1.formState.errors.first_name && <span className="form-field-error">{s1.formState.errors.first_name.message}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="last_name">Last name</label>
                                        <input id="last_name" placeholder="Ahmed" {...s1.register('last_name')} />
                                        {s1.formState.errors.last_name && <span className="form-field-error">{s1.formState.errors.last_name.message}</span>}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="reg_email">Email address</label>
                                    <input id="reg_email" type="email" autoComplete="email" placeholder="you@example.com" {...s1.register('email')} />
                                    {s1.formState.errors.email && <span className="form-field-error">{s1.formState.errors.email.message}</span>}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="form-group">
                                        <label htmlFor="date_of_birth">Date of birth <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                        <input id="date_of_birth" type="date" {...s1.register('date_of_birth')} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="phone_number">Phone <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                        <input id="phone_number" type="tel" placeholder="+92 300 0000000" {...s1.register('phone_number')} />
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
                                    Next →
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Step 2: Location & Timezone ── */}
                    {step === 1 && (
                        <>
                            <div className="patient-auth-card-title">Your location</div>
                            <div className="patient-auth-card-sub">Helps display appointment times correctly</div>
                            <form onSubmit={handleNext2} className="patient-auth-form" style={{ marginTop: '1.25rem' }}>
                                <div className="form-group">
                                    <label htmlFor="address">Address <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                    <input id="address" placeholder="123 Main St, City" {...s2.register('address')} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="timezone">Your timezone</label>
                                    <select id="timezone" {...s2.register('timezone')} style={{ width: '100%' }}>
                                        {TIMEZONES.map(tz => (
                                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(0)}>← Back</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Next →</button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* ── Step 3: Security ── */}
                    {step === 2 && (
                        <>
                            <div className="patient-auth-card-title">Create a password</div>
                            <div className="patient-auth-card-sub">Almost done — set a strong password</div>
                            <form onSubmit={handleSubmit3} className="patient-auth-form" style={{ marginTop: '1.25rem' }}>
                                {error && <div className="patient-auth-error" role="alert">{error}</div>}

                                <div className="form-group">
                                    <label htmlFor="password">Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Min. 8 characters"
                                            style={{ paddingRight: '2.75rem' }}
                                            {...s3.register('password')}
                                        />
                                        <button type="button" onClick={() => setShowPassword(p => !p)} className="btn-ghost" style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)' }} aria-label={showPassword ? 'Hide' : 'Show'}>
                                            {showPassword ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                    {s3.formState.errors.password && <span className="form-field-error">{s3.formState.errors.password.message}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="confirm_password">Confirm password</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="confirm_password"
                                            type={showConfirm ? 'text' : 'password'}
                                            placeholder="Repeat your password"
                                            style={{ paddingRight: '2.75rem' }}
                                            {...s3.register('confirm_password')}
                                        />
                                        <button type="button" onClick={() => setShowConfirm(p => !p)} className="btn-ghost" style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)' }} aria-label={showConfirm ? 'Hide' : 'Show'}>
                                            {showConfirm ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                    {s3.formState.errors.confirm_password && <span className="form-field-error">{s3.formState.errors.confirm_password.message}</span>}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '8px 0 4px' }}>
                                    <input type="checkbox" id="terms" {...s3.register('terms_accepted')} style={{ marginTop: '3px', flexShrink: 0 }} />
                                    <label htmlFor="terms" style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        I accept the{' '}
                                        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Terms of Service</a>
                                        {' '}and{' '}
                                        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Privacy Notice</a>.
                                    </label>
                                </div>
                                {s3.formState.errors.terms_accepted && <span className="form-field-error">{s3.formState.errors.terms_accepted.message}</span>}

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                                    <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>← Back</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={submitting}>
                                        {submitting ? 'Creating account…' : 'Create account'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        This portal is for patients of Altheon Connect healthcare providers.<br />
                        Your session is secured and your data is protected.
                    </div>
                </div>
            </div>
        </div>
    );
}
