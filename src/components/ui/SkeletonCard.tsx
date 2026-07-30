/**
 * Shimmer skeleton block for loading.tsx files (server-compatible).
 */

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = 'h-32' }: SkeletonCardProps) {
  return <div className={`card loading-shimmer bg-coffee/60 ${className}`} />;
}
