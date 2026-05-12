import { NextRequest, NextResponse } from 'next/server';

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Open Design"' },
  });
}

function safeEquals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function proxy(req: NextRequest) {
  const user = process.env.OPEN_DESIGN_AUTH_USER;
  const pass = process.env.OPEN_DESIGN_AUTH_PASSWORD;

  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Basic ')) return unauthorized();

  try {
    const decoded = atob(auth.slice('Basic '.length));
    const separator = decoded.indexOf(':');
    if (separator === -1) return unauthorized();
    const givenUser = decoded.slice(0, separator);
    const givenPass = decoded.slice(separator + 1);
    if (safeEquals(givenUser, user) && safeEquals(givenPass, pass)) return NextResponse.next();
  } catch {
    return unauthorized();
  }

  return unauthorized();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
