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
} from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PAYLOAD_BYTES = 1_048_576; // 1 MB

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

    // 4. Payload size — fast reject on Content-Length, then re-check the
    // actual bytes (Content-Length can lie).
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return jsonError(413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds 1MB limit');
    }

    const body = await request.text();
    if (!body || body.trim() === '') {
      return jsonError(400, 'EMPTY_BODY', 'Empty request body');
    }
    if (Buffer.byteLength(body) > MAX_PAYLOAD_BYTES) {
      return jsonError(413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds 1MB limit');
    }

    // 5. Parse
    let inputJson: unknown;
    try {
      inputJson = JSON.parse(body);
    } catch {
      return jsonError(400, 'INVALID_JSON', 'Invalid JSON in request body');
    }

    // 6. Transform → forward → log → usage
    const result = await runTransformation({
      adapter,
      inputJson,
      forward: true,
      isTest: false,
      sourceIp,
      userAgent,
    });

    const status = result.ok ? 200 : transformErrorStatus(result);
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
 * GET — minimal public info. The target schema and stats are only
 * exposed through the authenticated dashboard.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adapter = await db.adapter.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, isActive: true, webhookSecret: true },
    });

    if (!adapter) {
      return NextResponse.json(
        { error: 'Adapter not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        id: adapter.id,
        name: adapter.name,
        isActive: adapter.isActive,
        hasSecret: !!adapter.webhookSecret,
        usage: {
          method: 'POST',
          contentType: 'application/json',
          description: 'Send any JSON payload to transform it to the target schema',
          ...(adapter.webhookSecret
            ? { requiredHeaders: ['X-Webhook-Secret'] }
            : {}),
        },
      },
      { headers: corsHeaders }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch adapter' },
      { status: 500, headers: corsHeaders }
    );
  }
}
