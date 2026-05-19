import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import '../styles/Auth.css';

const createSchema = (t: (key: string) => string) => z.object({
    email: z.string().email(t('auth.forgot.error.valid_email')),
});

type FormData = z.infer<ReturnType<typeof createSchema>>;

function ForgotPassword() {
    const { t } = useTranslation();
    const schema = useMemo(() => createSchema(t), [t]);
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
            setError('root', { message: t('auth.forgot.error.unexpected') });
        }
    };

    if (submitted) {
        return (
            <div className="auth-container">
                <h2 className="login-title">{t('auth.forgot.check_email_title')}</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    {t('auth.forgot.sent_prefix')} <strong>{submittedEmail}</strong> {t('auth.forgot.sent_suffix')}
                </p>
                <p style={{ textAlign: 'center' }}>
                    <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        {t('auth.back_to_login')}
                    </Link>
                </p>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <h2 className="login-title">{t('auth.forgot.title')}</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                {t('auth.forgot.subtitle')}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
                {errors.root && <p className="error-message">{errors.root.message}</p>}

                <div className="form-group">
                    <label htmlFor="email">{t('login.email_label')}</label>
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
                    {isSubmitting ? t('common.sending') : t('auth.forgot.send_reset_link')}
                </button>
            </form>

            <p className="register-link-text">
                <Link to="/login">{t('auth.back_to_login')}</Link>
            </p>
        </div>
    );
}

export default ForgotPassword;
