/**
 * FR/EN language switcher — sets the NEXT_LOCALE cookie via the
 * setLocale server action, then refreshes the tree.
 */

'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from '@/lib/actions';

const LOCALES = ['en', 'fr'] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: 'en' | 'fr') => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 bg-roast border border-bark rounded-lg">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          disabled={isPending}
          className={`px-2.5 py-1 rounded-md text-xs font-accent uppercase transition-all duration-200
            ${
              locale === l
                ? 'bg-amber text-espresso font-semibold'
                : 'text-taupe hover:text-cream'
            } disabled:opacity-60`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
