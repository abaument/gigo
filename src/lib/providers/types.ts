/**
 * Common interface for AI transformation providers (OpenAI, Anthropic).
 */

export type ProviderName = 'openai' | 'anthropic';

export interface TransformUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderResult {
  data: unknown;
  usage: TransformUsage;
  model: string;
}

export interface TransformOptions {
  modelName?: string;
  maxTokens?: number;
}

export interface TransformProvider {
  readonly name: ProviderName;
  transform(
    inputJson: unknown,
    jsonSchema: Record<string, unknown>,
    systemPrompt: string,
    opts?: TransformOptions
  ): Promise<ProviderResult>;
}

export type ProviderErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'MAX_TOKENS'
  | 'AUTH'
  | 'API_ERROR'
  | 'PARSE_ERROR';

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: ProviderErrorCode,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export const DEFAULT_MAX_TOKENS = 8192;
export const REQUEST_TIMEOUT_MS = 30_000;
export const SDK_MAX_RETRIES = 2;
