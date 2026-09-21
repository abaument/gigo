/**
 * Demo: ten files, four formats, one connector.
 *
 * Sends every file in scripts/demo-formats to the same adapter and prints what
 * came back. The point is visible in the last column: whatever went in, the
 * output is the same structure, ready for the destination tool.
 *
 *   bun scripts/demo-formats.ts
 *
 * Options
 *   --adapter <id>   target another adapter
 *   --secret <value> its webhook secret
 *   --local          hit http://localhost:3000 instead of production
 *   --slow           one second between files, easier to narrate
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

const BASE = args.includes('--local')
  ? 'http://localhost:3000'
  : 'https://gigo-two.vercel.app';
const ADAPTER = flag('adapter') ?? 'cae78954-cf77-4002-9b4f-e47172f80775';
const SECRET = flag('secret') ?? 'whsec_IBB4HD8ePiJM0VWME1RYWDSIPjHEPhP9';
const PAUSE_MS = args.includes('--slow') ? 1000 : 150;

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'demo-formats');

const CONTENT_TYPE: Record<string, string> = {
  json: 'application/json',
  xml: 'application/xml',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const colour = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  gold: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(file: string) {
  const ext = file.split('.').pop()!.toLowerCase();
  const bytes = readFileSync(join(DIR, file));
  const started = Date.now();

  const response = await fetch(`${BASE}/api/webhook/${ADAPTER}`, {
    method: 'POST',
    headers: { 'Content-Type': CONTENT_TYPE[ext] ?? 'application/octet-stream', 'X-Webhook-Secret': SECRET },
    body: bytes,
  });

  const elapsed = Date.now() - started;
  const body = await response.json().catch(() => ({}) as Record<string, unknown>);
  return { ext, status: response.status, elapsed, body };
}

function summarise(data: Record<string, unknown> | undefined): string {
  if (!data) return '';
  const weight = typeof data.weight_grams === 'number' ? `${data.weight_grams} g` : '';
  return [
    data.tracking_number,
    data.status,
    data.recipient_name,
    data.delivery_city,
    weight,
    data.incident === true ? 'incident' : '',
  ]
    .filter(Boolean)
    .join('  ');
}

// iCloud drops conflict copies named "file 2.csv" into synced folders, and
// sending those would double the demo without anybody noticing
const files = readdirSync(DIR)
  .filter((f) => !f.startsWith('.') && !/ \d+\.[a-z]+$/i.test(f))
  .sort();

console.log();
console.log(colour.bold('  Quatre transporteurs, quatre formats, un seul suivi'));
console.log(colour.dim(`  ${BASE}/api/webhook/${ADAPTER}`));
console.log();
console.log(
  colour.dim('  ' + 'fichier'.padEnd(32) + 'format'.padEnd(8) + 'statut'.padEnd(8) + 'durée'.padEnd(9) + 'sortie normalisée')
);
console.log(colour.dim('  ' + '-'.repeat(110)));

const timings: number[] = [];
let ok = 0;

for (const file of files) {
  const { ext, status, elapsed, body } = await send(file);
  const data = (body as { data?: Record<string, unknown> }).data;
  const good = status === 200;
  if (good) {
    ok += 1;
    timings.push(elapsed);
  }

  console.log(
    '  ' +
      file.padEnd(32) +
      colour.gold(ext.padEnd(8)) +
      (good ? colour.green('200'.padEnd(8)) : colour.red(String(status).padEnd(8))) +
      `${elapsed}ms`.padEnd(9) +
      (good ? summarise(data) : colour.red(String((body as { message?: string }).message ?? '')))
  );

  await sleep(PAUSE_MS);
}

const avg = timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : 0;
console.log(colour.dim('  ' + '-'.repeat(110)));
console.log(`  ${colour.bold(`${ok}/${files.length}`)} transformés, ${avg} ms en moyenne, ` +
  `4 formats en entrée, ${colour.gold('un seul schéma en sortie')}`);
console.log();
console.log(colour.dim('  Regarder maintenant :'));
console.log(`  journal        ${BASE}/adapters/${ADAPTER}/logs`);
console.log(`  apprentissages ${BASE}/adapters/${ADAPTER}#apprentissages`);
console.log();
