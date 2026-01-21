/**
 * Supabase browser client for client-side authentication.
 *
 * This client is used in React components and client-side code.
 * It automatically handles session management and token refresh.
 */

import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for browser/client-side usage.
 *
 * Returns
 * -------
 * SupabaseClient
 *     Configured Supabase client instance for browser context.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
