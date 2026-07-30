/**
 * next-intl configuration — "without i18n routing" mode.
 * The locale comes from the NEXT_LOCALE cookie (set by the
 * LocaleSwitcher via the setLocale server action); no URL prefix, no
 * extra middleware, so the Supabase middleware keeps working unchanged.
 */

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale: Locale = cookieLocale === 'fr' ? 'fr' : 'en';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
