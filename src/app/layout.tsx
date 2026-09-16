/**
 * Root layout — document shell, global styling, i18n provider and toast
 * system. Page chrome (header, footer) belongs to the route groups:
 * `(app)` for the signed-in product, none for the public landing.
 */

import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
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

  return (
    <html lang={locale} className="dark">
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
