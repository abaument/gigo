import { SkeletonCard } from '@/components/ui/SkeletonCard';

export default function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="h-10 w-64 rounded-lg loading-shimmer bg-coffee/60 mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
      </div>
      <div className="space-y-4">
        <SkeletonCard className="h-48" />
        <SkeletonCard className="h-48" />
        <SkeletonCard className="h-48" />
      </div>
    </div>
  );
}
