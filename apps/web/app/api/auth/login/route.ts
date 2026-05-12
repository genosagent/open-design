import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, credentialsAreValid, sessionCookieName, sessionTtlSeconds } from '../../../../src/auth-session';

function safeNext(value: FormDataEntryValue | null) {
  const raw = typeof value === 'string' ? value : '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function loginUrl(req: NextRequest, next: string, error = false) {
  const url = new URL('/login', req.url);
  if (next !== '/') url.searchParams.set('next', next);
  if (error) url.searchParams.set('error', '1');
  return url;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const user = String(form.get('user') || '');
  const password = String(form.get('password') || '');
  const next = safeNext(form.get('next'));

  if (!credentialsAreValid(user, password)) {
    return NextResponse.redirect(loginUrl(req, next, true), 303);
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set({
    name: sessionCookieName(),
    value: await createSessionToken(),
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: sessionTtlSeconds(),
  });
  return res;
}
