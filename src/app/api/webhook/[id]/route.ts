/**
 * Public webhook endpoint: POST /api/webhook/[id]
 *
 * Control order: adapter lookup → webhook secret → rate limit → payload
 * size → JSON parse → shared transformation pipeline (transform →
 * forward → log → usage).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebhookSecret } from '@/lib/security';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  pipelineResponseBody,
  runTransformation,
  transformErrorStatus,
  outputFormatOf,
} from '@/lib/pipeline';
import {
  contentTypeFor,
  detectFormat,
  FormatError,
  looksLikeXlsx,
  parseInput,
  parseXlsx,
  serialiseOutput,
} from '@/lib/formats';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PAYLOAD_BYTES = 1_048_576; // 1 MB

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read the body with a hard cap enforced on the STREAM: a chunked request
 * carries no Content-Length, so the header check alone lets an attacker
 * buffer unbounded bytes into memory before any size test.
 */
async function readBodyCapped(
  request: NextRequest,
  maxBytes: number
): Promise<{ body: string; bytes: Uint8Array } | { tooLarge: true }> {
  const reader = request.body?.getReader();
  if (!reader) return { body: '', bytes: new Uint8Array() };

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  // the text form is what JSON, XML and CSV need; the bytes are what a
  // spreadsheet needs, and decoding those as UTF-8 would destroy them
  return { body: bytes.toString('utf8'), bytes: new Uint8Array(bytes) };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
  'Access-Control-Max-Age': '86400',
};

function jsonError(
  status: number,
  code: string,
  error: string,
  extraHeaders: Record<string, string> = {}
) {
  return NextResponse.json(
    { success: false, error, code },
    { status, headers: { ...corsHeaders, ...extraHeaders } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adapterId = params.id;

  const sourceIp =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // A non-UUID path segment would make Prisma throw (P2023) and surface
  // as a 500 — the correct contract for an unknown adapter is 404.
  if (!UUID_RE.test(adapterId)) {
    return jsonError(404, 'ADAPTER_NOT_FOUND', 'Adapter not found');
  }

  try {
    // 1. Adapter lookup
    const adapter = await db.adapter.findUnique({ where: { id: adapterId } });
    if (!adapter) {
      return jsonError(404, 'ADAPTER_NOT_FOUND', 'Adapter not found');
    }
    if (!adapter.isActive) {
      return jsonError(403, 'ADAPTER_DISABLED', 'Adapter is disabled');
    }

    // 2. Webhook secret (timing-safe), before any expensive work
    if (adapter.webhookSecret) {
      const provided = request.headers.get('x-webhook-secret');
      if (!verifyWebhookSecret(provided, adapter.webhookSecret)) {
        return jsonError(401, 'INVALID_SECRET', 'Missing or invalid X-Webhook-Secret header');
      }
    }

    // 3. Rate limit
    const rate = await checkRateLimit(adapter.id, adapter.rateLimitPerMin);
    if (!rate.allowed) {
      return jsonError(429, 'RATE_LIMITED', 'Rate limit exceeded', {
        'Retry-After': String(rate.retryAfterSec),
        'X-RateLimit-Remaining': '0',
      });
    }

    // 4. Payload size — fast reject on Content-Length, then enforce the
    // cap on the stream itself (Content-Length can lie or be absent).
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return jsonError(413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds 1MB limit');
    }

    const read = await readBodyCapped(request, MAX_PAYLOAD_BYTES);
    if ('tooLarge' in read) {
      return jsonError(413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds 1MB limit');
    }
    const body = read.body;
    if (!body || body.trim() === '') {
      return jsonError(400, 'EMPTY_BODY', 'Empty request body');
    }

    // 5. Parse — JSON, XML, CSV or a spreadsheet, decided by the content type,
    // then by the bytes themselves
    let inputJson: unknown;
    let inputFormat: string;
    try {
      if (looksLikeXlsx(read.bytes)) {
        inputFormat = 'xlsx';
        inputJson = parseXlsx(read.bytes);
      } else {
        inputFormat = detectFormat(body, request.headers.get('content-type'));
        inputJson = parseInput(body, inputFormat as 'json' | 'xml' | 'csv');
      }
    } catch (error) {
      if (error instanceof FormatError) {
        return jsonError(400, error.code, error.message);
      }
      return jsonError(400, 'INVALID_JSON', 'Unreadable request body');
    }

    // 6. Transform → forward → log → usage
    const result = await runTransformation({
      adapter,
      inputJson,
      forward: true,
      isTest: false,
      inputFormat,
      // a workbook is binary: the readable trace is the rows it yielded
      inputRaw: inputFormat === 'xlsx' ? undefined : body,
      sourceIp,
      userAgent,
    });

    const status = result.ok ? 200 : transformErrorStatus(result);

    // A successful run answers in the adapter's own format; failures stay JSON
    // so that error handling is identical whatever the adapter emits.
    const format = outputFormatOf(adapter);
    if (result.ok && format !== 'json') {
      try {
        return new NextResponse(serialiseOutput(result.transform.data, format), {
          status,
          headers: { ...corsHeaders, 'Content-Type': contentTypeFor(format) },
        });
      } catch (error) {
        const message = error instanceof FormatError ? error.message : 'Serialisation failed';
        return jsonError(500, 'OUTPUT_FORMAT_FAILED', message);
      }
    }

    return NextResponse.json(pipelineResponseBody(result, adapter), {
      status,
      headers: corsHeaders,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    let traceId: string | null = null;
    try {
      const logEntry = await db.transformationLog.create({
        data: {
          adapterId,
          inputJson: '{}',
          success: false,
          error: errorMessage,
          sourceIp,
          userAgent,
        },
      });
      traceId = logEntry.id;
    } catch {
      console.error('Failed to log error:', errorMessage);
    }

    return NextResponse.json(
      {
        status: 'error',
        trace_id: traceId,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET — usage instructions only. Deliberately opaque: it never reveals
 * the adapter's name, its state, or whether a secret is required, so an
 * unauthenticated holder of the id learns nothing about the owner's
 * setup. Integration details live in the authenticated dashboard.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    {
      id: params.id,
      usage: {
        method: 'POST',
        contentType: 'application/json',
        description:
          'POST a JSON payload to this URL to transform it to the adapter\'s target schema. ' +
          'If the adapter is protected, include its X-Webhook-Secret header.',
        maxPayloadBytes: MAX_PAYLOAD_BYTES,
      },
    },
    { headers: corsHeaders }
  );
}
