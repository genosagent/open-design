const COOKIE_NAME = 'open_design_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

type SessionPayload = {
  v: 1;
  sub: string;
  username: string;
  role: string;
  exp: number;
};

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

function hexToBytes(value: string) {
  if (value.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function safeHexEquals(a: string, b: string) {
  const aBytes = hexToBytes(a);
  const bBytes = hexToBytes(b);
  if (aBytes.length !== bBytes.length || aBytes.length === 0) return false;
  let out = 0;
  for (let i = 0; i < aBytes.length; i += 1) out |= aBytes[i]! ^ bBytes[i]!;
  return out === 0;
}

function safeStringEquals(a: string, b: string) {
  const encoder = getEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length || aBytes.length === 0) return false;
  let out = 0;
  for (let i = 0; i < aBytes.length; i += 1) out |= aBytes[i]! ^ bBytes[i]!;
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

export async function createSessionToken(user: { id: string; username: string; role: string }, now = Date.now()) {
  const payload: SessionPayload = {
    v: 1,
    sub: user.id,
    username: user.username,
    role: user.role,
    exp: now + SESSION_TTL_SECONDS * 1000,
  };
  const encodedPayload = bytesToBase64Url(getEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload);
  return `v1.${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null, now = Date.now()) {
  if (!token) return false;
  const [version, encodedPayload, signature] = token.split('.');
  if (version !== 'v1' || !encodedPayload || !signature) return false;
  const expected = await sign(encodedPayload);
  if (!expected || !safeHexEquals(signature, expected)) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload))) as Partial<SessionPayload>;
    return payload.v === 1 && typeof payload.exp === 'number' && payload.exp > now && Boolean(payload.sub);
  } catch {
    return false;
  }
}

export function authIsConfigured() {
  return Boolean(
    process.env.OPEN_DESIGN_AUTH_SECRET ||
      process.env.OPEN_DESIGN_AUTH_PASSWORD ||
      process.env.OPEN_DESIGN_USER_STORE_GITHUB_TOKEN ||
      process.env.OPEN_DESIGN_USER_STORE_FILE,
  );
}

export function legacyCredentialsAreValid(user: string, password: string) {
  const expectedUser = process.env.OPEN_DESIGN_AUTH_USER;
  const expectedPass = process.env.OPEN_DESIGN_AUTH_PASSWORD;
  return Boolean(expectedUser && expectedPass && safeStringEquals(user, expectedUser) && safeStringEquals(password, expectedPass));
}
