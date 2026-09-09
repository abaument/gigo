/**
 * Inbound email → pipeline input.
 *
 * GIGO receives parsed emails as JSON webhooks from an inbound email
 * provider (Postmark inbound format). The adapter is addressed via
 * plus-addressing: `<inbox>+<adapterId>@inbound.postmarkapp.com` — the
 * provider exposes the part after `+` as `MailboxHash`.
 *
 * The email (subject, body, sender) and any JSON/CSV attachments are
 * folded into a single JSON object that goes through the exact same
 * transformation pipeline as a webhook call.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BODY_CHARS = 10_000;
const MAX_ATTACHMENT_BYTES = 1_048_576; // 1 MB decoded, per attachment
const MAX_CSV_ROWS = 200;

/** Subset of the Postmark inbound webhook payload that GIGO consumes. */
export interface InboundEmailPayload {
  From?: string;
  FromName?: string;
  FromFull?: { Email?: string; Name?: string };
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  MailboxHash?: string;
  Date?: string;
  MessageID?: string;
  Attachments?: {
    Name?: string;
    Content?: string;
    ContentType?: string;
    ContentLength?: number;
  }[];
}

/** The adapter UUID carried in the plus-address, or null. */
export function extractAdapterId(payload: InboundEmailPayload): string | null {
  const hash = payload.MailboxHash?.trim().toLowerCase();
  return hash && UUID_RE.test(hash) ? hash : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Minimal RFC 4180-style CSV parser (quotes, embedded delimiters and
 * newlines). Auto-detects `,` vs `;` (common in French exports) from the
 * header row. Values stay strings — type conversion is the AI's job.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? undefined : text.indexOf('\n'));
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    if (row.some((v) => v.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      pushField();
    } else if (c === '\n') {
      pushRow();
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) pushRow();

  if (rows.length < 2) return [];

  const headers = rows[0].map((h, i) => h.trim() || `column_${i + 1}`);
  return rows.slice(1, 1 + MAX_CSV_ROWS).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = cells[i]?.trim() ?? '';
    });
    return record;
  });
}

interface ParsedAttachment {
  filename: string;
  type: string;
  /** Parsed rows/object for CSV & JSON; null when the type is unsupported. */
  data: unknown;
  note?: string;
}

function parseAttachment(att: {
  Name?: string;
  Content?: string;
  ContentType?: string;
}): ParsedAttachment {
  const filename = att.Name ?? 'attachment';
  const type = att.ContentType ?? 'application/octet-stream';
  const base: ParsedAttachment = { filename, type, data: null };

  if (!att.Content) return { ...base, note: 'empty attachment' };

  let decoded: Buffer;
  try {
    decoded = Buffer.from(att.Content, 'base64');
  } catch {
    return { ...base, note: 'undecodable attachment' };
  }
  if (decoded.byteLength > MAX_ATTACHMENT_BYTES) {
    return { ...base, note: 'attachment exceeds 1MB — skipped' };
  }

  const lowerName = filename.toLowerCase();
  const isJson = type.includes('json') || lowerName.endsWith('.json');
  const isCsv = type.includes('csv') || lowerName.endsWith('.csv');

  if (isJson) {
    try {
      return { ...base, data: JSON.parse(decoded.toString('utf8')) };
    } catch {
      return { ...base, note: 'invalid JSON attachment' };
    }
  }

  if (isCsv) {
    const records = parseCsv(decoded.toString('utf8'));
    if (records.length === 0) return { ...base, note: 'empty or unparseable CSV' };
    return {
      ...base,
      data: records,
      ...(records.length === MAX_CSV_ROWS ? { note: `truncated to ${MAX_CSV_ROWS} rows` } : {}),
    };
  }

  return { ...base, note: 'unsupported attachment type (only JSON and CSV are parsed)' };
}

/**
 * Fold an inbound email into the single JSON object fed to the
 * transformation pipeline.
 */
export function buildEmailInputJson(payload: InboundEmailPayload): Record<string, unknown> {
  const body =
    payload.StrippedTextReply?.trim() ||
    payload.TextBody?.trim() ||
    (payload.HtmlBody ? stripHtml(payload.HtmlBody) : '');

  const attachments = (payload.Attachments ?? []).map(parseAttachment);

  return {
    source: 'email',
    from: payload.FromFull?.Email ?? payload.From ?? null,
    from_name: payload.FromFull?.Name || payload.FromName || null,
    subject: payload.Subject ?? null,
    body: body.length > MAX_BODY_CHARS ? `${body.slice(0, MAX_BODY_CHARS)}… [truncated]` : body,
    received_at: payload.Date ?? null,
    message_id: payload.MessageID ?? null,
    ...(attachments.length > 0 ? { attachments } : {}),
  };
}

/**
 * The adapter's inbound email address, derived from the configured inbox
 * (`NEXT_PUBLIC_EMAIL_INBOUND_ADDRESS`, e.g. `abc123@inbound.postmarkapp.com`)
 * via plus-addressing. Null when inbound email is not configured.
 */
export function buildInboundAddress(inbox: string | undefined, adapterId: string): string | null {
  if (!inbox || !inbox.includes('@')) return null;
  const [local, domain] = inbox.split('@');
  if (!local || !domain) return null;
  return `${local}+${adapterId}@${domain}`;
}
