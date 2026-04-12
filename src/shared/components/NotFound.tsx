import { Link } from 'react-router-dom';

const NotFound = () => (
    <div style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>404</h1>
        <h2 style={{ marginBottom: '1rem' }}>Page not found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/dashboard" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            ← Back to Dashboard
        </Link>
    </div>
);

export default NotFound;
