import { describe, it, expect } from 'vitest';
import {
  detectFormat,
  parseInput,
  parseXml,
  parseCsvDocument,
  parseCsvRows,
  serialiseOutput,
  toXml,
  toCsv,
  contentTypeFor,
  FormatError,
} from '../formats';

describe('detectFormat', () => {
  it('trusts an explicit content type over the body', () => {
    expect(detectFormat('{"a":1}', 'text/csv')).toBe('csv');
    expect(detectFormat('a,b\n1,2', 'application/json')).toBe('json');
    expect(detectFormat('<a/>', 'application/xml; charset=utf-8')).toBe('xml');
  });

  it('falls back to the body when the type is absent or generic', () => {
    expect(detectFormat('  {"a":1}', null)).toBe('json');
    expect(detectFormat('[1,2]', 'application/octet-stream')).toBe('json');
    expect(detectFormat('<?xml version="1.0"?><a/>', undefined)).toBe('xml');
    expect(detectFormat('nom,prix\nCafé,4', undefined)).toBe('csv');
  });
});

describe('XML in', () => {
  it('reads elements, attributes and text', () => {
    const out = parseXml('<order id="42"><customer>Nadia</customer><total>99.5</total></order>');
    expect(out).toEqual({
      order: { '@id': '42', customer: 'Nadia', total: '99.5' },
    });
  });

  it('turns repeated siblings into a list', () => {
    const out = parseXml('<cart><item>A</item><item>B</item></cart>') as {
      cart: { item: string[] };
    };
    expect(out.cart.item).toEqual(['A', 'B']);
  });

  it('handles self-closing tags, comments and declarations', () => {
    const out = parseXml(
      '<?xml version="1.0"?><!-- note --><o><empty/><name>Lyon</name></o>'
    ) as { o: Record<string, unknown> };
    expect(out.o.empty).toBe('');
    expect(out.o.name).toBe('Lyon');
  });

  it('decodes entities and CDATA', () => {
    const out = parseXml('<o><a>caf&#233; &amp; th&eacute;</a><b><![CDATA[<raw>]]></b></o>') as {
      o: Record<string, string>;
    };
    expect(out.o.a).toContain('café &');
    expect(out.o.b).toBe('<raw>');
  });

  it('keeps mixed content under a text key', () => {
    const out = parseXml('<p>bonjour<b>gras</b></p>') as { p: Record<string, unknown> };
    expect(out.p['#text']).toBe('bonjour');
    expect(out.p.b).toBe('gras');
  });

  it('rejects malformed documents rather than guessing', () => {
    expect(() => parseXml('<a><b></a>')).toThrow(FormatError);
    expect(() => parseXml('<a>')).toThrow(FormatError);
    expect(() => parseXml('pas du xml')).toThrow(FormatError);
  });

  it('refuses a document nested past the depth guard', () => {
    const deep = '<a>'.repeat(60) + '</a>'.repeat(60);
    expect(() => parseXml(deep)).toThrow(/deeply/i);
  });
});

describe('CSV in', () => {
  it('reads a single row as one object', () => {
    expect(parseCsvDocument('prenom,ville\nNadia,Lyon')).toEqual({
      prenom: 'Nadia',
      ville: 'Lyon',
    });
  });

  it('reads several rows as a list', () => {
    const out = parseCsvDocument('a,b\n1,2\n3,4') as Record<string, string>[];
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ a: '3', b: '4' });
  });

  it('detects the semicolon separator of French exports', () => {
    expect(parseCsvDocument('nom;montant\nCafé;1 250,50 €')).toEqual({
      nom: 'Café',
      montant: '1 250,50 €',
    });
  });

  it('handles quotes, embedded separators and doubled quotes', () => {
    const rows = parseCsvRows('a,b\n"x,y","il dit ""oui"""');
    expect(rows[1]).toEqual(['x,y', 'il dit "oui"']);
  });

  it('ignores blank lines', () => {
    const out = parseCsvDocument('a,b\n1,2\n\n\n3,4') as unknown[];
    expect(out).toHaveLength(2);
  });

  it('refuses a document without a data row', () => {
    expect(() => parseCsvDocument('a,b')).toThrow(FormatError);
  });
});

describe('parseInput', () => {
  it('routes to the right reader and reports the format in the error code', () => {
    expect(parseInput('{"a":1}', 'json')).toEqual({ a: 1 });
    try {
      parseInput('{oops', 'json');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as FormatError).code).toBe('INVALID_JSON');
    }
  });
});

describe('XML out', () => {
  it('writes a flat record', () => {
    const xml = toXml({ invoice_number: 'FA-2026-0412', total_cents: 125050 });
    expect(xml).toContain('<invoice_number>FA-2026-0412</invoice_number>');
    expect(xml).toContain('<total_cents>125050</total_cents>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('nests objects and repeats arrays', () => {
    const xml = toXml({ buyer: { city: 'Lyon' }, tags: ['a', 'b'] });
    expect(xml).toContain('<buyer>');
    expect(xml).toContain('<city>Lyon</city>');
    expect((xml.match(/<tags>/g) ?? []).length).toBe(2);
  });

  it('escapes the characters that would break the document', () => {
    const xml = toXml({ note: 'P&G <important> "x"' });
    expect(xml).toContain('P&amp;G &lt;important&gt; &quot;x&quot;');
    expect(xml).not.toContain('<important>');
  });

  it('normalises keys that are not valid element names', () => {
    const xml = toXml({ '2 clients': 1, 'a b': 2 });
    expect(xml).toContain('<_2_clients>');
    expect(xml).toContain('<a_b>');
  });

  it('wraps a list in a records element', () => {
    const xml = toXml([{ a: 1 }, { a: 2 }]);
    expect(xml).toContain('<records>');
    expect((xml.match(/<record>/g) ?? []).length).toBe(2);
  });
});

describe('CSV out', () => {
  it('writes a header and one row per record', () => {
    const csv = toCsv([{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
    expect(csv.split('\n')).toEqual(['a,b', '1,x', '2,y']);
  });

  it('unions the keys across records', () => {
    const csv = toCsv([{ a: 1 }, { b: 2 }]);
    expect(csv.split('\n')[0]).toBe('a,b');
    expect(csv.split('\n')[1]).toBe('1,');
  });

  it('quotes cells containing a separator, a quote or a newline', () => {
    const csv = toCsv({ a: 'x,y', b: 'il dit "oui"', c: 'deux\nlignes' });
    expect(csv.split('\n')[1]).toBe('"x,y","il dit ""oui""","deux');
  });

  it('serialises a nested value inside its cell rather than dropping it', () => {
    const csv = toCsv({ buyer: { city: 'Lyon' } });
    expect(csv.split('\n')[1]).toBe('"{""city"":""Lyon""}"');
  });

  it('refuses a shape it cannot represent', () => {
    expect(() => toCsv('juste du texte')).toThrow(FormatError);
    expect(() => toCsv([])).toThrow(FormatError);
  });
});

describe('round trip', () => {
  it('keeps a record identical through XML and back', () => {
    const record = { invoice_number: 'FA-2026-0412', city: 'Villeurbanne' };
    const back = parseXml(toXml(record)) as { record: Record<string, string> };
    expect(back.record).toEqual(record);
  });

  it('keeps a record identical through CSV and back', () => {
    const record = { nom: 'Café, noir', montant: '1 250,50 €' };
    expect(parseCsvDocument(toCsv(record))).toEqual(record);
  });
});

describe('serialiseOutput and contentTypeFor', () => {
  it('pairs each format with its content type', () => {
    expect(contentTypeFor('json')).toBe('application/json');
    expect(contentTypeFor('xml')).toBe('application/xml');
    expect(contentTypeFor('csv')).toBe('text/csv');
  });

  it('pretty prints JSON', () => {
    expect(serialiseOutput({ a: 1 }, 'json')).toBe('{\n  "a": 1\n}');
  });
});

describe('messages and free text', () => {
  const EMAIL = [
    'From: Service Client Chronopost <suivi@chronopost.example>',
    'To: logistique@boutique.example',
    'Subject: =?UTF-8?B?Q29saXMgQ09MLTIwMjYtODg0NTEyIGVuIHJldGFyZA==?=',
    'Date: Mon, 21 Sep 2026 09:12:04 +0200',
    'Message-ID: <abc123@chronopost.example>',
    '',
    'Bonjour,',
    '',
    "Le colis COL-2026-884512 destiné à Nadia Cherif (Villeurbanne) est retardé.",
    'Nouvelle livraison estimée le 23/09/2026. Poids 2,45 kg.',
  ].join('\n');

  it('detects a message from its headers, without a content type', () => {
    expect(detectFormat(EMAIL, null)).toBe('eml');
  });

  it('detects a message announced as plain text', () => {
    expect(detectFormat(EMAIL, 'text/plain; charset=utf-8')).toBe('eml');
  });

  it('pulls the envelope apart and keeps the body whole', () => {
    const mail = parseInput(EMAIL, 'eml') as Record<string, string>;
    expect(mail.from).toContain('suivi@chronopost.example');
    expect(mail.to).toBe('logistique@boutique.example');
    expect(mail.date).toContain('21 Sep 2026');
    expect(mail.body).toContain('COL-2026-884512');
    expect(mail.body.startsWith('Bonjour')).toBe(true);
  });

  it('decodes an encoded subject', () => {
    const mail = parseInput(EMAIL, 'eml') as Record<string, string>;
    expect(mail.subject).toBe('Colis COL-2026-884512 en retard');
  });

  it('unfolds a header written across two lines', () => {
    const folded = 'Subject: colis en\n  retard\nFrom: a@b.c\n\ncorps';
    const mail = parseInput(folded, 'eml') as Record<string, string>;
    expect(mail.subject).toBe('colis en retard');
  });

  it('treats prose as text rather than forcing it into a table', () => {
    const note = "Le chauffeur signale que le colis 884517 n'a pas pu être livré.";
    expect(detectFormat(note, null)).toBe('text');
    expect(parseInput(note, 'text')).toEqual({ text: note });
  });

  it('still recognises a real table, which prose must not be confused with', () => {
    expect(detectFormat('a,b\n1,2\n3,4', null)).toBe('csv');
    expect(detectFormat('une phrase, avec une virgule', null)).toBe('text');
  });

  it('refuses an empty text body', () => {
    expect(() => parseInput('   ', 'text')).toThrow(FormatError);
  });
});
