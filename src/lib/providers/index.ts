/**
 * Provider factory — resolves an adapter's `modelProvider` to a
 * TransformProvider implementation. Unknown values fall back to OpenAI.
 */

import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import type { TransformProvider } from './types';

export function getProvider(name: string | null | undefined): TransformProvider {
  switch (name) {
    case 'anthropic':
      return anthropicProvider;
    case 'openai':
    default:
      return openaiProvider;
  }
}

export * from './types';
export { DEFAULT_MODELS, AVAILABLE_MODELS } from './models';
