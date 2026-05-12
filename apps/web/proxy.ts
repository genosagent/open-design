import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authIsConfigured, sessionCookieName, verifySessionToken } from './src/auth-session';

const PUBLIC_FILE = /\.[^/]+$/;
const ALLOWED_PATHS = new Set(['/login', '/api/auth/login', '/api/auth/logout']);

function isBypassed(pathname: string) {
  return (
    ALLOWED_PATHS.has(pathname) ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/app-icon') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/avatar') ||
    pathname.startsWith('/od-notifications-sw') ||
    PUBLIC_FILE.test(pathname)
  );
}

function loginUrl(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  const next = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (next !== '/') url.searchParams.set('next', next);
  return url;
}

export async function proxy(req: NextRequest) {
  if (!authIsConfigured()) return NextResponse.next();
  if (isBypassed(req.nextUrl.pathname)) return NextResponse.next();

  const token = req.cookies.get(sessionCookieName())?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  return NextResponse.redirect(loginUrl(req));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
