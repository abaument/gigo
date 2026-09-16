/**
 * Public site chrome. Deliberately thin: a floating masthead and a
 * one-line colophon, so the landing keeps the full viewport for its own
 * composition. The product chrome lives in `(app)/layout.tsx`.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { REPO_URL } from '@/lib/constants';

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('landing');

  return (
    <div className="min-h-screen flex flex-col relative">
      <header className="sticky top-0 z-50 border-b border-bark/60 bg-espresso/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3 group min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber via-gold to-copper shadow-lg transition-shadow duration-300 group-hover:shadow-[0_0_24px_rgba(212,168,83,0.45)]">
              <svg
                className="h-4.5 w-4.5 text-espresso"
                width="18"
                height="18"
                viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.554 19.5Q11.88 19.5 11.454 19.073Q11.027 18.647 11.027 17.973V13.332Q11.027 12.898 10.623 12.898H8.901V11.102H10.623Q11.027 11.102 11.027 10.668V6.027Q11.027 5.353 11.454 4.927Q11.88 4.5 12.554 4.5H15.099V6.117H13.257Q12.853 6.117 12.853 6.566V10.668Q12.853 11.177 12.531 11.521Q12.21 11.865 11.686 11.865H11.446V12.135H11.686Q12.21 12.135 12.531 12.479Q12.853 12.823 12.853 13.332V17.434Q12.853 17.883 13.257 17.883H15.099V19.5Z" />
              </svg>
            </span>
            <span className="font-display text-xl font-bold gigo-logo tracking-tight">
              GIG<span>O</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/how-to"
              className="hidden font-accent text-sm text-taupe transition-colors hover:text-amber sm:block"
            >
              {t('nav.howTo')}
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="hidden font-accent text-sm text-taupe transition-colors hover:text-amber md:block"
            >
              {t('nav.code')}
            </a>
            <LocaleSwitcher />
            <Link
              href="/login"
              className="hidden font-accent text-sm text-sand transition-colors hover:text-cream sm:block"
            >
              {t('nav.signIn')}
            </Link>
            <Link href="/signup" className="btn-primary text-sm px-4 py-2">
              {t('nav.try')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 relative z-10">{children}</main>

      <footer className="border-t border-bark/60 py-8 relative z-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold text-cream">
              GIG<span className="text-amber">O</span>
            </span>
            <span className="font-accent text-sm text-taupe">{t('footer.tagline')}</span>
          </div>
          <div className="flex items-center gap-5 font-accent text-sm text-taupe">
            <span>{t('footer.license')}</span>
            <Link href="/how-to" className="transition-colors hover:text-amber">
              {t('footer.howTo')}
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-amber"
            >
              {t('footer.code')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
