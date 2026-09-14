/**
 * Auth callback: GET /auth/callback?code=...
 *
 * Target of Supabase email links (signup confirmation, password reset).
 * Exchanges the PKCE code for a session cookie, then lands the user on
 * the dashboard. Errors fall back to /login with a message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const providerError = searchParams.get('error_description');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login${providerError ? `?error=${encodeURIComponent(providerError)}` : ''}`
  );
}
