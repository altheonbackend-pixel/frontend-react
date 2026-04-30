interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = '6px',
  className = '',
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ padding: '1.25rem', background: 'var(--color-surface)', borderRadius: '12px' }}>
            <Skeleton height="0.75rem" width="60%" />
            <div style={{ marginTop: '0.75rem' }}>
              <Skeleton height="2rem" width="40%" />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ padding: '1.25rem', background: 'var(--color-surface)', borderRadius: '12px' }}>
          <Skeleton height="1rem" width="50%" />
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="3.5rem" />
            ))}
          </div>
        </div>
        <div style={{ padding: '1.25rem', background: 'var(--color-surface)', borderRadius: '12px' }}>
          <Skeleton height="1rem" width="50%" />
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="3.5rem" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PatientListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            background: 'var(--color-surface)',
            borderRadius: '8px',
          }}
        >
          <Skeleton width="40px" height="40px" borderRadius="50%" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Skeleton height="0.875rem" width="35%" />
            <Skeleton height="0.75rem" width="55%" />
          </div>
          <Skeleton height="1.5rem" width="60px" borderRadius="20px" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  rows?: number;
  avatar?: boolean;
}

export function SkeletonCard({ rows = 3, avatar = false }: SkeletonCardProps) {
  return (
    <div
      style={{
        padding: '1rem',
        background: 'var(--color-surface)',
        borderRadius: '10px',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
      }}
    >
      {avatar && <Skeleton width="40px" height="40px" borderRadius="50%" />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} height="0.875rem" width={i === 0 ? '45%' : i === rows - 1 ? '30%' : '75%'} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5, avatar = false }: { count?: number; avatar?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} avatar={avatar} />
      ))}
    </div>
  );
}

export function PatientDetailSkeleton() {
  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <Skeleton width="80px" height="80px" borderRadius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <Skeleton height="1.5rem" width="40%" />
          <Skeleton height="0.875rem" width="60%" />
          <Skeleton height="0.875rem" width="45%" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height="2rem" width="90px" borderRadius="20px" />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height="4rem" />
        ))}
      </div>
    </div>
  );
}
