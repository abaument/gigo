import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseXlsx, looksLikeXlsx, FormatError } from '../formats';

// A genuine workbook written by Excel's format (produced with openpyxl), not a
// handcrafted zip: the point is to prove the reader copes with what a real
// export looks like, shared strings and all.
const FIXTURE = readFileSync(join(__dirname, 'fixtures/inscriptions.xlsx'));
const bytes = new Uint8Array(FIXTURE);

describe('looksLikeXlsx', () => {
  it('recognises a workbook by its zip signature', () => {
    expect(looksLikeXlsx(bytes)).toBe(true);
  });

  it('does not mistake text for a workbook', () => {
    expect(looksLikeXlsx(new TextEncoder().encode('{"a":1}'))).toBe(false);
    expect(looksLikeXlsx(new Uint8Array([]))).toBe(false);
  });
});

describe('parseXlsx', () => {
  it('reads the first sheet as one record per row', () => {
    const rows = parseXlsx(bytes) as Record<string, string>[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('uses the header row as keys', () => {
    const rows = parseXlsx(bytes) as Record<string, string>[];
    expect(Object.keys(rows[0])).toEqual([
      'reference', 'prenom', 'nom', 'email', 'montant_affiche', 'date_inscription', 'optin',
    ]);
  });

  it('keeps the values as the spreadsheet holds them, trimmed', () => {
    const rows = parseXlsx(bytes) as Record<string, string>[];
    expect(rows[0]).toEqual({
      reference: 'ins-2026-0041',
      prenom: 'nadia',
      nom: 'CHERIF',
      email: 'Nadia.Cherif@Exemple.FR',
      montant_affiche: '99,00 €',
      date_inscription: '14/06/2026',
      optin: 'oui',
    });
    expect(rows[1].reference).toBe('ins-2026-0042');
    expect(rows[1].optin).toBe('non');
  });

  it('refuses a file that is not a workbook', () => {
    expect(() => parseXlsx(new TextEncoder().encode('pas un classeur'))).toThrow(FormatError);
  });

  it('refuses a workbook without a data row', () => {
    // a zip that opens but holds no worksheet
    const notASheet = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    expect(() => parseXlsx(notASheet)).toThrow(FormatError);
  });
});
