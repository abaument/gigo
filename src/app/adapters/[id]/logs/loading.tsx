import { SkeletonCard } from '@/components/ui/SkeletonCard';

export default function LogsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <div className="h-10 w-80 rounded-lg loading-shimmer bg-coffee/60" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
      </div>
      <SkeletonCard className="h-96" />
    </div>
  );
}
