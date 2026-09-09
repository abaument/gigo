/**
 * Inbound email endpoint: POST /api/email/inbound?secret=...
 *
 * Target of the inbound email provider's webhook (Postmark format). The
 * destination adapter travels in the plus-address (`MailboxHash`). After
 * validation the email goes through the exact same pipeline as a webhook
 * call: transform → forward → log → usage.
 *
 * Response policy: the provider retries on non-2xx. Unroutable emails
 * (unknown/disabled adapter, no adapter id) return 200 so they are NOT
 * retried; only infrastructure-level failures return 5xx/429.
 *
 * Disabled unless EMAIL_INBOUND_SECRET is set.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebhookSecret } from '@/lib/security';
import { checkRateLimit } from '@/lib/rate-limit';
import { runTransformation } from '@/lib/pipeline';
import {
  buildEmailInputJson,
  extractAdapterId,
  type InboundEmailPayload,
} from '@/lib/email-inbound';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PAYLOAD_BYTES = 5 * 1_048_576; // 5 MB (email + base64 attachments)

function ignored(reason: string) {
  // 200 on purpose: tells the provider "delivered, do not retry".
  return NextResponse.json({ status: 'ignored', reason });
}

export async function POST(request: NextRequest) {
  const endpointSecret = process.env.EMAIL_INBOUND_SECRET;
  if (!endpointSecret) {
    return NextResponse.json(
      { status: 'error', error: 'Inbound email is not configured' },
      { status: 404 }
    );
  }

  const provided = request.nextUrl.searchParams.get('secret');
  if (!verifyWebhookSecret(provided, endpointSecret)) {
    return NextResponse.json(
      { status: 'error', error: 'Invalid secret' },
      { status: 401 }
    );
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return ignored('email exceeds 5MB limit');
  }

  let payload: InboundEmailPayload;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > MAX_PAYLOAD_BYTES) {
      return ignored('email exceeds 5MB limit');
    }
    payload = JSON.parse(body);
  } catch {
    return ignored('unparseable provider payload');
  }

  const adapterId = extractAdapterId(payload);
  if (!adapterId) {
    return ignored('no adapter id in recipient address (expected inbox+<adapterId>@...)');
  }

  try {
    const adapter = await db.adapter.findUnique({ where: { id: adapterId } });
    if (!adapter) return ignored('adapter not found');
    if (!adapter.isActive) return ignored('adapter is disabled');

    // 429 → the provider retries later, which is what we want here.
    const rate = await checkRateLimit(adapter.id, adapter.rateLimitPerMin);
    if (!rate.allowed) {
      return NextResponse.json(
        { status: 'error', error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      );
    }

    const inputJson = buildEmailInputJson(payload);
    const from = typeof inputJson.from === 'string' ? inputJson.from : 'unknown';

    const result = await runTransformation({
      adapter,
      inputJson,
      forward: true,
      isTest: false,
      sourceIp: 'email',
      userAgent: `email:${from}`,
    });

    // Failed transforms are logged and visible in GIGO; retrying the same
    // email would fail identically, so acknowledge with 200 either way.
    return NextResponse.json({
      status: result.ok ? 'success' : 'error',
      trace_id: result.traceId,
    });
  } catch (error) {
    console.error('Inbound email processing failed:', error);
    return NextResponse.json(
      { status: 'error', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
