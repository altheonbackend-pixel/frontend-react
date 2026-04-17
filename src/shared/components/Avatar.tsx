// src/shared/components/Avatar.tsx

interface AvatarProps {
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    ring?: boolean;
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 'md', className = '', ring = false }: AvatarProps) {
    const sizeClass = `avatar-${size}`;
    return (
        <div
            className={`avatar ${sizeClass}${ring ? ' avatar-ring' : ''}${className ? ' ' + className : ''}`}
            aria-label={name}
            title={name}
        >
            {getInitials(name)}
        </div>
    );
}

export default Avatar;
