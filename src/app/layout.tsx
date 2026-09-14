/**
 * Root layout — global styling, i18n provider, toast system and
 * responsive navigation.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import './globals.css';
import { UserMenu } from '@/components/UserMenu';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { ToastProvider } from '@/components/ui/ToastProvider';

export const metadata: Metadata = {
  title: 'GIGO - Garbage In, Gold Out',
  description: 'Transform chaotic JSON into perfectly structured data with AI',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations('nav');

  return (
    <html lang={locale} className="dark">
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>
            <div className="min-h-screen flex flex-col relative">
              <header className="border-b border-bark bg-coffee/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                  <nav className="flex items-center justify-between gap-3">
                    <Link href="/" className="flex items-center gap-3 sm:gap-4 group min-w-0">
                      {/* GIGO Logo */}
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber via-gold to-copper flex items-center justify-center shadow-lg group-hover:shadow-[0_0_30px_rgba(212,168,83,0.4)] transition-all duration-300">
                          <svg
                            className="w-5 h-5 sm:w-6 sm:h-6 text-espresso"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </div>
                        <div className="absolute inset-0 rounded-xl bg-amber/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <div className="min-w-0">
                        <h1 className="font-display text-xl sm:text-2xl font-bold gigo-logo tracking-tight">
                          GIG<span>O</span>
                        </h1>
                        <p className="text-xs text-taupe font-accent tracking-wider hidden sm:block">
                          {t('tagline')}
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      <Link
                        href="/how-to"
                        className="text-sm text-taupe hover:text-amber font-accent transition-colors hidden md:block"
                      >
                        {t('howTo')}
                      </Link>
                      <Link
                        href="/adapters/new"
                        className="btn-primary text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="hidden sm:inline">{t('newAdapter')}</span>
                      </Link>
                      <LocaleSwitcher />
                      <UserMenu />
                    </div>
                  </nav>
                </div>
              </header>

              <main className="flex-1 relative z-10">{children}</main>

              <footer className="border-t border-bark bg-coffee/60 py-6 relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-display text-lg font-bold text-cream">
                        GIG<span className="text-amber">O</span>
                      </span>
                      <span className="text-taupe text-sm font-accent">{t('tagline')}</span>
                    </div>
                    <Link
                      href="/how-to"
                      className="text-sm text-taupe hover:text-amber font-accent transition-colors"
                    >
                      {t('howTo')}
                    </Link>
                  </div>
                </div>
              </footer>
            </div>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
