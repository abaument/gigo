/**
 * Authenticated playground endpoint: POST /api/adapters/[id]/test
 *
 * Runs the same transformation pipeline as the public webhook, but:
 * - requires a Supabase session and adapter ownership (no open CORS)
 * - never forwards unless explicitly asked (`forward: true`)
 * - logs with `isTest: true` so test runs are distinguishable
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  pipelineResponseBody,
  runTransformation,
  transformErrorStatus,
} from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PAYLOAD_BYTES = 1_048_576; // 1 MB
const TESTS_PER_MINUTE = 20;

const testRequestSchema = z.object({
  input: z.unknown(),
  forward: z.boolean().default(false),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 2. Ownership
    const adapter = await db.adapter.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!adapter) {
      return NextResponse.json(
        { success: false, error: 'Adapter not found', code: 'ADAPTER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 3. Per-user test rate limit
    const rate = await checkRateLimit(`test:${user.id}`, TESTS_PER_MINUTE);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many test requests', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      );
    }

    // 4. Body
    const body = await request.text();
    if (Buffer.byteLength(body) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Payload exceeds 1MB limit', code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 }
      );
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const parsed = testRequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Body must be { input, forward? }', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    // 5. Pipeline (isTest: true)
    const result = await runTransformation({
      adapter,
      inputJson: parsed.data.input,
      forward: parsed.data.forward,
      isTest: true,
      sourceIp: 'playground',
      userAgent: 'GIGO Playground',
    });

    const status = result.ok ? 200 : transformErrorStatus(result);
    return NextResponse.json(pipelineResponseBody(result, adapter), { status });
  } catch (error) {
    console.error('Playground test failed:', error);
    return NextResponse.json(
      { status: 'error', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
