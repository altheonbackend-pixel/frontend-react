// src/features/auth/components/LegalPage.tsx
// Standalone, publicly reachable Terms / Privacy / Cookie pages.
// Registration consent links (/terms, /privacy) open these in a new tab, so they
// must render without authentication. Content is sourced from the same i18n keys
// used by the landing-page legal modal (landing_page.legal.<doc>.*).

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../styles/Auth.css';

type LegalDoc = 'terms' | 'privacy' | 'cookies';

export default function LegalPage({ doc }: { doc: LegalDoc }) {
    const { t } = useTranslation();
    const title = t(`landing_page.legal.${doc}.title`);
    const body = t(`landing_page.legal.${doc}.body`);

    return (
        <div className="auth-split">
            <div className="auth-split-left">
                <div className="auth-split-monogram">A</div>
                <div className="auth-split-brand">
                    <div className="auth-split-title">{t('brand.full')}</div>
                    <div className="auth-split-subtitle">{title}</div>
                </div>
            </div>

            <div className="auth-split-right">
                <div className="auth-card-v2">
                    <h2 className="auth-card-v2-title">{title}</h2>
                    <div className="legal-page-body">
                        {body.split('\n\n').map((para, i) => (
                            <p key={i} style={{ marginBottom: '1rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{para}</p>
                        ))}
                    </div>
                    <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem' }}>
                        <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('landing_page.legal.close', 'Close')}</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
