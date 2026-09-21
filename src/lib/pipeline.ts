/**
 * Shared transformation pipeline: transform → validate → forward → log
 * → record usage. Used by the public webhook, the authenticated
 * playground route, and the log replay action, so the three paths stay
 * behaviourally identical.
 */

import type { Adapter } from '@prisma/client';
import { db } from '@/lib/db';
import {
  filterLearningsForSchema,
  transformJson,
  validateTransformedOutput,
  type TransformResult,
} from '@/lib/transformer';
import { forwardToDestination, type ForwardResult } from '@/lib/forwarder';
import { checkMonthlyQuota, recordUsage } from '@/lib/usage';
import { resolveApiKey } from '@/lib/api-keys';
import { captureLearnings, getPromptLearnings } from '@/lib/learnings';
import { applyRule } from '@/lib/jsonata-rule';

/** A log is for reading, not for archiving: keep the original body bounded. */
const MAX_RAW_CHARS = 20_000;
import { DATA_FORMATS, type DataFormat } from '@/lib/formats';

/** The column is a plain string: fall back to JSON on anything unexpected. */
export function outputFormatOf(adapter: Pick<Adapter, 'outputFormat'>): DataFormat {
  const value = adapter.outputFormat as DataFormat;
  return DATA_FORMATS.includes(value) ? value : 'json';
}

/**
 * Deterministic path: a stored mapping is evaluated instead of calling a
 * model. Shaped as a TransformResult so the caller cannot tell the two apart.
 */
async function runRule(expression: string, input: unknown): Promise<TransformResult> {
  const started = Date.now();
  const result = await applyRule(expression, input);
  return {
    success: result.success,
    data: result.data,
    error: result.error,
    // a rule that does not produce the expected shape is a mapping fault,
    // which is the deterministic equivalent of an unparsable model answer
    errorCode: result.success ? undefined : 'PARSE_ERROR',
    durationMs: Date.now() - started,
    provider: 'jsonata' as TransformResult['provider'],
    model: 'jsonata',
  };
}

export interface PipelineArgs {
  adapter: Adapter;
  inputJson: unknown;
  /** attempt forwarding when the adapter has a destination */
  forward: boolean;
  isTest: boolean;
  replayOfId?: string | null;
  /** set by the replay action: did the ORIGINAL run's transform fail? */
  replayOriginalFailed?: boolean;
  /** playground comparison mode: run WITHOUT the learned knowledge */
  ignoreLearnings?: boolean;
  /** what the caller actually sent, when it was not JSON */
  inputFormat?: string;
  /** the body before conversion, so the log can show it as received */
  inputRaw?: string;
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
  /** knowledge injected into this run's prompt (null when none/disabled) */
  learningsApplied: { examples: number; pitfalls: number } | null;
}

export async function runTransformation(args: PipelineArgs): Promise<PipelineResult> {
  const { adapter, inputJson } = args;
  const startTime = Date.now();

  // Monthly spend guard — checked before any AI call. Never throws:
  // a quota-check failure must not take the webhook down.
  const quota = await checkMonthlyQuota(adapter.userId).catch(
    () => ({ allowed: true, used: 0, quota: 0 })
  );
  if (!quota.allowed) {
    const transform: TransformResult = {
      success: false,
      error: `Monthly token quota exceeded (${quota.used}/${quota.quota}). Resets on the 1st.`,
      errorCode: 'QUOTA_EXCEEDED',
      durationMs: 0,
    };
    let traceId: string | null = null;
    try {
      const logEntry = await db.transformationLog.create({
        data: {
          adapterId: adapter.id,
          inputJson: JSON.stringify(inputJson, null, 2),
          inputFormat: args.inputFormat ?? null,
          inputRaw: args.inputRaw?.slice(0, MAX_RAW_CHARS) ?? null,
          success: false,
          error: transform.error,
          totalDuration: Date.now() - startTime,
          isTest: args.isTest,
          sourceIp: args.sourceIp ?? null,
          userAgent: args.userAgent ?? null,
        },
      });
      traceId = logEntry.id;
    } catch (error) {
      console.error('Failed to write quota log:', error);
    }
    return {
      ok: false,
      traceId,
      transform,
      forwarding: null,
      warnings: [],
      totalDurationMs: Date.now() - startTime,
      learningsApplied: null,
    };
  }

  // BYOK key + the adapter's learned knowledge, fetched concurrently.
  // Both are best-effort: failures fall through to defaults.
  const [apiKey, rawLearnings] = await Promise.all([
    resolveApiKey(
      adapter.userId,
      adapter.modelProvider === 'anthropic' ? 'anthropic' : 'openai'
    ).catch(() => null),
    adapter.learningEnabled && !args.ignoreLearnings
      ? getPromptLearnings(adapter.id).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Stale-knowledge guard: never teach from an example whose output no
  // longer matches the CURRENT target schema.
  const learnings = rawLearnings
    ? filterLearningsForSchema(rawLearnings, adapter.targetSchema)
    : null;
  const learningsApplied =
    learnings && (learnings.examples.length > 0 || learnings.pitfalls.length > 0)
      ? { examples: learnings.examples.length, pitfalls: learnings.pitfalls.length }
      : null;

  // A verified JSONata rule replaces the model call: same output every time,
  // no token, a few milliseconds. The rest of the pipeline is unchanged, so
  // validation, forwarding and logging behave identically either way.
  const rule = adapter.jsonataEnabled ? adapter.jsonataExpression : null;
  const transform = rule
    ? await runRule(rule, inputJson)
    : await transformJson(inputJson, adapter.targetSchema, {
        provider: adapter.modelProvider,
        modelName: adapter.modelName ?? undefined,
        apiKey: apiKey ?? undefined,
        learnings: learningsApplied ? learnings! : undefined,
      });

  const warnings: string[] = [];
  const extraKeys: string[] = [];
  let forwarding: ForwardResult | null = null;

  if (transform.success) {
    try {
      const targetExample = JSON.parse(adapter.targetSchema);
      const validation = validateTransformedOutput(transform.data, targetExample);
      if (!validation.isValid) {
        extraKeys.push(...validation.extraKeys);
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
        adapter.forwardTimeoutMs,
        outputFormatOf(adapter)
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
        inputFormat: args.inputFormat ?? null,
        inputRaw: args.inputRaw?.slice(0, MAX_RAW_CHARS) ?? null,
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

  // Learning loop: hallucinated keys become pitfall constraints; a
  // successful replay of a past TRANSFORM failure becomes a reference
  // example. Awaited (a floating promise would be dropped when the
  // serverless instance freezes) but internally try/caught — it can
  // never fail the request.
  await captureLearnings({
    adapter,
    inputJson,
    transform,
    extraKeys,
    replayOfId: args.replayOfId,
    replayOriginalFailed: args.replayOriginalFailed,
    isTest: args.isTest,
  });

  return {
    ok: transform.success,
    traceId,
    transform,
    forwarding,
    warnings,
    totalDurationMs,
    learningsApplied,
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
      ...(result.learningsApplied ? { learnings_applied: result.learningsApplied } : {}),
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
    case 'QUOTA_EXCEEDED':
      // Caller-attributable and persists until the 1st: 429, not 503, so
      // senders back off instead of hammering with "transient" retries.
      return 429;
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
