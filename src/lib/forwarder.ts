/**
 * Forward transformed data to an adapter's destination endpoint,
 * with decrypted auth headers and a hard timeout.
 */

import { decrypt } from '@/lib/encryption';

export interface ForwardAuthConfig {
  authMethod: string;
  authHeaderName: string | null;
  encryptedAuthValue: string | null;
}

export interface ForwardResult {
  success: boolean;
  status?: number;
  response?: unknown;
  error?: string;
  durationMs: number;
}

export async function forwardToDestination(
  destinationUrl: string,
  method: string,
  data: unknown,
  authConfig: ForwardAuthConfig,
  timeoutMs: number
): Promise<ForwardResult> {
  const startTime = Date.now();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'GIGO/1.0',
  };

  if (authConfig.authMethod !== 'none' && authConfig.encryptedAuthValue) {
    const authValue = decrypt(authConfig.encryptedAuthValue);

    switch (authConfig.authMethod) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${authValue}`;
        break;
      case 'api_key':
        headers[authConfig.authHeaderName || 'X-API-Key'] = authValue;
        break;
      case 'basic':
        headers['Authorization'] = `Basic ${Buffer.from(authValue).toString('base64')}`;
        break;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(destinationUrl, {
      method: method.toUpperCase(),
      headers,
      body: JSON.stringify(data),
      signal: controller.signal,
      redirect: 'manual',
    });

    let responseData: unknown;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json().catch(() => null);
    } else {
      responseData = await response.text().catch(() => null);
    }

    return {
      success: response.ok,
      status: response.status,
      response: responseData,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      success: false,
      error: aborted
        ? `Destination timeout after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : 'Forwarding failed',
      durationMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timer);
  }
}
