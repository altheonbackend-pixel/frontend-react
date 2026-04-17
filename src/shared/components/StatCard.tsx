// src/shared/components/StatCard.tsx

import { Link } from 'react-router-dom';

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    delta?: { value: number; label: string };
    variant?: 'default' | 'success' | 'warning' | 'danger';
    href?: string;
}

export function StatCard({ icon, label, value, delta, variant = 'default', href }: StatCardProps) {
    const deltaClass = delta
        ? delta.value > 0 ? 'positive' : delta.value < 0 ? 'negative' : 'neutral'
        : '';
    const deltaSign = delta && delta.value > 0 ? '+' : '';

    const content = (
        <>
            <div className={`stat-card-icon variant-${variant}`}>
                {icon}
            </div>
            <div className="stat-card-body">
                <div className="stat-card-value">{value}</div>
                <div className="stat-card-label">{label}</div>
                {delta !== undefined && (
                    <div className={`stat-card-delta ${deltaClass}`}>
                        {deltaSign}{delta.value} {delta.label}
                    </div>
                )}
            </div>
        </>
    );

    if (href) {
        return (
            <Link to={href} className="stat-card" style={{ cursor: 'pointer' }}>
                {content}
            </Link>
        );
    }

    return <div className="stat-card">{content}</div>;
}

export default StatCard;
