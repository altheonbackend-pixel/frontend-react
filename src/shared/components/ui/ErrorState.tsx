interface ErrorStateProps {
    title?: string;
    description?: string;
    onRetry?: () => void;
}

export const ErrorState = ({ title = 'Something went wrong', description, onRetry }: ErrorStateProps) => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-10)',
        gap: 'var(--space-3)',
        textAlign: 'center',
        color: 'var(--text-muted)',
    }}>
        <span style={{ fontSize: '2rem' }} aria-hidden="true">⚠️</span>
        <strong style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{title}</strong>
        {description && <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{description}</p>}
        {onRetry && (
            <button
                onClick={onRetry}
                style={{
                    marginTop: 'var(--space-2)',
                    padding: '6px 16px',
                    background: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                }}
            >
                Try again
            </button>
        )}
    </div>
);

export default ErrorState;
