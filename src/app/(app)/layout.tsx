/**
 * Application chrome — header and footer shared by every signed-in
 * surface (dashboard, adapters, settings, how-to). The public landing
 * at `/` sits outside this group and brings its own chrome.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { UserMenu } from '@/components/UserMenu';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [t, cookieStore] = await Promise.all([getTranslations('nav'), cookies()]);
  // `/how-to` is public, so this header is also served to visitors. Which
  // buttons to show is cosmetic, never an authorization decision, so a
  // cookie sniff is enough and costs no round trip.
  const signedIn = cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));

  return (
    <div className="min-h-screen flex flex-col relative">
      <header className="border-b border-bark bg-coffee/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <nav className="flex items-center justify-between gap-3">
            <Link href={signedIn ? '/dashboard' : '/'} className="flex items-center gap-3 sm:gap-4 group min-w-0">
              {/* GIGO Logo */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber via-gold to-copper flex items-center justify-center shadow-lg group-hover:shadow-[0_0_30px_rgba(212,168,83,0.4)] transition-all duration-300">
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-espresso"
                    viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.554 19.5Q11.88 19.5 11.454 19.073Q11.027 18.647 11.027 17.973V13.332Q11.027 12.898 10.623 12.898H8.901V11.102H10.623Q11.027 11.102 11.027 10.668V6.027Q11.027 5.353 11.454 4.927Q11.88 4.5 12.554 4.5H15.099V6.117H13.257Q12.853 6.117 12.853 6.566V10.668Q12.853 11.177 12.531 11.521Q12.21 11.865 11.686 11.865H11.446V12.135H11.686Q12.21 12.135 12.531 12.479Q12.853 12.823 12.853 13.332V17.434Q12.853 17.883 13.257 17.883H15.099V19.5Z" />
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
              {signedIn && (
                <Link href="/adapters/new" className="btn-primary text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">{t('newAdapter')}</span>
                </Link>
              )}
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
  );
}
