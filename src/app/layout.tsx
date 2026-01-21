/**
 * Root layout for GIGO V1 - Multi-tenant SaaS.
 *
 * Provides global styling, fonts, authentication context,
 * and responsive navigation.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { UserMenu } from '@/components/UserMenu';

export const metadata: Metadata = {
  title: 'GIGO - Garbage In, Gold Out',
  description: 'Transform chaotic JSON into perfectly structured data with AI',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div className="min-h-screen flex flex-col relative">
          <header className="border-b border-bark bg-coffee/80 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <nav className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-4 group">
                  {/* GIGO Logo */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber via-gold to-copper flex items-center justify-center shadow-lg group-hover:shadow-[0_0_30px_rgba(212,168,83,0.4)] transition-all duration-300">
                      <svg 
                        className="w-6 h-6 text-espresso" 
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
                  <div>
                    <h1 className="font-display text-2xl font-bold gigo-logo tracking-tight">
                      GIGO
                    </h1>
                    <p className="text-xs text-taupe font-accent tracking-wider">
                      Garbage In, Gold Out
                    </p>
                  </div>
                </Link>
                
                <div className="flex items-center gap-4">
                  <Link 
                    href="/adapters/new" 
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hidden sm:inline">New Adapter</span>
                  </Link>
                  <UserMenu />
                </div>
              </nav>
            </div>
          </header>
          
          <main className="flex-1 relative z-10">
            {children}
          </main>
          
          <footer className="border-t border-bark bg-coffee/60 py-8 relative z-10">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber to-copper flex items-center justify-center">
                    <svg 
                      className="w-4 h-4 text-espresso" 
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
                  <span className="font-display text-lg font-bold text-amber">GIGO</span>
                  <span className="text-taupe text-sm font-accent">V1</span>
                </div>
                <p className="text-taupe text-sm font-accent">
                  Transform messy data into structured gold ✨
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
