import type { NextRequest } from 'next/server';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function cleanBaseUrl(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, '') || '';
  return trimmed || null;
}

function daemonBaseUrl() {
  return cleanBaseUrl(process.env.OPEN_DESIGN_DAEMON_URL || process.env.OD_DAEMON_URL);
}

function daemonToken() {
  return process.env.OPEN_DESIGN_DAEMON_TOKEN || process.env.OD_DAEMON_TOKEN || '';
}

function filteredRequestHeaders(req: NextRequest) {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    if (lower === 'host' || lower === 'cookie' || lower === 'authorization') return;
    headers.set(key, value);
  });

  const token = daemonToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  headers.set('x-open-design-proxy', 'vercel');
  return headers;
}

function filteredResponseHeaders(upstream: Response) {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    headers.set(key, value);
  });
  return headers;
}

export async function proxyToDaemon(req: NextRequest, prefix: 'api' | 'artifacts' | 'frames', path: string[] = []) {
  const base = daemonBaseUrl();
  if (!base) {
    return new Response('Open Design daemon URL is not configured', { status: 503 });
  }

  const upstreamUrl = new URL(`${base}/${prefix}/${path.map(encodeURIComponent).join('/')}`);
  upstreamUrl.search = req.nextUrl.search;

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers: filteredRequestHeaders(req),
    cache: 'no-store',
    redirect: 'manual',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
    init.duplex = 'half';
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Open Design daemon unreachable: ${message}`, { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: filteredResponseHeaders(upstream),
  });
}
