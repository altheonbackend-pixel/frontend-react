import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../../../shared/services/api';
import '../styles/Auth.css';

const schema = z.object({
    email: z.string().email('Please enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

function ForgotPassword() {
    const [submitted, setSubmitted] = useState(false);
    const [submittedEmail, setSubmittedEmail] = useState('');

    const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormData) => {
        try {
            await api.post('/auth/forgot-password/', { email: data.email });
            setSubmittedEmail(data.email);
            setSubmitted(true);
        } catch {
            setError('root', { message: 'An unexpected error occurred. Please try again.' });
        }
    };

    if (submitted) {
        return (
            <div className="auth-container">
                <h2 className="login-title">Check your email</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    If <strong>{submittedEmail}</strong> is registered, you will receive a password reset link within a few minutes.
                </p>
                <p style={{ textAlign: 'center' }}>
                    <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        ← Back to login
                    </Link>
                </p>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <h2 className="login-title">Forgot password</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Enter your account email and we will send you a reset link.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
                {errors.root && <p className="error-message">{errors.root.message}</p>}

                <div className="form-group">
                    <label htmlFor="email">Email address</label>
                    <input
                        type="email"
                        id="email"
                        className="input"
                        autoFocus
                        disabled={isSubmitting}
                        {...register('email')}
                    />
                    {errors.email && <span className="field-error">{errors.email.message}</span>}
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending…' : 'Send reset link'}
                </button>
            </form>

            <p className="register-link-text">
                <Link to="/login">← Back to login</Link>
            </p>
        </div>
    );
}

export default ForgotPassword;
