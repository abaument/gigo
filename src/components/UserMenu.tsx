/**
 * User menu component with auth state and sign out.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function UserMenu() {
  const t = useTranslations('nav');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-bark animate-pulse" />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/login" className="btn-secondary text-sm py-2">
          {t('signIn')}
        </Link>
        <Link href="/signup" className="btn-primary text-sm py-2">
          {t('getStarted')}
        </Link>
      </div>
    );
  }

  const initials = user.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-roast transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber to-copper flex items-center justify-center text-espresso text-sm font-bold">
          {initials}
        </div>
        <span className="text-sm text-sand font-accent hidden md:block max-w-32 truncate">
          {user.user_metadata?.full_name || user.email}
        </span>
        <svg 
          className={`w-4 h-4 text-taupe transition-transform ${menuOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setMenuOpen(false)} 
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 card p-2 z-50 animate-fade-in">
            <div className="px-3 py-2 border-b border-bark mb-2">
              <p className="text-sm font-accent text-cream truncate">
                {user.user_metadata?.full_name || 'User'}
              </p>
              <p className="text-xs text-taupe truncate">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-coral hover:bg-coral/10 rounded-lg transition-colors font-accent"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('signOut')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
