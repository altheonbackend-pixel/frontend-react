// src/features/auth/components/LandingPage.tsx
// Phase 8: Split-screen auth layout

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(1, 'Password is required'),
});
type LoginFormData = z.infer<typeof loginSchema>;

function LandingPage() {
    const { t } = useTranslation();
    const { login } = useAuth();
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        setError,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

    const onSubmit = async (data: LoginFormData) => {
        try {
            await login(data);
        } catch (error) {
            let message = t('login.error.invalid_credentials', 'Invalid email or password.');
            if (axios.isAxiosError(error) && error.response) {
                const d = error.response.data;
                if (d.message) message = d.message;
                else if (d.detail) message = d.detail;
                else if (d.non_field_errors) message = d.non_field_errors[0];
            }
            setError('root', { message });
        }
    };

    return (
        <div className="auth-split">
            {/* Left branding panel — hidden on mobile */}
            <div className="auth-split-left">
                <div className="auth-split-monogram">A</div>

                <div className="auth-split-brand">
                    <div className="auth-split-title">Altheon Connect</div>
                    <div className="auth-split-subtitle">Your complete clinical practice platform</div>
                </div>

                <div className="auth-split-features">
                    <div className="auth-split-feature">
                        <div className="auth-split-feature-icon">✓</div>
                        Patient records in one place
                    </div>
                    <div className="auth-split-feature">
                        <div className="auth-split-feature-icon">✓</div>
                        Smart appointment scheduling
                    </div>
                    <div className="auth-split-feature">
                        <div className="auth-split-feature-icon">✓</div>
                        Secure referral network
                    </div>
                </div>
            </div>

            {/* Right form panel */}
            <div className="auth-split-right">
                <div className="auth-card-v2">
                    <h1 className="auth-card-v2-title">{t('login.title', 'Welcome back')}</h1>
                    <p className="auth-card-v2-subtitle">{t('login.subtitle', 'Sign in to your clinical workspace')}</p>

                    <div style={{ marginBottom: '1rem', padding: '0.9rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-lighter)', border: '1px solid var(--accent-light)', textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem', fontSize: '0.9rem' }}>Patient portal demo</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: '0.65rem' }}>
                            Use the hardcoded patient credentials below to preview the new patient-side frontend:
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.15rem' }}><strong>Email:</strong> patient@altheon.demo</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}><strong>Password:</strong> Patient123!</div>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                                setValue('email', 'patient@altheon.demo');
                                setValue('password', 'Patient123!');
                            }}
                        >
                            Fill demo credentials
                        </button>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {errors.root && (
                            <div className="error-message">{errors.root.message}</div>
                        )}

                        <div className="form-field">
                            <label htmlFor="email">{t('login.email_label', 'Email address')}</label>
                            <input
                                id="email"
                                type="email"
                                className="input"
                                placeholder="you@hospital.com"
                                autoComplete="email"
                                disabled={isSubmitting}
                                {...register('email')}
                            />
                            {errors.email && <span className="form-field-error">{errors.email.message}</span>}
                        </div>

                        <div className="form-field">
                            <label htmlFor="password">{t('login.password_label', 'Password')}</label>
                            <div className="password-field-wrap">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="input"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    disabled={isSubmitting}
                                    {...register('password')}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(p => !p)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {errors.password && <span className="form-field-error">{errors.password.message}</span>}
                        </div>

                        <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
                            <Link to="/forgot-password" style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}>
                                {t('login.forgot_password', 'Forgot password?')}
                            </Link>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg btn-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? t('login.loading', 'Signing in…') : t('login.submit', 'Sign in')}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {t('login.no_account', "Don't have an account?")}{' '}
                        <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                            {t('login.register_link', 'Create account')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default LandingPage;
