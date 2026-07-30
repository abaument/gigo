/**
 * Pill tab bar (bg-roast track, amber active pill).
 */

'use client';

export interface TabItem<T extends string = string> {
  value: T;
  label: React.ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className = '' }: TabsProps<T>) {
  return (
    <div className={`inline-flex items-center gap-1 p-1 bg-roast border border-bark rounded-lg ${className}`}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`px-4 py-2 rounded-md text-sm font-accent transition-all duration-200
            ${
              value === item.value
                ? 'bg-amber text-espresso font-semibold'
                : 'text-taupe hover:text-cream hover:bg-bark/50'
            }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
