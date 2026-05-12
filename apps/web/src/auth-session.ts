const COOKIE_NAME = 'open_design_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function getSecret() {
  return process.env.OPEN_DESIGN_AUTH_SECRET || process.env.OPEN_DESIGN_AUTH_PASSWORD || '';
}

function getEncoder() {
  return new TextEncoder();
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeEquals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function sign(value: string) {
  const secret = getSecret();
  if (!secret) return '';
  const key = await crypto.subtle.importKey(
    'raw',
    getEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, getEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export function sessionCookieName() {
  return COOKIE_NAME;
}

export function sessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

export async function createSessionToken(now = Date.now()) {
  const expires = now + SESSION_TTL_SECONDS * 1000;
  const payload = `v1.${expires}`;
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null, now = Date.now()) {
  if (!token) return false;
  const [version, expiresRaw, signature] = token.split('.');
  if (!version || !expiresRaw || !signature || version !== 'v1') return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires <= now) return false;
  const payload = `${version}.${expiresRaw}`;
  const expected = await sign(payload);
  return Boolean(expected) && safeEquals(signature, expected);
}

export function authIsConfigured() {
  return Boolean(process.env.OPEN_DESIGN_AUTH_USER && process.env.OPEN_DESIGN_AUTH_PASSWORD);
}

export function credentialsAreValid(user: string, password: string) {
  const expectedUser = process.env.OPEN_DESIGN_AUTH_USER;
  const expectedPass = process.env.OPEN_DESIGN_AUTH_PASSWORD;
  return Boolean(expectedUser && expectedPass && safeEquals(user, expectedUser) && safeEquals(password, expectedPass));
}
