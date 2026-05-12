import { NextRequest, NextResponse } from 'next/server';
import { sessionCookieName } from '../../../../src/auth-session';

function clearSession(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url), 303);
  res.cookies.set({ name: sessionCookieName(), value: '', httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', path: '/', maxAge: 0 });
  return res;
}

export async function POST(req: NextRequest) {
  return clearSession(req);
}

export async function GET(req: NextRequest) {
  return clearSession(req);
}
