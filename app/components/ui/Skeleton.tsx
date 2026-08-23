import { classNames } from '~/utils/classNames';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/** Shimmering placeholder block — `--surface` base with a sweeping highlight, 1.4s loop. */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={classNames('rounded-md overflow-hidden relative', className)}
      style={{ background: 'var(--surface)', ...style }}
    >
      <div className="absolute inset-0 skeleton-shimmer" />
    </div>
  );
}
