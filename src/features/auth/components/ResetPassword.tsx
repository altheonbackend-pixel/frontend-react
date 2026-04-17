import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../../shared/services/api';
import '../styles/Auth.css';

const schema = z.object({
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
});

type FormData = z.infer<typeof schema>;

function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const navigate = useNavigate();
    const [success, setSuccess] = useState(false);

    const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    if (!token) {
        return (
            <div className="auth-container">
                <h2 className="login-title">Invalid link</h2>
                <p style={{ textAlign: 'center', color: '#4a5568', marginBottom: '1.5rem' }}>
                    This password reset link is missing a token. Please request a new one.
                </p>
                <p style={{ textAlign: 'center' }}>
                    <Link to="/forgot-password">Request a new link</Link>
                </p>
            </div>
        );
    }

    const onSubmit = async (data: FormData) => {
        try {
            await api.post('/auth/reset-password/', { token, new_password: data.new_password });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 2500);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { detail?: string } } };
            setError('root', {
                message: e.response?.data?.detail ?? 'Invalid or expired reset link. Please request a new one.',
            });
        }
    };

    if (success) {
        return (
            <div className="auth-container">
                <h2 className="login-title">Password updated</h2>
                <p style={{ textAlign: 'center', color: '#4a5568' }}>
                    Your password has been reset successfully. Redirecting you to login…
                </p>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <h2 className="login-title">Set new password</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
                {errors.root && <p className="error-message">{errors.root.message}</p>}

                <div className="form-group">
                    <label htmlFor="new-password">New password</label>
                    <input
                        type="password"
                        id="new-password"
                        className="input"
                        autoFocus
                        disabled={isSubmitting}
                        {...register('new_password')}
                    />
                    {errors.new_password && <span className="field-error">{errors.new_password.message}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="confirm-password">Confirm password</label>
                    <input
                        type="password"
                        id="confirm-password"
                        className="input"
                        disabled={isSubmitting}
                        {...register('confirm_password')}
                    />
                    {errors.confirm_password && <span className="field-error">{errors.confirm_password.message}</span>}
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Resetting…' : 'Reset password'}
                </button>
            </form>

            <p className="register-link-text">
                <Link to="/login">← Back to login</Link>
            </p>
        </div>
    );
}

export default ResetPassword;
