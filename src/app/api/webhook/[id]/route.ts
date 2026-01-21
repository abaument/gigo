/**
 * Dynamic webhook API route for JSON transformation and forwarding.
 *
 * This is the intelligent engine of GIGO V1.
 * It receives arbitrary JSON payloads, transforms them to match
 * the target schema, and optionally forwards to a destination.
 *
 * Endpoint: POST /api/webhook/[id]
 *
 * Flow:
 * 1. Receive JSON payload
 * 2. Fetch adapter config from DB
 * 3. Transform using OpenAI
 * 4. Forward to destination (if configured)
 * 5. Return response
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transformJson, validateTransformedOutput } from '@/lib/transformer';
import { decrypt } from '@/lib/encryption';

/**
 * CORS headers for webhook endpoints.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret',
  'Access-Control-Max-Age': '86400',
};

/**
 * Handle OPTIONS requests for CORS preflight.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Forward transformed data to the destination endpoint.
 *
 * Parameters
 * ----------
 * destinationUrl : string
 *     URL to forward the data to.
 * method : string
 *     HTTP method to use.
 * data : unknown
 *     Transformed JSON data to send.
 * authConfig : object
 *     Authentication configuration.
 *
 * Returns
 * -------
 * object
 *     Forwarding result with success status, response, and timing.
 */
async function forwardToDestination(
  destinationUrl: string,
  method: string,
  data: unknown,
  authConfig: {
    authMethod: string;
    authHeaderName: string | null;
    encryptedAuthValue: string | null;
  }
): Promise<{
  success: boolean;
  status?: number;
  response?: unknown;
  error?: string;
  durationMs: number;
}> {
  const startTime = Date.now();

  try {
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'GIGO/1.0',
    };

    // Add authentication if configured
    if (authConfig.authMethod !== 'none' && authConfig.encryptedAuthValue) {
      const authValue = decrypt(authConfig.encryptedAuthValue);

      switch (authConfig.authMethod) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${authValue}`;
          break;
        case 'api_key':
          const headerName = authConfig.authHeaderName || 'X-API-Key';
          headers[headerName] = authValue;
          break;
        case 'basic':
          headers['Authorization'] = `Basic ${Buffer.from(authValue).toString('base64')}`;
          break;
      }
    }

    // Make the request
    const response = await fetch(destinationUrl, {
      method: method.toUpperCase(),
      headers,
      body: JSON.stringify(data),
    });

    // Parse response
    let responseData: unknown;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    return {
      success: response.ok,
      status: response.status,
      response: responseData,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Forwarding failed',
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Handle POST requests to transform and forward JSON.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const totalStartTime = Date.now();
  const adapterId = params.id;

  // Extract request metadata
  const sourceIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // 1. Fetch the adapter from the database
    const adapter = await db.adapter.findUnique({
      where: { id: adapterId },
    });

    if (!adapter) {
      return NextResponse.json(
        { success: false, error: 'Adapter not found', code: 'ADAPTER_NOT_FOUND' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if adapter is active
    if (!adapter.isActive) {
      return NextResponse.json(
        { success: false, error: 'Adapter is disabled', code: 'ADAPTER_DISABLED' },
        { status: 403, headers: corsHeaders }
      );
    }

    // 2. Parse the incoming JSON payload
    let inputJson: unknown;
    try {
      const body = await request.text();
      
      if (!body || body.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Empty request body', code: 'EMPTY_BODY' },
          { status: 400, headers: corsHeaders }
        );
      }

      inputJson = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body', code: 'INVALID_JSON' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      await db.transformationLog.create({
        data: {
          adapterId,
          inputJson: JSON.stringify(inputJson),
          success: false,
          error: 'OpenAI API key not configured',
          totalDuration: Date.now() - totalStartTime,
          sourceIp,
          userAgent,
        },
      });

      return NextResponse.json(
        { success: false, error: 'Service configuration error', code: 'CONFIG_ERROR' },
        { status: 500, headers: corsHeaders }
      );
    }

    // 4. Transform the JSON using AI
    const transformResult = await transformJson(inputJson, adapter.targetSchema);

    if (!transformResult.success) {
      await db.transformationLog.create({
        data: {
          adapterId,
          inputJson: JSON.stringify(inputJson, null, 2),
          success: false,
          error: transformResult.error || 'Transformation failed',
          transformDuration: transformResult.durationMs,
          totalDuration: Date.now() - totalStartTime,
          sourceIp,
          userAgent,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Transformation failed',
          message: transformResult.error,
          code: 'TRANSFORM_ERROR',
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // 5. Validate the output
    const targetExample = JSON.parse(adapter.targetSchema);
    const validation = validateTransformedOutput(transformResult.data, targetExample);

    if (!validation.isValid) {
      console.warn(`[Adapter ${adapterId}] Extra keys in output:`, validation.extraKeys);
    }

    // 6. Forward to destination (if configured)
    let forwardingResult: {
      success: boolean;
      status?: number;
      response?: unknown;
      error?: string;
      durationMs: number;
    } | null = null;

    if (adapter.destinationUrl) {
      forwardingResult = await forwardToDestination(
        adapter.destinationUrl,
        adapter.destinationMethod,
        transformResult.data,
        {
          authMethod: adapter.authMethod,
          authHeaderName: adapter.authHeaderName,
          encryptedAuthValue: adapter.encryptedAuthValue,
        }
      );
    }

    // 7. Log the transformation
    const totalDuration = Date.now() - totalStartTime;

    await db.transformationLog.create({
      data: {
        adapterId,
        inputJson: JSON.stringify(inputJson, null, 2),
        outputJson: JSON.stringify(transformResult.data, null, 2),
        success: true,
        transformDuration: transformResult.durationMs,
        forwardedAt: forwardingResult ? new Date() : null,
        forwardingSuccess: forwardingResult?.success ?? null,
        forwardingResponse: forwardingResult?.response 
          ? JSON.stringify(forwardingResult.response).slice(0, 10000) 
          : null,
        forwardingStatus: forwardingResult?.status ?? null,
        forwardDuration: forwardingResult?.durationMs ?? null,
        totalDuration,
        sourceIp,
        userAgent,
      },
    });

    // 8. Build response
    const response: Record<string, unknown> = {
      success: true,
      data: transformResult.data,
      meta: {
        adapterId,
        adapterName: adapter.name,
        transformedAt: new Date().toISOString(),
        transformDurationMs: transformResult.durationMs,
        totalDurationMs: totalDuration,
      },
    };

    // Include forwarding info if applicable
    if (forwardingResult) {
      response.forwarding = {
        success: forwardingResult.success,
        status: forwardingResult.status,
        durationMs: forwardingResult.durationMs,
        ...(forwardingResult.success 
          ? { response: forwardingResult.response }
          : { error: forwardingResult.error }
        ),
      };
    }

    return NextResponse.json(response, { status: 200, headers: corsHeaders });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Attempt to log the error
    try {
      await db.transformationLog.create({
        data: {
          adapterId,
          inputJson: '{}',
          success: false,
          error: errorMessage,
          totalDuration: Date.now() - totalStartTime,
          sourceIp,
          userAgent,
        },
      });
    } catch {
      console.error('Failed to log error:', errorMessage);
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error', message: errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Handle GET requests to show adapter info.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adapterId = params.id;

  try {
    const adapter = await db.adapter.findUnique({
      where: { id: adapterId },
      include: {
        _count: { select: { logs: true } },
      },
    });

    if (!adapter) {
      return NextResponse.json(
        { error: 'Adapter not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      id: adapter.id,
      name: adapter.name,
      description: adapter.description,
      targetSchema: JSON.parse(adapter.targetSchema),
      hasDestination: !!adapter.destinationUrl,
      isActive: adapter.isActive,
      totalTransformations: adapter._count.logs,
      createdAt: adapter.createdAt,
      usage: {
        method: 'POST',
        contentType: 'application/json',
        description: 'Send any JSON payload to transform it to the target schema',
      },
    }, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch adapter' },
      { status: 500, headers: corsHeaders }
    );
  }
}
