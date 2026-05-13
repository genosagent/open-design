import type { AppConfig, ChatMessage } from '../types';
import type { StreamHandlers } from './anthropic';
import { streamProxyEndpoint } from './api-proxy';

export async function streamMessageCodexAuth(
  cfg: AppConfig,
  system: string,
  history: ChatMessage[],
  signal: AbortSignal,
  handlers: StreamHandlers,
): Promise<void> {
  return streamProxyEndpoint('/api/proxy/codex/stream', cfg, system, history, signal, handlers);
}
