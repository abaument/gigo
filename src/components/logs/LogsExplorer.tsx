/**
 * Logs explorer — orchestrates server-side filtering, cursor pagination
 * and 10s live polling (prepend + dedup; paused while the tab is hidden
 * or the drawer is open). No router.refresh(): it would wipe the
 * accumulated pagination state.
 */

'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { getAdapterLogs, type LogListItem } from '@/lib/actions';
import {
  DEFAULT_FILTERS,
  LogsFilters,
  presetToFromDate,
  type LogsFilterState,
} from './LogsFilters';
import { LogsTable } from '@/components/LogsTable';
import { LogDetailDrawer } from '@/components/LogDetailDrawer';
import { LiveIndicator } from '@/components/ui/LiveIndicator';

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 10_000;

interface LogsExplorerProps {
  adapterId: string;
  initialLogs: LogListItem[];
  initialCursor: string | null;
}

function buildQuery(filters: LogsFilterState, cursor?: string | null) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    filters.traceId.trim()
  );
  return {
    take: PAGE_SIZE,
    status: filters.status,
    from: presetToFromDate(filters.preset),
    traceId: isUuid ? filters.traceId.trim() : undefined,
    includeTests: filters.includeTests,
    ...(cursor ? { cursor } : {}),
  };
}

export function LogsExplorer({ adapterId, initialLogs, initialCursor }: LogsExplorerProps) {
  const t = useTranslations('logs');
  const [logs, setLogs] = useState<LogListItem[]>(initialLogs);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [filters, setFilters] = useState<LogsFilterState>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<LogListItem | null>(null);
  const [live, setLive] = useState(true);
  const [isFiltering, startFilterTransition] = useTransition();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const drawerOpenRef = useRef(false);
  drawerOpenRef.current = selected !== null;
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(
    (nextFilters: LogsFilterState) => {
      startFilterTransition(async () => {
        const result = await getAdapterLogs(adapterId, buildQuery(nextFilters));
        setLogs(result.logs);
        setNextCursor(result.nextCursor);
      });
    },
    [adapterId]
  );

  const handleFiltersChange = (next: LogsFilterState) => {
    const traceChanged = next.traceId !== filters.traceId;
    setFilters(next);
    if (traceChanged) {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
      searchDebounce.current = setTimeout(() => refetch(next), 400);
    } else {
      refetch(next);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await getAdapterLogs(adapterId, buildQuery(filters, nextCursor));
      setLogs((prev) => {
        const known = new Set(prev.map((l) => l.id));
        return [...prev, ...result.logs.filter((l) => !known.has(l.id))];
      });
      setNextCursor(result.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Live polling: prepend fresh rows, dedup by id.
  useEffect(() => {
    if (!live) return;
    const interval = setInterval(async () => {
      if (document.visibilityState === 'hidden' || drawerOpenRef.current) return;
      try {
        const result = await getAdapterLogs(adapterId, {
          ...buildQuery(filtersRef.current),
          take: 20,
        });
        setLogs((prev) => {
          const known = new Set(prev.map((l) => l.id));
          const fresh = result.logs.filter((l) => !known.has(l.id));
          return fresh.length > 0 ? [...fresh, ...prev] : prev;
        });
      } catch {
        // transient failure — next tick will retry
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [adapterId, live]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <LogsFilters filters={filters} onChange={handleFiltersChange} />
        <LiveIndicator
          active={live}
          label={live ? t('live') : t('paused')}
          onToggle={() => setLive((v) => !v)}
        />
      </div>

      <LogsTable
        logs={logs}
        onSelect={setSelected}
        isLoading={isFiltering}
        hasMore={nextCursor !== null}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
      />

      {selected && (
        <LogDetailDrawer
          log={selected}
          onClose={() => setSelected(null)}
          onReplayed={() => {
            setSelected(null);
            refetch(filters);
          }}
        />
      )}
    </div>
  );
}
