/**
 * SSRF protection for user-supplied URLs (doc import, destination URLs).
 *
 * Blocks non-http(s) schemes and any hostname resolving to a private,
 * loopback, link-local or cloud-metadata address. Redirects are followed
 * manually so every hop is re-validated (a 302 to 169.254.169.254 would
 * otherwise bypass the check).
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

export function isPrivateAddress(ip: string): boolean {
  // Normalize IPv4-mapped IPv6 (::ffff:10.0.0.1)
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateAddress(mapped[1]);

  if (isIP(ip) === 4) {
    const octets = ip.split('.').map(Number);
    const [a, b] = octets;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10/8
    if (a === 127) return true; // 127/8 loopback
    if (a === 169 && b === 254) return true; // 169.254/16 link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
    return false;
  }

  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true; // unspecified / loopback
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 unique local
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb'))
      return true; // fe80::/10 link-local
    return false;
  }

  // Not an IP literal — caller should resolve it first.
  return false;
}

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError('Only http(s) URLs are allowed');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new SsrfError(`Blocked address: ${hostname}`);
    }
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new SsrfError(`Could not resolve hostname: ${hostname}`);
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new SsrfError(`Blocked address: ${address}`);
    }
  }

  return url;
}

const MAX_REDIRECTS = 3;

export interface GuardedFetchOptions {
  timeoutMs: number;
  maxBytes: number;
}

/**
 * Fetch a user-supplied URL with SSRF validation on every redirect hop,
 * a global timeout, and a streamed size cap.
 */
export async function fetchWithGuards(
  rawUrl: string,
  opts: GuardedFetchOptions
): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    let currentUrl = rawUrl;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = await assertSafeUrl(currentUrl);

      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'GIGO/1.0 (+schema-import)' },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new SsrfError('Redirect without Location header');
        }
        currentUrl = new URL(location, url).toString();
        continue;
      }

      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > opts.maxBytes) {
        throw new SsrfError(`Response exceeds ${opts.maxBytes} bytes`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return { status: response.status, text: '' };
      }

      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > opts.maxBytes) {
          controller.abort();
          throw new SsrfError(`Response exceeds ${opts.maxBytes} bytes`);
        }
        chunks.push(value);
      }

      return {
        status: response.status,
        text: Buffer.concat(chunks).toString('utf8'),
      };
    }

    throw new SsrfError(`Too many redirects (max ${MAX_REDIRECTS})`);
  } catch (error) {
    if (error instanceof SsrfError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SsrfError(`Request timed out after ${opts.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
