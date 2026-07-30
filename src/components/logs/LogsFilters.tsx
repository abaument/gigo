/**
 * Server-side log filters: status tabs, date presets, trace-ID search,
 * include-tests checkbox.
 */

'use client';

import { useTranslations } from 'next-intl';
import { Tabs } from '@/components/ui/Tabs';

export type StatusFilter = 'all' | 'success' | 'error';
export type DatePreset = 'all' | '1h' | '24h' | '7d' | '30d';

export interface LogsFilterState {
  status: StatusFilter;
  preset: DatePreset;
  traceId: string;
  includeTests: boolean;
}

export const DEFAULT_FILTERS: LogsFilterState = {
  status: 'all',
  preset: 'all',
  traceId: '',
  includeTests: true,
};

export function presetToFromDate(preset: DatePreset): Date | undefined {
  const hours: Record<Exclude<DatePreset, 'all'>, number> = {
    '1h': 1,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30,
  };
  if (preset === 'all') return undefined;
  return new Date(Date.now() - hours[preset] * 3600 * 1000);
}

interface LogsFiltersProps {
  filters: LogsFilterState;
  onChange: (filters: LogsFilterState) => void;
}

export function LogsFilters({ filters, onChange }: LogsFiltersProps) {
  const t = useTranslations('logs');

  const set = <K extends keyof LogsFilterState>(key: K, value: LogsFilterState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Tabs<StatusFilter>
        value={filters.status}
        onChange={(status) => set('status', status)}
        items={[
          { value: 'all', label: t('filterAll') },
          { value: 'success', label: t('filterSuccess') },
          { value: 'error', label: t('filterError') },
        ]}
      />

      <select
        value={filters.preset}
        onChange={(e) => set('preset', e.target.value as DatePreset)}
        className="input w-auto py-2 text-sm"
      >
        <option value="all">{t('presetAll')}</option>
        <option value="1h">{t('preset1h')}</option>
        <option value="24h">{t('preset24h')}</option>
        <option value="7d">{t('preset7d')}</option>
        <option value="30d">{t('preset30d')}</option>
      </select>

      <input
        type="search"
        value={filters.traceId}
        onChange={(e) => set('traceId', e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="input w-auto flex-1 min-w-[200px] py-2 text-sm font-mono"
      />

      <label className="flex items-center gap-2 cursor-pointer text-sm text-taupe font-accent">
        <input
          type="checkbox"
          checked={filters.includeTests}
          onChange={(e) => set('includeTests', e.target.checked)}
          className="accent-amber w-4 h-4"
        />
        {t('includeTests')}
      </label>
    </div>
  );
}
