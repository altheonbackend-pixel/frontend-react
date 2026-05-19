import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NotFound = () => {
    const { t } = useTranslation();
    return (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
            <h1 style={{ fontSize: '4rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>404</h1>
            <h2 style={{ marginBottom: '1rem' }}>{t('not_found.title')}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                {t('not_found.subtitle')}
            </p>
            <Link to="/dashboard" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                {t('not_found.back_to_dashboard')}
            </Link>
        </div>
    );
};

export default NotFound;
