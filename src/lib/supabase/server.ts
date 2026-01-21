/**
 * Supabase server client for server-side authentication.
 *
 * This client is used in Server Components, Server Actions,
 * and API routes. It handles cookies for session management.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Create a Supabase client for server-side usage.
 *
 * Handles cookie management for authentication state persistence
 * across server-rendered pages and API routes.
 *
 * Returns
 * -------
 * SupabaseClient
 *     Configured Supabase client instance for server context.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Create a Supabase admin client with service role privileges.
 *
 * Use this client for operations that require bypassing RLS,
 * such as user management or system-level operations.
 *
 * Returns
 * -------
 * SupabaseClient
 *     Configured Supabase client with admin privileges.
 *
 * Notes
 * -----
 * CAUTION: This bypasses Row Level Security. Use only when necessary.
 */
export async function createAdminClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in Server Component context
          }
        },
      },
    }
  );
}
