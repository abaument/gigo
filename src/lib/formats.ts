/**
 * Input and output formats around the JSON core.
 *
 * The engine always reasons in JSON: a target schema is JSON, the model is
 * constrained to JSON, the logs store JSON. Other formats are therefore
 * handled at the edges only, by converting on the way in and serialising on
 * the way out. That keeps the transformation, the validation and the learning
 * loop untouched by format concerns.
 *
 * No dependency: the parsers below cover the shapes that integration payloads
 * actually take (flat or nested records, repeated siblings, attributes), and
 * refuse anything they cannot represent faithfully rather than guessing.
 */

export const DATA_FORMATS = ['json', 'xml', 'csv'] as const;
export type DataFormat = (typeof DATA_FORMATS)[number];

export class FormatError extends Error {
  constructor(
    message: string,
    readonly code: 'INVALID_JSON' | 'INVALID_XML' | 'INVALID_CSV' | 'UNSUPPORTED_SHAPE'
  ) {
    super(message);
    this.name = 'FormatError';
  }
}

/** Rows beyond this are dropped: a payload, not a bulk import. */
export const MAX_CSV_ROWS = 500;
/** Depth guard against deeply nested or hostile documents. */
const MAX_XML_DEPTH = 40;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Decide the format of an incoming body from its content type, falling back to
 * the body itself. The content type wins when it is explicit, because a CSV
 * whose first cell starts with `{` would otherwise be read as JSON.
 */
export function detectFormat(body: string, contentType?: string | null): DataFormat {
  const type = (contentType ?? '').toLowerCase();
  if (type.includes('json')) return 'json';
  if (type.includes('xml')) return 'xml';
  if (type.includes('csv')) return 'csv';

  const trimmed = body.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('<')) return 'xml';
  return 'csv';
}

// ---------------------------------------------------------------------------
// Parsing: any format in, plain JSON value out
// ---------------------------------------------------------------------------

export function parseInput(body: string, format: DataFormat): unknown {
  switch (format) {
    case 'json':
      try {
        return JSON.parse(body);
      } catch {
        throw new FormatError('Invalid JSON in request body', 'INVALID_JSON');
      }
    case 'xml':
      return parseXml(body);
    case 'csv':
      return parseCsvDocument(body);
  }
}

type XmlNode = { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string };

/**
 * Minimal XML reader: elements, attributes, text. Comments, declarations,
 * processing instructions and CDATA sections are handled; entities are decoded
 * for the five predefined ones plus numeric references.
 */
function readXml(src: string): XmlNode {
  let i = 0;
  const stack: XmlNode[] = [];
  let root: XmlNode | null = null;

  const skipTo = (marker: string) => {
    const at = src.indexOf(marker, i);
    i = at === -1 ? src.length : at + marker.length;
  };

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) break;

    if (lt > i) {
      const text = src.slice(i, lt);
      if (stack.length && text.trim()) stack[stack.length - 1].text += decodeEntities(text);
    }
    i = lt;

    if (src.startsWith('<!--', i)) {
      skipTo('-->');
      continue;
    }
    if (src.startsWith('<?', i)) {
      skipTo('?>');
      continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i);
      const raw = src.slice(i + 9, end === -1 ? src.length : end);
      if (stack.length) stack[stack.length - 1].text += raw;
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    if (src.startsWith('<!', i)) {
      skipTo('>');
      continue;
    }

    const gt = src.indexOf('>', i);
    if (gt === -1) throw new FormatError('Unterminated XML tag', 'INVALID_XML');
    const rawTag = src.slice(i + 1, gt).trim();
    i = gt + 1;

    if (rawTag.startsWith('/')) {
      const name = rawTag.slice(1).trim();
      const open = stack.pop();
      if (!open || open.name !== name) {
        throw new FormatError(`Mismatched closing tag: ${name}`, 'INVALID_XML');
      }
      if (!stack.length) root = open;
      continue;
    }

    const selfClosing = rawTag.endsWith('/');
    const inner = selfClosing ? rawTag.slice(0, -1).trim() : rawTag;
    const spaceAt = inner.search(/\s/);
    const name = spaceAt === -1 ? inner : inner.slice(0, spaceAt);
    if (!name) throw new FormatError('Empty XML tag name', 'INVALID_XML');

    const node: XmlNode = {
      name,
      attrs: spaceAt === -1 ? {} : readAttributes(inner.slice(spaceAt)),
      children: [],
      text: '',
    };
    if (stack.length) stack[stack.length - 1].children.push(node);
    if (selfClosing) {
      if (!stack.length) root = node;
    } else {
      if (stack.length >= MAX_XML_DEPTH) {
        throw new FormatError('XML nested too deeply', 'INVALID_XML');
      }
      stack.push(node);
    }
  }

  if (stack.length) throw new FormatError('Unclosed XML element', 'INVALID_XML');
  if (!root) throw new FormatError('No XML element found', 'INVALID_XML');
  return root;
}

function readAttributes(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    attrs[m[1]] = decodeEntities(m[3] ?? m[4] ?? '');
  }
  return attrs;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Element tree to plain JSON: attributes are prefixed, repeats become arrays. */
function nodeToValue(node: XmlNode): unknown {
  const hasChildren = node.children.length > 0;
  const hasAttrs = Object.keys(node.attrs).length > 0;
  const text = node.text.trim();

  if (!hasChildren && !hasAttrs) return text;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.attrs)) out[`@${k}`] = v;
  if (text) out['#text'] = text;

  for (const child of node.children) {
    const value = nodeToValue(child);
    const existing = out[child.name];
    if (existing === undefined) {
      out[child.name] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[child.name] = [existing, value];
    }
  }
  return out;
}

export function parseXml(body: string): Record<string, unknown> {
  const root = readXml(body);
  const value = nodeToValue(root);
  return { [root.name]: value };
}

/**
 * RFC 4180 style reader: quoted fields, embedded delimiters, doubled quotes.
 * The separator is detected among comma, semicolon and tab, which covers the
 * exports produced by French tools.
 */
export function parseCsvRows(text: string): string[][] {
  const sample = text.slice(0, 4000);
  const counts: Record<string, number> = {
    ',': (sample.match(/,/g) ?? []).length,
    ';': (sample.match(/;/g) ?? []).length,
    '\t': (sample.match(/\t/g) ?? []).length,
  };
  const sep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * A CSV document becomes either a single object (one data row) or a list.
 * Single row payloads are the common webhook case and stay flat, so the
 * target schema does not have to describe a one-element array.
 */
export function parseCsvDocument(text: string): unknown {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new FormatError('CSV needs a header and a row', 'INVALID_CSV');

  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1, 1 + MAX_CSV_ROWS).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      if (key) record[key] = (cells[idx] ?? '').trim();
    });
    return record;
  });
  return records.length === 1 ? records[0] : records;
}

// ---------------------------------------------------------------------------
// Serialising: JSON value in, requested format out
// ---------------------------------------------------------------------------

export function serialiseOutput(value: unknown, format: DataFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(value, null, 2);
    case 'xml':
      return toXml(value);
    case 'csv':
      return toCsv(value);
  }
}

export function contentTypeFor(format: DataFormat): string {
  return format === 'json'
    ? 'application/json'
    : format === 'xml'
      ? 'application/xml'
      : 'text/csv';
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Element names must be valid; anything else is normalised rather than emitted raw. */
function xmlName(key: string): string {
  const cleaned = key.replace(/[^\w.-]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

function xmlBody(value: unknown, indent: string): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value) || typeof value !== 'object') return escapeXml(String(value));

  const entries = Object.entries(value as Record<string, unknown>);
  const lines: string[] = [];
  for (const [key, raw] of entries) {
    const items = Array.isArray(raw) ? raw : [raw];
    for (const item of items) {
      if (item === null || item === undefined) {
        lines.push(`${indent}<${xmlName(key)}/>`);
      } else if (typeof item === 'object') {
        lines.push(
          `${indent}<${xmlName(key)}>\n${xmlBody(item, indent + '  ')}\n${indent}</${xmlName(key)}>`
        );
      } else {
        lines.push(`${indent}<${xmlName(key)}>${escapeXml(String(item))}</${xmlName(key)}>`);
      }
    }
  }
  return lines.join('\n');
}

export function toXml(value: unknown, rootName = 'record'): string {
  const root = xmlName(rootName);
  if (Array.isArray(value)) {
    const items = value
      .map((item) => `  <${root}>\n${xmlBody(item, '    ')}\n  </${root}>`)
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<records>\n${items}\n</records>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root}>\n${xmlBody(value, '  ')}\n</${root}>`;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV is a flat format: nested values are serialised as compact JSON inside
 * their cell rather than silently dropped.
 */
export function toCsv(value: unknown): string {
  const records = (Array.isArray(value) ? value : [value]).filter(
    (r) => r !== null && typeof r === 'object' && !Array.isArray(r)
  ) as Record<string, unknown>[];

  if (!records.length) {
    throw new FormatError('CSV output needs an object or a list of objects', 'UNSUPPORTED_SHAPE');
  }

  const header: string[] = [];
  for (const record of records) {
    for (const key of Object.keys(record)) if (!header.includes(key)) header.push(key);
  }

  const lines = [header.map(csvCell).join(',')];
  for (const record of records) {
    lines.push(header.map((key) => csvCell(record[key])).join(','));
  }
  return lines.join('\n');
}
