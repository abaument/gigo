/**
 * Model catalog per provider. Plain constants — safe to import from
 * client components (ModelPicker) and from the providers themselves.
 */

import type { ProviderName } from './types';

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: 'gpt-4o-2024-08-06',
  anthropic: 'claude-sonnet-5',
};

export const AVAILABLE_MODELS: Record<ProviderName, { id: string; label: string }[]> = {
  openai: [
    { id: 'gpt-4o-2024-08-06', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ],
  anthropic: [
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
};
