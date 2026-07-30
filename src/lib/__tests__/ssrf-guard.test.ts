import { describe, expect, it, vi } from 'vitest';
import { assertSafeUrl, isPrivateAddress, SsrfError } from '../ssrf-guard';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (hostname: string) => {
    const table: Record<string, string> = {
      'internal.corp': '10.1.2.3',
      'metadata.evil.com': '169.254.169.254',
      'example.com': '93.184.216.34',
    };
    if (!table[hostname]) throw new Error('ENOTFOUND');
    return [{ address: table[hostname], family: 4 }];
  }),
}));

describe('isPrivateAddress', () => {
  const privates = [
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '100.64.0.1',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:10.0.0.1',
    '::ffff:192.168.0.5',
  ];
  const publics = ['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700::1111'];

  it.each(privates)('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(publics)('allows %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  it('rejects non-http(s) protocols', async () => {
    await expect(assertSafeUrl('ftp://example.com/file')).rejects.toThrow(SsrfError);
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow(SsrfError);
  });

  it('rejects private IP literals', async () => {
    await expect(assertSafeUrl('http://127.0.0.1/admin')).rejects.toThrow(SsrfError);
    await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(
      SsrfError
    );
  });

  it('rejects hostnames resolving to private ranges', async () => {
    await expect(assertSafeUrl('https://internal.corp/docs')).rejects.toThrow(SsrfError);
    await expect(assertSafeUrl('https://metadata.evil.com/')).rejects.toThrow(SsrfError);
  });

  it('accepts public hostnames', async () => {
    const url = await assertSafeUrl('https://example.com/docs');
    expect(url.hostname).toBe('example.com');
  });

  it('rejects unresolvable hostnames', async () => {
    await expect(assertSafeUrl('https://does-not-exist.invalid/')).rejects.toThrow(SsrfError);
  });

  it('rejects invalid URLs', async () => {
    await expect(assertSafeUrl('not a url')).rejects.toThrow(SsrfError);
  });
});
