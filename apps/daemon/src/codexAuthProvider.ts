import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ConnectionTestResponse } from '@open-design/contracts/api/connectionTest';
import type { ProviderModelOption, ProviderModelsResponse } from '@open-design/contracts/api/providerModels';

const CODEX_DEFAULT_BASE_URL = 'https://chatgpt.com/backend-api/codex';
const CODEX_CLIENT_VERSION = '0.0.0';
const CODEX_USER_AGENT = 'codex_cli_rs/0.0.0 (Open Design)';
const CODEX_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const CODEX_OAUTH_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const CODEX_TIMEOUT_MS = 12_000;
const SMOKE_PROMPT = 'Reply with only: ok';

export const CODEX_FALLBACK_MODELS: ProviderModelOption[] = [
  { id: 'gpt-5.5', label: 'GPT-5.5' },
  { id: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
  { id: 'gpt-5.2', label: 'GPT-5.2' },
  { id: 'gpt-5.1', label: 'GPT-5.1' },
  { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini' },
  { id: 'gpt-5-codex', label: 'GPT-5 Codex' },
  { id: 'gpt-5', label: 'GPT-5' },
  { id: 'o4-mini', label: 'o4-mini' },
  { id: 'o3', label: 'o3' },
];

interface CodexCredential {
  accessToken: string;
  baseUrl: string;
  accountId?: string;
  refreshToken?: string;
}

function codexCredential(accessToken: string, baseUrl: string, refreshToken?: string): CodexCredential {
  const accountId = accountIdFromToken(accessToken);
  return {
    accessToken,
    baseUrl,
    ...(accountId ? { accountId } : {}),
    ...(refreshToken ? { refreshToken } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const parsed = JSON.parse(Buffer.from(padded, 'base64url').toString('utf8'));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function accountIdFromToken(token: string): string | undefined {
  const payload = jwtPayload(token);
  if (!payload) return undefined;
  const nested = payload['https://api.openai.com/auth'];
  if (isRecord(nested) && typeof nested.chatgpt_account_id === 'string') return nested.chatgpt_account_id;
  const flat = payload['https://api.openai.com/auth.chatgpt_account_id'];
  if (typeof flat === 'string') return flat;
  const account = payload.chatgpt_account_id;
  return typeof account === 'string' ? account : undefined;
}

function tokenFromObject(value: unknown): string {
  if (!isRecord(value)) return '';
  const token = value.access_token ?? value.accessToken;
  return typeof token === 'string' ? token : '';
}

function refreshTokenFromObject(value: unknown): string {
  if (!isRecord(value)) return '';
  const token = value.refresh_token ?? value.refreshToken;
  return typeof token === 'string' ? token : '';
}

function baseUrlFromObject(value: unknown): string {
  if (!isRecord(value)) return '';
  const baseUrl = value.base_url ?? value.baseUrl;
  return typeof baseUrl === 'string' ? baseUrl : '';
}

function credentialFromAuthJson(auth: Record<string, unknown>): CodexCredential | null {
  const pool = auth.credential_pool;
  if (isRecord(pool)) {
    const entries = pool['openai-codex'];
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const accessToken = tokenFromObject(entry);
        if (!accessToken) continue;
        const baseUrl = baseUrlFromObject(entry) || CODEX_DEFAULT_BASE_URL;
        return codexCredential(accessToken, baseUrl, refreshTokenFromObject(entry));
      }
    }
  }

  const providers = auth.providers;
  if (isRecord(providers)) {
    const openaiCodex = providers['openai-codex'];
    if (isRecord(openaiCodex)) {
      const accessToken = tokenFromObject(openaiCodex.tokens);
      if (accessToken) return codexCredential(accessToken, CODEX_DEFAULT_BASE_URL, refreshTokenFromObject(openaiCodex.tokens));
    }
  }

  const legacy = auth['openai-codex'];
  if (isRecord(legacy)) {
    const accessToken = tokenFromObject(legacy.tokens) || tokenFromObject(legacy);
    if (accessToken) {
      const baseUrl = baseUrlFromObject(legacy) || CODEX_DEFAULT_BASE_URL;
      return codexCredential(accessToken, baseUrl, refreshTokenFromObject(legacy.tokens) || refreshTokenFromObject(legacy));
    }
  }

  const accessToken = tokenFromObject(auth.tokens);
  if (accessToken) return codexCredential(accessToken, CODEX_DEFAULT_BASE_URL, refreshTokenFromObject(auth.tokens));
  return null;
}

function credentialFromUserSecret(secret: string): CodexCredential | null {
  const trimmed = secret.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return isRecord(parsed) ? credentialFromAuthJson(parsed) : null;
    } catch {
      return null;
    }
  }
  return codexCredential(trimmed, CODEX_DEFAULT_BASE_URL);
}

export async function resolveCodexCredential(userSecret?: string): Promise<CodexCredential> {
  const userCredential = typeof userSecret === 'string' ? credentialFromUserSecret(userSecret) : null;
  if (userCredential) return refreshCodexCredential(userCredential);
  throw new Error('Codex Auth needs your own Codex access token or auth JSON in Settings.');
}


function jwtExpiresSoon(token: string, skewSeconds: number): boolean {
  const payload = jwtPayload(token);
  const exp = typeof payload?.exp === 'number' ? payload.exp : 0;
  if (!exp) return false;
  return exp <= Math.floor(Date.now() / 1000) + skewSeconds;
}

async function refreshCodexCredential(credential: CodexCredential): Promise<CodexCredential> {
  if (!credential.refreshToken || !jwtExpiresSoon(credential.accessToken, 120)) return credential;
  const form = new URLSearchParams();
  form.set('grant_type', 'refresh_token');
  form.set('refresh_token', credential.refreshToken);
  form.set('client_id', CODEX_OAUTH_CLIENT_ID);
  const response = await fetch(CODEX_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    redirect: 'error',
  });
  if (!response.ok) return credential;
  const data = await response.json().catch(() => null);
  if (!isRecord(data) || typeof data.access_token !== 'string' || !data.access_token.trim()) return credential;
  const nextRefresh = typeof data.refresh_token === 'string' && data.refresh_token.trim()
    ? data.refresh_token.trim()
    : credential.refreshToken;
  return codexCredential(data.access_token.trim(), credential.baseUrl, nextRefresh);
}

export function codexHeaders(credential: CodexCredential): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${credential.accessToken}`,
    'User-Agent': CODEX_USER_AGENT,
    originator: 'codex_cli_rs',
    ...(credential.accountId ? { 'ChatGPT-Account-ID': credential.accountId } : {}),
  };
}

export function codexResponsesUrl(credential: CodexCredential): string {
  return `${credential.baseUrl.replace(/\/+$/, '')}/responses`;
}

export function codexModelsUrl(credential: CodexCredential): string {
  const url = new URL(`${credential.baseUrl.replace(/\/+$/, '')}/models`);
  url.searchParams.set('client_version', CODEX_CLIENT_VERSION);
  return url.toString();
}

function providerModelsFromCodexData(data: unknown): ProviderModelOption[] {
  const models = isRecord(data) ? data.models : undefined;
  if (!Array.isArray(models)) return [];
  const seen = new Set<string>();
  const out: ProviderModelOption[] = [];
  for (const item of models) {
    if (!isRecord(item)) continue;
    const id = typeof item.slug === 'string' ? item.slug : typeof item.id === 'string' ? item.id : typeof item.model === 'string' ? item.model : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = typeof item.display_name === 'string' && item.display_name.trim() ? item.display_name.trim() : id;
    out.push({ id, label });
  }
  return out;
}

async function readHermesCatalogModels(): Promise<ProviderModelOption[]> {
  const file = path.join(os.homedir(), '.hermes', 'cache', 'model_catalog.json');
  const catalog = await readJson(file);
  if (!catalog) return [];
  const seen = new Set<string>();
  const out: ProviderModelOption[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isRecord(value)) return;
    const rawId = value.id ?? value.slug ?? value.model;
    if (typeof rawId === 'string') {
      const id = rawId.replace(/^openai(?:-codex)?\//, '');
      if ((id.startsWith('gpt-') || id.startsWith('o')) && !seen.has(id)) {
        seen.add(id);
        const rawLabel = value.name ?? value.label ?? value.display_name;
        out.push({ id, label: typeof rawLabel === 'string' ? rawLabel : id });
      }
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(catalog);
  return out;
}

export async function listCodexModels(userSecret?: string, signal?: AbortSignal): Promise<ProviderModelsResponse> {
  const start = Date.now();
  if (!userSecret?.trim()) {
    return {
      ok: false,
      kind: 'auth_failed',
      latencyMs: Date.now() - start,
      detail: 'Paste your Codex access token or auth JSON in Settings first.',
    };
  }
  try {
    const credential = await resolveCodexCredential(userSecret);
    const init: RequestInit = { method: 'GET', headers: codexHeaders(credential), redirect: 'error' };
    if (signal) init.signal = signal;
    const response = await fetch(codexModelsUrl(credential), init);
    const latencyMs = Date.now() - start;
    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) : {};
    if (!response.ok) {
      return { ok: false, kind: response.status === 401 ? 'auth_failed' : response.status === 429 ? 'rate_limited' : 'upstream_unavailable', latencyMs, status: response.status, detail: rawText.trim().slice(0, 240) };
    }
    const models = providerModelsFromCodexData(data);
    if (models.length > 0) return { ok: true, kind: 'success', latencyMs, status: response.status, models };
  } catch (err) {
    console.warn(`[provider:models] codex auth catalog failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const fallback = CODEX_FALLBACK_MODELS;
  const seen = new Set<string>();
  const models = fallback.filter((model) => {
    const id = model.id.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const result: ProviderModelsResponse = { ok: models.length > 0, kind: models.length > 0 ? 'success' : 'no_models', latencyMs: Date.now() - start, models };
  if (models.length === 0) result.detail = 'No Codex models were found.';
  return result;
}

export function buildCodexResponsesPayload(model: string, systemPrompt: unknown, messages: unknown): Record<string, unknown> {
  const input = Array.isArray(messages)
    ? messages
        .filter((message) => isRecord(message) && message.role !== 'system')
        .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: typeof message.content === 'string' ? message.content : String(message.content ?? '') }))
        .filter((message) => message.content.trim())
    : [];
  return { model, instructions: typeof systemPrompt === 'string' && systemPrompt.trim() ? systemPrompt : 'You are a helpful assistant.', input: input.length > 0 ? input : [{ role: 'user', content: '' }], store: false, stream: true };
}

export function extractCodexTextDelta(data: unknown): string {
  if (!isRecord(data)) return '';
  if (typeof data.delta === 'string') return data.delta;
  if (typeof data.text === 'string' && String(data.type ?? '').includes('delta')) return data.text;
  const item = data.item;
  if (String(data.type ?? '') === 'response.output_item.done' && isRecord(item)) {
    const content = item.content;
    if (Array.isArray(content)) return content.map((part) => isRecord(part) && typeof part.text === 'string' ? part.text : '').join('');
  }
  return '';
}

function parseSseText(raw: string): Array<{ payload: string; data: unknown }> {
  return raw
    .split(/\r?\n\r?\n/)
    .map((frame) => {
      const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
      if (!data) return null;
      if (data === '[DONE]') return { payload: data, data: null };
      try { return { payload: data, data: JSON.parse(data) }; } catch { return null; }
    })
    .filter((frame): frame is { payload: string; data: unknown } => frame != null);
}

export async function testCodexProviderConnection(input: { model: string; userSecret?: string; signal?: AbortSignal }): Promise<ConnectionTestResponse> {
  const start = Date.now();
  const model = input.model.trim();
  if (!model) return { ok: false, kind: 'invalid_model_id', latencyMs: Date.now() - start, model, detail: 'model is required' };
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (input.signal?.aborted) controller.abort();
  else input.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), CODEX_TIMEOUT_MS);
  try {
    const credential = await resolveCodexCredential(input.userSecret);
    const response = await fetch(codexResponsesUrl(credential), { method: 'POST', headers: codexHeaders(credential), body: JSON.stringify(buildCodexResponsesPayload(model, '', [{ role: 'user', content: SMOKE_PROMPT }])), signal: controller.signal, redirect: 'error' });
    const latencyMs = Date.now() - start;
    const rawText = await response.text();
    if (!response.ok) return { ok: false, kind: response.status === 401 ? 'auth_failed' : response.status === 429 ? 'rate_limited' : response.status === 404 ? 'not_found_model' : 'upstream_unavailable', latencyMs, model, status: response.status, detail: rawText.trim().slice(0, 240) };
    const sample = parseSseText(rawText).map((frame) => extractCodexTextDelta(frame.data)).join('').trim();
    const ok = sample.toLowerCase() === 'ok';
    const result: ConnectionTestResponse = { ok, kind: ok ? 'success' : 'unknown', latencyMs, model, status: response.status, sample: sample.slice(0, 120) };
    if (!ok) result.detail = `Expected smoke test reply "ok"; got "${sample.slice(0, 120)}"`;
    return result;
  } catch (err) {
    return { ok: false, kind: err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'unknown', latencyMs: Date.now() - start, model, detail: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', abort);
  }
}
