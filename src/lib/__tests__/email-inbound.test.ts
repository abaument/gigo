import { describe, expect, it } from 'vitest';
import {
  buildEmailInputJson,
  buildInboundAddress,
  extractAdapterId,
  parseCsv,
} from '../email-inbound';

const ADAPTER_ID = '5396e685-7e1c-4d7b-855b-d5d405e0fefd';

describe('extractAdapterId', () => {
  it('accepts a UUID mailbox hash (case-insensitive)', () => {
    expect(extractAdapterId({ MailboxHash: ADAPTER_ID })).toBe(ADAPTER_ID);
    expect(extractAdapterId({ MailboxHash: ADAPTER_ID.toUpperCase() })).toBe(ADAPTER_ID);
    expect(extractAdapterId({ MailboxHash: ` ${ADAPTER_ID} ` })).toBe(ADAPTER_ID);
  });

  it('rejects missing or non-UUID hashes', () => {
    expect(extractAdapterId({})).toBeNull();
    expect(extractAdapterId({ MailboxHash: '' })).toBeNull();
    expect(extractAdapterId({ MailboxHash: 'not-a-uuid' })).toBeNull();
    expect(extractAdapterId({ MailboxHash: "'; DROP TABLE adapters;--" })).toBeNull();
  });
});

describe('buildInboundAddress', () => {
  it('injects the adapter id via plus-addressing', () => {
    expect(buildInboundAddress('abc123@inbound.postmarkapp.com', ADAPTER_ID)).toBe(
      `abc123+${ADAPTER_ID}@inbound.postmarkapp.com`
    );
  });

  it('returns null when the inbox is unset or malformed', () => {
    expect(buildInboundAddress(undefined, ADAPTER_ID)).toBeNull();
    expect(buildInboundAddress('', ADAPTER_ID)).toBeNull();
    expect(buildInboundAddress('no-at-sign', ADAPTER_ID)).toBeNull();
  });
});

describe('parseCsv', () => {
  it('parses a comma CSV into records', () => {
    const rows = parseCsv('name,email\nJean,jean@ex.fr\n"Doe, Jane",jane@ex.fr\n');
    expect(rows).toEqual([
      { name: 'Jean', email: 'jean@ex.fr' },
      { name: 'Doe, Jane', email: 'jane@ex.fr' },
    ]);
  });

  it('auto-detects semicolon delimiters (French exports)', () => {
    const rows = parseCsv('nom;montant\nJean;49,90 €\n');
    expect(rows).toEqual([{ nom: 'Jean', montant: '49,90 €' }]);
  });

  it('handles escaped quotes and embedded newlines', () => {
    const rows = parseCsv('note,who\n"line1\nline2","said ""hi"""\n');
    expect(rows).toEqual([{ note: 'line1\nline2', who: 'said "hi"' }]);
  });

  it('returns [] without a data row', () => {
    expect(parseCsv('only,a,header\n')).toEqual([]);
    expect(parseCsv('')).toEqual([]);
  });
});

describe('buildEmailInputJson', () => {
  it('folds sender, subject, body and parsed attachments into one object', () => {
    const input = buildEmailInputJson({
      FromFull: { Email: 'jean@ex.fr', Name: 'Jean Dupont' },
      Subject: 'Commande',
      TextBody: 'Bonjour, commande de 3 licences.',
      Date: '2026-09-09T10:00:00Z',
      Attachments: [
        {
          Name: 'leads.csv',
          ContentType: 'text/csv',
          Content: Buffer.from('name,email\nJean,jean@ex.fr\n').toString('base64'),
        },
        {
          Name: 'payload.json',
          ContentType: 'application/json',
          Content: Buffer.from('{"amount": 42}').toString('base64'),
        },
      ],
    });

    expect(input.source).toBe('email');
    expect(input.from).toBe('jean@ex.fr');
    expect(input.from_name).toBe('Jean Dupont');
    expect(input.subject).toBe('Commande');
    expect(input.body).toBe('Bonjour, commande de 3 licences.');
    const attachments = input.attachments as { filename: string; data: unknown }[];
    expect(attachments[0].data).toEqual([{ name: 'Jean', email: 'jean@ex.fr' }]);
    expect(attachments[1].data).toEqual({ amount: 42 });
  });

  it('falls back to stripped HTML when there is no text body', () => {
    const input = buildEmailInputJson({
      From: 'a@b.c',
      HtmlBody: '<p>Hello <b>world</b></p><script>evil()</script>',
    });
    expect(input.body).toBe('Hello world');
    expect(input.from).toBe('a@b.c');
  });

  it('marks unsupported attachment types instead of failing', () => {
    const input = buildEmailInputJson({
      TextBody: 'x',
      Attachments: [{ Name: 'doc.pdf', ContentType: 'application/pdf', Content: 'aGVsbG8=' }],
    });
    const attachments = input.attachments as { data: unknown; note?: string }[];
    expect(attachments[0].data).toBeNull();
    expect(attachments[0].note).toContain('unsupported');
  });
});
