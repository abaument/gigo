/**
 * Client-side searchable / sortable adapter list.
 */

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdapterCard, type AdapterListItem } from '@/components/AdapterCard';

type SortKey = 'recent' | 'name' | 'calls';

interface AdapterListProps {
  adapters: AdapterListItem[];
}

export function AdapterList({ adapters }: AdapterListProps) {
  const t = useTranslations('dashboard');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = query
      ? adapters.filter(
          (a) =>
            a.name.toLowerCase().includes(query) ||
            (a.description ?? '').toLowerCase().includes(query)
        )
      : adapters;

    return [...matched].sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'calls':
          return b._count.logs - a._count.logs;
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [adapters, search, sort]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <svg
            className="w-4 h-4 text-clay absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="input pl-11"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="input w-auto"
        >
          <option value="recent">{t('sortRecent')}</option>
          <option value="name">{t('sortName')}</option>
          <option value="calls">{t('sortCalls')}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-taupe font-accent text-center py-10">{t('noResults')}</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((adapter) => (
            <AdapterCard key={adapter.id} adapter={adapter} />
          ))}
        </div>
      )}
    </div>
  );
}
