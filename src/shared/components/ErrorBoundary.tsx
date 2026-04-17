// src/shared/components/ErrorBoundary.tsx
// Catches unhandled React rendering errors and shows a friendly fallback UI
// instead of crashing the entire app.
// resetKey: pass location.pathname so a route change always resets stale error state.

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    /** Pass location.pathname — error state resets whenever this value changes. */
    resetKey?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
    }

    componentDidUpdate(prevProps: Props) {
        // Reset error state when the route changes so a crashed route doesn't
        // stay broken after the user navigates away and back.
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false, error: null });
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2>Something went wrong</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        {this.state.error?.message ?? 'An unexpected error occurred.'}
                    </p>
                    <button className="btn btn-primary btn-sm" onClick={this.handleReset}>Try again</button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
