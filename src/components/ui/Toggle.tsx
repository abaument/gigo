/**
 * Switch toggle in the coffee/gold design system.
 */

'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export function Toggle({ checked, onChange, disabled = false, label, id }: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border
        transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed
        ${checked ? 'bg-amber border-amber' : 'bg-roast border-bark'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full transition-transform duration-300
          ${checked ? 'translate-x-6 bg-espresso' : 'translate-x-1 bg-clay'}`}
      />
    </button>
  );
}
