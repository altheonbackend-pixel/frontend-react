import { useMemo, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import '../styles/Auth.css';

const createSchema = (t: (key: string) => string) => z.object({
    new_password: z.string().min(8, t('auth.reset.error.password_too_short')),
    confirm_password: z.string().min(1, t('auth.reset.error.confirm_required')),
}).refine(data => data.new_password === data.confirm_password, {
    message: t('auth.reset.error.passwords_mismatch'),
    path: ['confirm_password'],
});

type FormData = z.infer<ReturnType<typeof createSchema>>;

function ResetPassword() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const navigate = useNavigate();
    const [success, setSuccess] = useState(false);
    const schema = useMemo(() => createSchema(t), [t]);

    const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    if (!token) {
        return (
            <div className="auth-page-wrapper">
                <div className="auth-container">
                    <h2 className="login-title">{t('auth.reset.invalid_link_title')}</h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        {t('auth.reset.missing_token')}
                    </p>
                    <p style={{ textAlign: 'center' }}>
                        <Link to="/forgot-password">{t('auth.reset.request_new_link')}</Link>
                    </p>
                </div>
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
                message: e.response?.data?.detail ?? t('auth.reset.error.invalid_or_expired'),
            });
        }
    };

    if (success) {
        return (
            <div className="auth-page-wrapper">
                <div className="auth-container">
                    <h2 className="login-title">{t('auth.reset.updated_title')}</h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {t('auth.reset.updated_subtitle')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page-wrapper">
            <div className="auth-container">
                <h2 className="login-title">{t('auth.reset.title')}</h2>

                <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
                    {errors.root && <p className="error-message">{errors.root.message}</p>}

                    <div className="form-group">
                        <label htmlFor="new-password">{t('auth.reset.new_password')}</label>
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
                        <label htmlFor="confirm-password">{t('auth.reset.confirm_password')}</label>
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
                        {isSubmitting ? t('auth.reset.resetting') : t('auth.reset.submit')}
                    </button>
                </form>

                <p className="register-link-text">
                    <Link to="/login">{t('auth.back_to_login')}</Link>
                </p>
            </div>
        </div>
    );
}

export default ResetPassword;
