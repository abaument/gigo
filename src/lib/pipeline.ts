/**
 * Shared transformation pipeline: transform → validate → forward → log
 * → record usage. Used by the public webhook, the authenticated
 * playground route, and the log replay action, so the three paths stay
 * behaviourally identical.
 */

import type { Adapter } from '@prisma/client';
import { db } from '@/lib/db';
import { transformJson, validateTransformedOutput, type TransformResult } from '@/lib/transformer';
import { forwardToDestination, type ForwardResult } from '@/lib/forwarder';
import { recordUsage } from '@/lib/usage';

export interface PipelineArgs {
  adapter: Adapter;
  inputJson: unknown;
  /** attempt forwarding when the adapter has a destination */
  forward: boolean;
  isTest: boolean;
  replayOfId?: string | null;
  sourceIp?: string;
  userAgent?: string;
}

export interface PipelineResult {
  ok: boolean;
  traceId: string | null;
  transform: TransformResult;
  forwarding: ForwardResult | null;
  warnings: string[];
  totalDurationMs: number;
}

export async function runTransformation(args: PipelineArgs): Promise<PipelineResult> {
  const { adapter, inputJson } = args;
  const startTime = Date.now();

  const transform = await transformJson(inputJson, adapter.targetSchema, {
    provider: adapter.modelProvider,
    modelName: adapter.modelName ?? undefined,
  });

  const warnings: string[] = [];
  let forwarding: ForwardResult | null = null;

  if (transform.success) {
    try {
      const targetExample = JSON.parse(adapter.targetSchema);
      const validation = validateTransformedOutput(transform.data, targetExample);
      if (!validation.isValid) {
        warnings.push(`Extra keys in output: ${validation.extraKeys.join(', ')}`);
      }
    } catch {
      // unparseable target schema — transformation already succeeded, skip validation
    }

    if (args.forward && adapter.destinationUrl) {
      forwarding = await forwardToDestination(
        adapter.destinationUrl,
        adapter.destinationMethod,
        transform.data,
        {
          authMethod: adapter.authMethod,
          authHeaderName: adapter.authHeaderName,
          encryptedAuthValue: adapter.encryptedAuthValue,
        },
        adapter.forwardTimeoutMs
      );
    }
  }

  const totalDurationMs = Date.now() - startTime;

  let traceId: string | null = null;
  try {
    const logEntry = await db.transformationLog.create({
      data: {
        adapterId: adapter.id,
        inputJson: JSON.stringify(inputJson, null, 2),
        outputJson: transform.success ? JSON.stringify(transform.data, null, 2) : null,
        success: transform.success,
        error: transform.success
          ? warnings.length > 0
            ? `warning: ${warnings.join('; ')}`
            : null
          : transform.error || 'Transformation failed',
        transformDuration: transform.durationMs,
        forwardedAt: forwarding ? new Date() : null,
        forwardingSuccess: forwarding?.success ?? null,
        forwardingResponse: forwarding?.response
          ? JSON.stringify(forwarding.response).slice(0, 10000)
          : null,
        forwardingStatus: forwarding?.status ?? null,
        forwardDuration: forwarding?.durationMs ?? null,
        totalDuration: totalDurationMs,
        provider: transform.provider ?? adapter.modelProvider,
        modelName: transform.model ?? null,
        inputTokens: transform.usage?.inputTokens ?? null,
        outputTokens: transform.usage?.outputTokens ?? null,
        isTest: args.isTest,
        replayOfId: args.replayOfId ?? null,
        sourceIp: args.sourceIp ?? null,
        userAgent: args.userAgent ?? null,
      },
    });
    traceId = logEntry.id;
  } catch (error) {
    console.error('Failed to write transformation log:', error);
  }

  // Usage tracking must never fail the request.
  recordUsage(adapter.userId, {
    transformations: 1,
    forwardings: forwarding ? 1 : 0,
    tokens: (transform.usage?.inputTokens ?? 0) + (transform.usage?.outputTokens ?? 0),
  }).catch((error) => console.error('Failed to record usage:', error));

  return {
    ok: transform.success,
    traceId,
    transform,
    forwarding,
    warnings,
    totalDurationMs,
  };
}

export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/***`;
  } catch {
    return '***';
  }
}

/**
 * Serialize a pipeline result into the public API response shape shared
 * by the webhook and the playground test route.
 */
export function pipelineResponseBody(
  result: PipelineResult,
  adapter: Adapter
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    status: result.ok ? 'success' : 'error',
    trace_id: result.traceId,
    timestamp: new Date().toISOString(),
  };

  if (result.ok) {
    body.data = result.transform.data;
    body.meta = {
      adapter_id: adapter.id,
      adapter_name: adapter.name,
      duration_ms: result.totalDurationMs,
      transform_duration_ms: result.transform.durationMs,
      provider: result.transform.provider,
      model: result.transform.model,
      input_tokens: result.transform.usage?.inputTokens ?? null,
      output_tokens: result.transform.usage?.outputTokens ?? null,
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    };
  } else {
    body.error = 'Transformation failed';
    body.message = result.transform.error;
    body.code = result.transform.errorCode ?? 'TRANSFORM_ERROR';
  }

  if (result.forwarding) {
    body.forwarding = {
      success: result.forwarding.success,
      status: result.forwarding.status,
      forwarded_to: adapter.destinationUrl ? maskUrl(adapter.destinationUrl) : null,
      duration_ms: result.forwarding.durationMs,
      ...(result.forwarding.success
        ? { response: result.forwarding.response }
        : { error: result.forwarding.error }),
    };
  }

  return body;
}

/** Map a failed transform's errorCode to an HTTP status. */
export function transformErrorStatus(result: PipelineResult): number {
  switch (result.transform.errorCode) {
    case 'RATE_LIMIT':
      return 503;
    case 'TIMEOUT':
      return 504;
    case 'MAX_TOKENS':
      return 422;
    default:
      return 500;
  }
}
