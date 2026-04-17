import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import '../styles/Auth.css';
import { useTranslation } from 'react-i18next';

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function Login() {
    const { t } = useTranslation();
    const { login } = useAuth();

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

    const onSubmit = async (data: LoginFormData) => {
        try {
            await login(data);
        } catch (error) {
            let message = t('login.error.invalid_credentials');
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
        <div className="auth-container">
            <h2 className="login-title">{t('login.title')}</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
                {errors.root && <p className="error-message">{errors.root.message}</p>}

                <div className="form-group">
                    <label htmlFor="email">{t('login.email_label')}</label>
                    <input
                        type="email"
                        id="email"
                        className="input"
                        aria-label={t('login.email_placeholder')}
                        disabled={isSubmitting}
                        {...register('email')}
                    />
                    {errors.email && <span className="field-error">{errors.email.message}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="password">{t('login.password_label')}</label>
                    <input
                        type="password"
                        id="password"
                        className="input"
                        aria-label={t('login.password_placeholder')}
                        disabled={isSubmitting}
                        {...register('password')}
                    />
                    {errors.password && <span className="field-error">{errors.password.message}</span>}
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
                    {isSubmitting ? t('login.loading') : t('login.submit')}
                </button>
            </form>

            <p className="register-link-text" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                <a href="/forgot-password" style={{ fontSize: '0.875rem', color: 'inherit', opacity: 0.75 }}>
                    Forgot password?
                </a>
            </p>

            <p className="register-link-text">
                {t('login.no_account')} <a href="/register">{t('login.register_link')}</a>
            </p>
        </div>
    );
}

export default Login;
