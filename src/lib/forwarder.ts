/**
 * Forward transformed data to an adapter's destination endpoint,
 * with decrypted auth headers, a hard timeout, SSRF re-validation at
 * forward time and a capped response read.
 */

import { decrypt } from '@/lib/encryption';
import { contentTypeFor, serialiseOutput, type DataFormat } from '@/lib/formats';
import { assertSafeUrl, SsrfError } from '@/lib/ssrf-guard';

// Destination responses are only echoed to the caller and logged
// (truncated at 10k chars) — never buffer more than this.
const MAX_RESPONSE_BYTES = 65_536;

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
  timeoutMs: number,
  /** Body written to the destination. JSON unless the adapter asks otherwise. */
  format: DataFormat = 'json'
): Promise<ForwardResult> {
  const startTime = Date.now();

  const headers: Record<string, string> = {
    'Content-Type': contentTypeFor(format),
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
    // Re-validate at forward time, not only at save time: a DNS record can
    // be flipped to an internal address after the adapter was created
    // (rebinding). Save-time validation alone is a TOCTOU hole.
    await assertSafeUrl(destinationUrl);

    const response = await fetch(destinationUrl, {
      method: method.toUpperCase(),
      headers,
      body: serialiseOutput(data, format),
      signal: controller.signal,
      redirect: 'manual',
    });

    const responseData = await readBodyCapped(response, MAX_RESPONSE_BYTES);

    return {
      success: response.ok,
      status: response.status,
      response: responseData,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof SsrfError) {
      return {
        success: false,
        error: `Destination URL rejected: ${error.message}`,
        durationMs: Date.now() - startTime,
      };
    }
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

/**
 * Read a response body with a hard byte cap — a hostile or misconfigured
 * destination must not be able to OOM the function by streaming an
 * unbounded body within the timeout window.
 */
async function readBodyCapped(response: Response, maxBytes: number): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const text = Buffer.concat(chunks).toString('utf8');
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text || null;
    }
  }
  return text || null;
}
