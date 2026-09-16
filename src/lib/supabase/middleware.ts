/**
 * Supabase middleware client for Next.js middleware.
 *
 * Handles session refresh on every request to keep auth state fresh.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Update the Supabase session in middleware.
 *
 * This function refreshes the auth token if needed and sets
 * the updated cookies on the response.
 *
 * Parameters
 * ----------
 * request : NextRequest
 *     Incoming Next.js request object.
 *
 * Returns
 * -------
 * NextResponse
 *     Response object with updated auth cookies.
 */
/**
 * Redirect without dropping a token that was just refreshed: a bare
 * `NextResponse.redirect` starts from a blank cookie jar, so any cookie
 * Supabase set on `supabaseResponse` has to be copied over.
 */
function redirectKeepingSession(url: URL, carrying: NextResponse) {
  const response = NextResponse.redirect(url);
  carrying.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // `?lang=fr` (or `en`) pins the language for a shared link: the cookie
  // next-intl reads is written here, then the parameter is dropped.
  const lang = request.nextUrl.searchParams.get('lang');
  if (lang === 'fr' || lang === 'en') {
    const url = request.nextUrl.clone();
    url.searchParams.delete('lang');
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    response.cookies.set('NEXT_LOCALE', lang, { maxAge: 31_536_000, path: '/' });
    return response;
  }

  // Refresh session - important for keeping auth state fresh.
  // A visitor with no session cookie is anonymous by definition, so the
  // public landing never waits on (or fails with) the auth service. The
  // shortcut is negative only: any request carrying the cookie is still
  // verified against Supabase.
  const hasSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));

  let user = null;
  if (hasSessionCookie) {
    try {
      const result = await supabase.auth.getUser();
      user = result.data.user;
    } catch {
      // auth service unreachable: degrade to anonymous rather than 500
      user = null;
    }
  }

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/adapters', '/settings'];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  const authPaths = ['/login', '/signup'];
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // The landing at `/` is for visitors; a signed-in user goes straight
  // to their dashboard. `?preview=1` overrides it, so the landing can be
  // shown from an account that is already logged in.
  if (
    request.nextUrl.pathname === '/' &&
    user &&
    request.nextUrl.searchParams.get('preview') !== '1'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return redirectKeepingSession(url, supabaseResponse);
  }

  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return redirectKeepingSession(url, supabaseResponse);
  }

  return supabaseResponse;
}
