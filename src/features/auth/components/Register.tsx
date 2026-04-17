// src/features/auth/components/Register.tsx
// Phase 8: 3-step wizard (Personal → Security → Professional)

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import api from '../../../shared/services/api';
import type { SpecialtyChoice } from '../../../shared/types';

// ── Zod schemas per step ──────────────────────────────────────────────────────
const step1Schema = z.object({
    first_name: z.string().min(1, 'First name is required'),
    last_name:  z.string().min(1, 'Last name is required'),
    email:      z.string().email('Please enter a valid email'),
});

const step2Schema = z.object({
    password:         z.string().min(8, 'Minimum 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.password === d.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
});

const step3Schema = z.object({
    specialty:         z.string().min(1, 'Please select a specialty'),
    license_number:    z.string().optional(),
    registration_code: z.string().min(1, 'Registration code is required'),
    terms_accepted:    z.boolean().refine(val => val === true, {
        message: 'You must accept the Terms of Service and Privacy Notice to register.',
    }),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

const STEPS = ['Personal', 'Security', 'Professional'];

export default function Register() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [formData, setFormData] = useState<Partial<Step1Data & Step2Data & Step3Data>>({});
    const [specialties, setSpecialties] = useState<SpecialtyChoice[]>([]);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        api.get('/auth/specialties/').then(r => setSpecialties(r.data)).catch(() => {});
    }, []);

    // Step forms
    const s1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema), defaultValues: formData });
    const s2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema), defaultValues: formData });
    const s3 = useForm<Step3Data>({ resolver: zodResolver(step3Schema), defaultValues: { specialty: 'general_practice', ...formData } });

    const handleNext1 = s1.handleSubmit((data) => {
        setFormData(prev => ({ ...prev, ...data }));
        setStep(1);
    });

    const handleNext2 = s2.handleSubmit((data) => {
        setFormData(prev => ({ ...prev, ...data }));
        setStep(2);
    });

    const handleSubmit3 = s3.handleSubmit(async (data) => {
        setError(null);
        setSubmitting(true);
        const payload = { ...formData, ...data };
        try {
            await api.post('/register/doctor/', {
                first_name:        payload.first_name,
                last_name:         payload.last_name,
                email:             payload.email,
                password:          payload.password,
                specialty:         payload.specialty,
                license_number:    payload.license_number ?? '',
                registration_code: payload.registration_code,
                terms_accepted:    true,
            });
            setSuccess(true);
            setTimeout(() => navigate('/login', { replace: true }), 2500);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const d = err.response.data;
                const msg = typeof d === 'object'
                    ? Object.values(d).flat().join(' ')
                    : t('register.error.generic', 'Registration failed. Please try again.');
                setError(msg);
            } else {
                setError(t('register.error.network', 'Network error. Please try again.'));
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
                        <p className="auth-card-v2-subtitle">Check your email to verify your address. Redirecting to login…</p>
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

                    <h2 className="auth-card-v2-title">
                        {step === 0 && t('register.step1.title', 'Your details')}
                        {step === 1 && t('register.step2.title', 'Create a password')}
                        {step === 2 && t('register.step3.title', 'Professional info')}
                    </h2>
                    <p className="auth-card-v2-subtitle">
                        {step === 0 && 'Start with your name and email address'}
                        {step === 1 && 'Choose a strong password for your account'}
                        {step === 2 && 'Your specialty and registration details'}
                    </p>

                    {/* ── Step 1: Personal ── */}
                    {step === 0 && (
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
                            <button type="submit" className="btn btn-primary btn-lg btn-full" style={{ marginTop: '0.5rem' }}>
                                Next →
                            </button>
                        </form>
                    )}

                    {/* ── Step 2: Security ── */}
                    {step === 1 && (
                        <form onSubmit={handleNext2} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-field">
                                <label htmlFor="reg_password">Password</label>
                                <div className="password-field-wrap">
                                    <input id="reg_password" type={showPassword ? 'text' : 'password'} className="input" placeholder="Min. 8 characters" {...s2.register('password')} />
                                    <button type="button" className="password-toggle" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide' : 'Show'}>
                                        {showPassword
                                            ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                            : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        }
                                    </button>
                                </div>
                                {s2.formState.errors.password && <span className="form-field-error">{s2.formState.errors.password.message}</span>}
                            </div>
                            <div className="form-field">
                                <label htmlFor="confirm_password">Confirm password</label>
                                <div className="password-field-wrap">
                                    <input id="confirm_password" type={showConfirm ? 'text' : 'password'} className="input" placeholder="Repeat your password" {...s2.register('confirm_password')} />
                                    <button type="button" className="password-toggle" onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? 'Hide' : 'Show'}>
                                        {showConfirm
                                            ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                            : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        }
                                    </button>
                                </div>
                                {s2.formState.errors.confirm_password && <span className="form-field-error">{s2.formState.errors.confirm_password.message}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(0)}>← Back</button>
                                <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }}>Next →</button>
                            </div>
                        </form>
                    )}

                    {/* ── Step 3: Professional ── */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit3} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {error && <div className="error-message">{error}</div>}

                            <div className="form-field">
                                <label htmlFor="specialty">Specialty</label>
                                <select id="specialty" className="input select-input" {...s3.register('specialty')}>
                                    {specialties.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                    {specialties.length === 0 && (
                                        <option value="general_practice">General Practice</option>
                                    )}
                                </select>
                                {s3.formState.errors.specialty && <span className="form-field-error">{s3.formState.errors.specialty.message}</span>}
                            </div>

                            <div className="form-field">
                                <label htmlFor="license_number">License number <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                <input id="license_number" className="input" placeholder="PKR-XXXXX" {...s3.register('license_number')} />
                            </div>

                            <div className="form-field">
                                <label htmlFor="registration_code">Registration code <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>*</span></label>
                                <input id="registration_code" className="input" placeholder="Provided by your administrator" {...s3.register('registration_code')} />
                                {s3.formState.errors.registration_code && <span className="form-field-error">{s3.formState.errors.registration_code.message}</span>}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '8px 0 4px' }}>
                                <input
                                    type="checkbox"
                                    id="terms_accepted"
                                    {...s3.register('terms_accepted')}
                                    style={{ marginTop: '3px', flexShrink: 0 }}
                                />
                                <label htmlFor="terms_accepted" style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    I accept the{' '}
                                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                                        Terms of Service
                                    </a>
                                    {' '}and{' '}
                                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                                        Privacy Notice
                                    </a>
                                    .
                                </label>
                            </div>
                            {s3.formState.errors.terms_accepted && (
                                <span className="form-field-error">{s3.formState.errors.terms_accepted.message}</span>
                            )}

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
                                <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={submitting}>
                                    {submitting ? 'Creating account…' : t('register.submit', 'Create account')}
                                </button>
                            </div>
                        </form>
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
