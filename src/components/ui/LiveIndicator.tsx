/**
 * Pulsing "live" dot with label — used by the auto-refreshing logs view.
 */

'use client';

interface LiveIndicatorProps {
  active: boolean;
  label: string;
  onToggle?: () => void;
}

export function LiveIndicator({ active, label, onToggle }: LiveIndicatorProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-accent
        transition-colors ${
          active
            ? 'border-sage/40 text-sage bg-sage/10'
            : 'border-bark text-taupe bg-roast hover:text-cream'
        }`}
      title={label}
    >
      <span className="relative flex h-2 w-2">
        {active && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage opacity-60" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${active ? 'bg-sage' : 'bg-clay'}`}
        />
      </span>
      {label}
    </button>
  );
}
