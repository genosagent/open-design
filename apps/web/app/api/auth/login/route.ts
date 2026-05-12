import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, legacyCredentialsAreValid, sessionCookieName, sessionTtlSeconds } from '../../../../src/auth-session';
import { verifyUserCredentials } from '../../../../src/user-store';

export const runtime = 'nodejs';

function safeNext(value: FormDataEntryValue | null) {
  const raw = typeof value === 'string' ? value : '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function loginUrl(req: NextRequest, next: string, error?: string) {
  const url = new URL('/login', req.url);
  if (next !== '/') url.searchParams.set('next', next);
  if (error) url.searchParams.set('error', error);
  return url;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const login = String(form.get('login') || form.get('user') || '');
  const password = String(form.get('password') || '');
  const next = safeNext(form.get('next'));

  let user: { id: string; username: string; role: string } | null = await verifyUserCredentials(login, password);
  if (!user && legacyCredentialsAreValid(login, password)) {
    user = { id: 'legacy-admin', username: login, role: 'admin' };
  }

  if (!user) {
    return NextResponse.redirect(loginUrl(req, next, 'invalid'), 303);
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set({
    name: sessionCookieName(),
    value: await createSessionToken(user),
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: sessionTtlSeconds(),
  });
  return res;
}
