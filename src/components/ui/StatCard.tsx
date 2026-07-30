/**
 * Stat tile for dashboards (server-compatible: no hooks).
 */

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  tone?: 'default' | 'success' | 'error' | 'accent';
  icon?: React.ReactNode;
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-cream',
  success: 'text-sage',
  error: 'text-coral',
  accent: 'text-amber',
};

export function StatCard({ label, value, sublabel, tone = 'default', icon }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-accent uppercase tracking-wider text-taupe">{label}</span>
        {icon}
      </div>
      <div className={`font-display text-3xl ${toneClasses[tone]}`}>{value}</div>
      {sublabel && <div className="text-xs text-clay mt-1 font-accent">{sublabel}</div>}
    </div>
  );
}
