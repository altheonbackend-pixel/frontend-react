import './Logo.css';

interface LogoProps {
    /** Icon height in px */
    size?: 'sm' | 'md' | 'lg';
    /**
     * default  — dark A-frame on light background (main header)
     * inverted — white A-frame on dark background (admin header)
     */
    variant?: 'default' | 'inverted';
    /** Hide the ALTHEON / CONNECT wordmark (icon-only mode) */
    showWordmark?: boolean;
    className?: string;
}

const SIZES = { sm: 28, md: 36, lg: 48 } as const;

/**
 * ECG crossbar points — baseline y=22 in a 40×40 viewBox.
 * Pattern: flat → P-wave → flat → Q → R-spike → S → baseline → T-wave → flat
 * This traces through the exact area where the crossbar of the "A" sits.
 */
const ECG =
    '10.5,22 12,22 13,20.5 14,22 15.5,22 16.5,25.5 17.5,9.5 18.5,27.5 19.5,22 21,22 22.5,20.5 23.5,19.5 25,22 29.5,22';

const Logo = ({
    size = 'md',
    variant = 'default',
    showWordmark = true,
    className = '',
}: LogoProps) => {
    const px = SIZES[size];
    const mod = variant === 'inverted' ? ' logo--inverted' : '';

    return (
        <span className={`altheon-logo${mod}${className ? ` ${className}` : ''}`}>
            {/* ── Icon mark ── */}
            <svg
                className="logo-icon"
                width={px}
                height={px}
                viewBox="0 0 40 40"
                fill="none"
                aria-hidden="true"
            >
                {/* Left leg of the A */}
                <line
                    className="logo-leg"
                    x1="20" y1="3.5"
                    x2="3.5" y2="37"
                    strokeLinecap="round"
                />
                {/* Right leg of the A */}
                <line
                    className="logo-leg"
                    x1="20" y1="3.5"
                    x2="36.5" y2="37"
                    strokeLinecap="round"
                />

                {/* ECG glow — blurred cyan layer behind the trace */}
                <polyline
                    className="logo-ecg-glow"
                    points={ECG}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* ECG trace — crisp animated stroke */}
                <polyline
                    className="logo-ecg-trace"
                    points={ECG}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            {/* ── Wordmark ── */}
            {showWordmark && (
                <span className="logo-wordmark" aria-label="Altheon Connect">
                    <span className="logo-name">ALTHEON</span>
                    <span className="logo-sub">CONNECT</span>
                </span>
            )}
        </span>
    );
};

export default Logo;
