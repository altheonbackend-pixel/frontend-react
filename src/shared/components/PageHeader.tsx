// src/shared/components/PageHeader.tsx

import { Link } from 'react-router-dom';

interface Breadcrumb {
    label: string;
    href: string;
}

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    breadcrumb?: Breadcrumb[];
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: PageHeaderProps) {
    return (
        <div className="page-header">
            <div className="page-header-left">
                {breadcrumb && breadcrumb.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                        {breadcrumb.map((crumb, i) => (
                            <span key={crumb.href} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>›</span>}
                                <Link
                                    to={crumb.href}
                                    style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}
                                >
                                    {crumb.label}
                                </Link>
                            </span>
                        ))}
                    </div>
                )}
                <h1>{title}</h1>
                {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="page-header-actions">{actions}</div>}
        </div>
    );
}

export default PageHeader;
