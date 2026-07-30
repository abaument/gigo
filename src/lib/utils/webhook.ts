/**
 * Webhook URL / cURL helpers — the single place that knows how to build
 * the public endpoint URL.
 */

export function buildWebhookUrl(adapterId: string): string {
  const base =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_URL) ||
    'http://localhost:3000';
  return `${base}/api/webhook/${adapterId}`;
}

export function buildCurl(
  adapterId: string,
  body: string = '{"example": "payload"}',
  webhookSecret?: string | null
): string {
  const lines = [
    `curl -X POST ${buildWebhookUrl(adapterId)} \\`,
    `  -H "Content-Type: application/json" \\`,
  ];
  if (webhookSecret) {
    lines.push(`  -H "X-Webhook-Secret: ${webhookSecret}" \\`);
  }
  lines.push(`  -d '${body.replace(/'/g, `'\\''`)}'`);
  return lines.join('\n');
}
