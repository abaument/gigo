import { SkeletonCard } from '@/components/ui/SkeletonCard';

export default function NewAdapterLoading() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="h-10 w-72 rounded-lg loading-shimmer bg-coffee/60 mb-10" />
      <div className="space-y-8">
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-72" />
        <SkeletonCard className="h-40" />
      </div>
    </div>
  );
}
