// src/shared/components/Avatar.tsx
//
// Avatar with photo + initials fallback.
//
// Render rules:
//   - If `src` is provided AND the image successfully loads → show photo.
//   - If `src` is missing, empty, OR fails to load → show initials.
// The fallback is automatic and graceful: a broken/expired signed URL just
// reverts to initials, never a broken-image icon.
//
// Used everywhere a doctor or patient identity is shown (sidebar, dashboard,
// patient list, appointments, referrals, …).

import { useState, useEffect } from 'react';

interface AvatarProps {
    name: string;
    src?: string | null;            // optional photo URL (signed)
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    ring?: boolean;
}

function getInitials(name: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, src, size = 'md', className = '', ring = false }: AvatarProps) {
    const sizeClass = `avatar-${size}`;
    const wrapperClass =
        `avatar ${sizeClass}${ring ? ' avatar-ring' : ''}${className ? ' ' + className : ''}`;

    // Treat falsy / empty / whitespace-only as no-photo.
    const hasSrc = typeof src === 'string' && src.trim().length > 0;
    const [errored, setErrored] = useState(false);

    // If the URL changes (e.g. after a fresh upload), give the new image
    // another chance to load — clear the error state.
    useEffect(() => { setErrored(false); }, [src]);

    const showPhoto = hasSrc && !errored;

    return (
        <div className={wrapperClass} aria-label={name} title={name}>
            {showPhoto ? (
                <img
                    src={src as string}
                    alt=""
                    className="avatar-photo"
                    onError={() => setErrored(true)}
                    draggable={false}
                />
            ) : (
                getInitials(name)
            )}
        </div>
    );
}

export default Avatar;
