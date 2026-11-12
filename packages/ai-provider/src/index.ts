export type TaskKind =
  | 'spec_generate'
  | 'arch_generate'
  | 'code_task'
  | 'ai_task';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface CompleteRequest {
  model: string;
  taskKind: TaskKind;
  messages: Message[];
  timeoutMs?: number;
  idempotencyKey: string;
}

export type AIResult =
  | { ok: true; text: string; usage?: { promptTokens: number; completionTokens: number } }
  | { ok: false; kind: 'error' | 'rate_limited' | 'timeout'; message: string };

export interface AIProvider {
  id: string;
  label: string;
  models: ModelInfo[];
  complete(request: CompleteRequest, key: string): Promise<AIResult>;
}

export interface SmokeTestResult {
  passed: boolean;
  detail: string;
}

export interface ProviderRegistryEntry {
  provider: AIProvider;
  enabled: boolean;
  keyRef?: string;
  smokeTestedAt?: string;
  smokeDetail?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;

interface MistralChoice {
  message?: { content?: string | Array<{ text?: string }> };
}

interface MistralResponse {
  choices?: MistralChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function extractText(choice: MistralChoice): string {
  const content = choice.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('');
  return '';
}

export class MistralProvider implements AIProvider {
  readonly id = 'mistral';
  readonly label = 'Mistral AI';
  readonly models: ModelInfo[] = [
    { id: 'mistral-small-latest', label: 'Mistral Small' },
    { id: 'mistral-medium-latest', label: 'Mistral Medium' },
    { id: 'mistral-large-latest', label: 'Mistral Large' },
  ];

  async complete(request: CompleteRequest, key: string): Promise<AIResult> {
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
        }),
        signal: controller.signal,
      });
      if (response.status === 429) {
        return { ok: false, kind: 'rate_limited', message: 'Mistral API: rate limit exceeded (429)' };
      }
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return { ok: false, kind: 'error', message: `Mistral API error ${response.status}: ${body.slice(0, 200)}` };
      }
      const data = (await response.json()) as MistralResponse;
      const choice = data.choices?.[0];
      const text = choice ? extractText(choice) : '';
      if (!text) {
        return { ok: false, kind: 'error', message: 'Mistral API returned an empty completion' };
      }
      return {
        ok: true,
        text,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { ok: false, kind: 'timeout', message: `Mistral API timed out after ${timeoutMs} ms` };
      }
      return { ok: false, kind: 'error', message: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function smokeTest(provider: AIProvider, key: string): Promise<SmokeTestResult> {
  const result = await provider.complete(
    {
      model: provider.models[0]?.id ?? 'default',
      taskKind: 'ai_task',
      messages: [{ role: 'user', content: 'Ответь ровно одним словом: OK' }],
      timeoutMs: 15_000,
      idempotencyKey: `smoke-${provider.id}`,
    },
    key,
  );
  if (!result.ok) return { passed: false, detail: result.message };
  return { passed: true, detail: `smoke ok (${provider.id})` };
}

export class ProviderRegistry {
  private entries = new Map<string, ProviderRegistryEntry>();

  register(provider: AIProvider): void {
    this.entries.set(provider.id, { provider, enabled: false });
  }

  list(): ProviderRegistryEntry[] {
    return [...this.entries.values()];
  }

  get(id: string): ProviderRegistryEntry | undefined {
    return this.entries.get(id);
  }

  async enable(id: string, key: string, keyRef: string): Promise<SmokeTestResult> {
    const entry = this.entries.get(id);
    if (!entry) return { passed: false, detail: `provider ${id} is not registered` };
    const smoke = await smokeTest(entry.provider, key);
    if (!smoke.passed) {
      entry.smokeDetail = smoke.detail;
      return smoke;
    }
    entry.enabled = true;
    entry.keyRef = keyRef;
    entry.smokeTestedAt = new Date().toISOString();
    entry.smokeDetail = smoke.detail;
    return smoke;
  }

  disable(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.enabled = false;
    entry.keyRef = undefined;
    entry.smokeTestedAt = undefined;
  }

  getEnabled(): ProviderRegistryEntry | undefined {
    return this.list().find((entry) => entry.enabled);
  }
}

export function createRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new MistralProvider());
  return registry;
}
