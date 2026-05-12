import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, sessionCookieName, signupCodeIsValid, signupIsConfigured } from '../../../../src/auth-session';

function safeNext(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export async function POST(req: NextRequest) {
  if (!signupIsConfigured()) {
    return NextResponse.redirect(new URL('/signup?error=disabled', req.url), 303);
  }

  const form = await req.formData();
  const code = String(form.get('code') ?? '');
  const next = safeNext(form.get('next'));

  if (!signupCodeIsValid(code)) {
    const url = new URL('/signup', req.url);
    url.searchParams.set('error', 'invalid');
    if (next !== '/') url.searchParams.set('next', next);
    return NextResponse.redirect(url, 303);
  }

  const token = await createSessionToken();
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set({
    name: sessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
