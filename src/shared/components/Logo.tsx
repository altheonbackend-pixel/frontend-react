import { useTranslation } from 'react-i18next';

import LogoClassic from './LogoClassic';
import './Logo.css';

// ─────────────────────────────────────────────────────────────────────────
// Brand switch. `true` (current) keeps the original ECG-crossbar mark live —
// it is preserved verbatim in LogoClassic.tsx. Flip to `false` to adopt the
// new rounded-A mark below; every caller goes through this component, so
// that one line is the whole switch, either direction.
// ─────────────────────────────────────────────────────────────────────────
const USE_CLASSIC_MARK = true;

interface LogoProps {
    /** Icon height in px */
    size?: 'sm' | 'md' | 'lg';
    /**
     * default  — dark mark on a light background (main header)
     * inverted — light mark on a dark background (admin header)
     */
    variant?: 'default' | 'inverted';
    /** Hide the Altheon / Connect wordmark (icon-only mode) */
    showWordmark?: boolean;
    /** Show "Healthcare, finally connected." under the wordmark */
    showTagline?: boolean;
    /** Stack the wordmark under the mark instead of beside it */
    stacked?: boolean;
    className?: string;
}

const SIZES = { sm: 28, md: 36, lg: 48 } as const;

/**
 * The Altheon "A": two weighted strokes rising to a rounded apex, with the
 * crossbar drawn as an upward sweep rather than a flat bar — the join that
 * carries the "connected" idea. Everything is `currentColor`, so the mark
 * follows the surrounding theme in both light and dark.
 */
const Logo = ({
    size = 'md',
    variant = 'default',
    showWordmark = true,
    showTagline = false,
    stacked = false,
    className = '',
}: LogoProps) => {
    const { t } = useTranslation();

    if (USE_CLASSIC_MARK) {
        return <LogoClassic size={size} variant={variant} showWordmark={showWordmark} className={className} />;
    }

    const px = SIZES[size];
    const mod = variant === 'inverted' ? ' logo--inverted' : '';
    const stack = stacked ? ' altheon-logo--stacked' : '';

    return (
        <span className={`altheon-logo altheon-logo--v2${mod}${stack}${className ? ` ${className}` : ''}`}>
            <svg
                className="logo-mark"
                width={px}
                height={px}
                viewBox="0 0 48 48"
                fill="none"
                aria-hidden="true"
            >
                {/* Left stroke — sweeps out as it descends */}
                <path
                    className="logo-mark__leg"
                    d="M24 6.5 C 20.5 16, 14.5 31, 9 41.5"
                    strokeWidth="7"
                    strokeLinecap="round"
                />
                {/* Right stroke — mirrored */}
                <path
                    className="logo-mark__leg"
                    d="M24 6.5 C 27.5 16, 33.5 31, 39 41.5"
                    strokeWidth="7"
                    strokeLinecap="round"
                />
                {/* The join: an upward sweep where a flat crossbar would sit */}
                <path
                    className="logo-mark__link"
                    d="M15.5 31.5 C 19.5 27, 28.5 27, 32.5 31.5"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                />
            </svg>

            {showWordmark && (
                <span className="logo-wordmark logo-wordmark--v2" aria-label="Altheon Connect">
                    <span className="logo-name-v2">Altheon</span>
                    <span className="logo-sub-v2">Connect</span>
                    {showTagline && (
                        <span className="logo-tagline">{t('brand.tagline')}</span>
                    )}
                </span>
            )}
        </span>
    );
};

export default Logo;
