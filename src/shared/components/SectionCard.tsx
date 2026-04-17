// src/shared/components/SectionCard.tsx

interface EmptyConfig {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}

interface SectionCardProps {
    title?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    loading?: boolean;
    empty?: EmptyConfig;
    flush?: boolean;
    className?: string;
}

export function SectionCard({ title, action, children, loading, empty, flush, className }: SectionCardProps) {
    return (
        <div className={`section-card${className ? ' ' + className : ''}`}>
            {title && (
                <div className="section-card-header">
                    <span className="section-card-title">{title}</span>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className={`section-card-body${flush ? ' section-card-body--flush' : ''}`}>
                {loading ? (
                    <TabSkeleton rows={3} />
                ) : empty && !hasChildren(children) ? (
                    <div className="empty-state">
                        <div className="empty-state-title">{empty.title}</div>
                        {empty.subtitle && <div className="empty-state-subtitle">{empty.subtitle}</div>}
                        {empty.action && <div style={{ marginTop: '0.75rem' }}>{empty.action}</div>}
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
}

// helper to detect empty children
function hasChildren(children: React.ReactNode): boolean {
    if (children === null || children === undefined) return false;
    if (typeof children === 'boolean') return false;
    if (Array.isArray(children)) return children.some(hasChildren);
    return true;
}

export function TabSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="tab-skeleton">
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    className="tab-skeleton-row"
                    style={{ opacity: 1 - i * 0.15, width: i % 3 === 2 ? '70%' : '100%' }}
                />
            ))}
        </div>
    );
}

export default SectionCard;
