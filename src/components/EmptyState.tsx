/**
 * Empty state component displayed when no adapters exist.
 */

import Link from 'next/link';

export function EmptyState() {
  return (
    <div className="card p-16 text-center animate-fade-in">
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber/10 to-copper/5 border border-amber/20 flex items-center justify-center mx-auto mb-8">
        <svg 
          className="w-12 h-12 text-amber/60" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" 
          />
        </svg>
      </div>
      <h3 className="font-display text-2xl text-cream mb-3">
        No Adapters Yet
      </h3>
      <p className="text-taupe mb-8 max-w-md mx-auto font-accent leading-relaxed">
        Create your first adapter to start transforming messy JSON 
        into perfectly structured gold.
      </p>
      <Link href="/adapters/new" className="btn-primary inline-flex items-center gap-2">
        <svg 
          className="w-5 h-5" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 4v16m8-8H4" 
          />
        </svg>
        Create Your First Adapter
      </Link>
    </div>
  );
}
