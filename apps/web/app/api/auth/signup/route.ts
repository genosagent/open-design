import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, sessionCookieName, sessionTtlSeconds } from '../../../../src/auth-session';
import { createUser, userStoreIsConfigured } from '../../../../src/user-store';

export const runtime = 'nodejs';

function safeNext(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function signupUrl(req: NextRequest, next: string, error?: string) {
  const url = new URL('/signup', req.url);
  if (next !== '/') url.searchParams.set('next', next);
  if (error) url.searchParams.set('error', error);
  return url;
}

function errorCode(error: unknown) {
  if (!(error instanceof Error)) return 'server';
  if (
    error.message === 'invalid_username' ||
    error.message === 'invalid_email' ||
    error.message === 'weak_password' ||
    error.message === 'username_taken' ||
    error.message === 'email_taken'
  ) {
    return error.message;
  }
  return 'server';
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const username = String(form.get('username') || '');
  const email = String(form.get('email') || '');
  const password = String(form.get('password') || '');
  const next = safeNext(form.get('next'));

  if (!userStoreIsConfigured()) {
    return NextResponse.redirect(signupUrl(req, next, 'disabled'), 303);
  }

  try {
    const user = await createUser({ username, email, password });
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
  } catch (error) {
    return NextResponse.redirect(signupUrl(req, next, errorCode(error)), 303);
  }
}
