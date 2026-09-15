/**
 * Rich demo scenarios seeder — five realistic Lyon-ecosystem adapters
 * (e-commerce, RH, IoT, support email, billetterie) with dirty sample
 * payloads, learnings and believable log history.
 *
 *   bun scripts/seed-demo-scenarios.ts
 *
 * Idempotent: adapters are matched by name for the demo user; logs and
 * learnings are only seeded when the adapter is first created. Also
 * backfills `samplePayload` on any older adapter from its most recent
 * successful log, so every adapter's playground opens pre-filled.
 */

import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import scenarios from './demo-scenarios.json';

const db = new PrismaClient();
const DEMO_EMAIL = 'demo@gigo.dev';

const pretty = (v: unknown) => JSON.stringify(v, null, 2);
const hash = (...parts: string[]) =>
  createHash('sha256').update(parts.join(' ')).digest('hex');
const daysAgo = (days: number, hourJitter = true) => {
  const d = new Date(Date.now() - days * 86_400_000);
  if (hourJitter) d.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60));
  return d;
};

interface ScenarioLog {
  input: unknown;
  output?: unknown;
  success: boolean;
  error?: string;
  isTest?: boolean;
  isReplay?: boolean;
  /** destination did not answer before the deadline (no HTTP status) */
  forwardTimeout?: boolean;
  transformMs: number;
  inputTokens: number;
  outputTokens: number;
  forwardingStatus?: number;
}

interface Scenario {
  name: string;
  description: string;
  modelProvider: 'openai' | 'anthropic';
  destinationUrl: string;
  targetSchema: unknown;
  samplePayload: unknown;
  secondPayload: unknown;
  learningExample: { input: unknown; output: unknown };
  learningPitfall: string;
  logs: ScenarioLog[];
}

async function seedScenario(userId: string, s: Scenario) {
  const existing = await db.adapter.findFirst({
    where: { userId, name: s.name },
    select: { id: true },
  });

  if (existing) {
    // deterministic demo content: recreate from scratch (logs and
    // learnings cascade) so a fixed scenario file always wins
    await db.adapter.delete({ where: { id: existing.id } });
    console.log(`↺  ${s.name} — recréé`);
  }

  const adapter = await db.adapter.create({
    data: {
      userId,
      name: s.name,
      description: s.description,
      targetSchema: pretty(s.targetSchema),
      samplePayload: pretty(s.samplePayload),
      schemaSourceType: 'manual',
      modelProvider: s.modelProvider,
      modelName: s.modelProvider === 'anthropic' ? 'claude-sonnet-5' : 'gpt-4o-2024-08-06',
      destinationUrl: s.destinationUrl,
      destinationMethod: 'POST',
      authMethod: 'bearer',
      webhookSecret: `whsec_demo_${randomBytes(9).toString('base64url')}`,
    },
  });

  // Learnings: one validated example + one pitfall constraint
  const exampleInput = pretty(s.learningExample.input);
  await db.adapterLearning.createMany({
    data: [
      {
        adapterId: adapter.id,
        kind: 'example',
        inputJson: exampleInput,
        outputJson: pretty(s.learningExample.output),
        source: 'replay',
        contentHash: hash('example', exampleInput),
        createdAt: daysAgo(6),
      },
      {
        adapterId: adapter.id,
        kind: 'pitfall',
        note: s.learningPitfall,
        source: 'auto',
        contentHash: hash('pitfall', s.learningPitfall),
        createdAt: daysAgo(9),
      },
    ],
    skipDuplicates: true,
  });

  // Log history over the last two weeks (oldest first). One timestamp per
  // row, strictly increasing — replays always come after their failure.
  let day = s.logs.length * 2 + 2;
  let replaySourceId: string | null = null;
  for (const log of s.logs) {
    day -= 1 + Math.floor(Math.random() * 2);
    const when = daysAgo(Math.max(day, 0));
    // forwarding is attempted on every non-test success (destination set):
    // either delivered (HTTP status) or timed out (no status, like the app)
    const attempted = log.success && !log.isTest;
    const timedOut = Boolean(log.forwardTimeout);
    const delivered = attempted && !timedOut;
    const forwardMs = timedOut ? 15_000 : delivered ? 150 + Math.floor(Math.random() * 350) : 0;
    const created: { id: string } = await db.transformationLog.create({
      data: {
        adapterId: adapter.id,
        inputJson: pretty(log.input),
        outputJson: log.success && log.output ? pretty(log.output) : null,
        success: log.success,
        error: log.error ?? null,
        transformDuration: log.transformMs,
        forwardedAt: attempted ? new Date(when.getTime() + log.transformMs) : null,
        forwardingSuccess: attempted ? delivered : null,
        forwardingStatus: delivered ? (log.forwardingStatus ?? 201) : null,
        forwardingResponse: delivered
          ? pretty({ status: 'created', id: `rec_${randomBytes(4).toString('hex')}` })
          : null,
        forwardDuration: attempted ? forwardMs : null,
        totalDuration: log.transformMs + forwardMs + 40,
        provider: s.modelProvider,
        modelName: s.modelProvider === 'anthropic' ? 'claude-sonnet-5' : 'gpt-4o-2024-08-06',
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        isTest: log.isTest ?? false,
        replayOfId: log.isReplay ? replaySourceId : null,
        sourceIp: log.isTest ? 'playground' : log.isReplay ? 'replay' : '92.184.108.24',
        userAgent: log.isTest ? 'GIGO Playground' : log.isReplay ? 'GIGO Replay' : 'Weezevent-Webhooks/2.1',
        createdAt: when,
      },
    });
    if (!log.success) replaySourceId = created.id;
  }

  console.log(`✓  ${s.name} — ${s.logs.length} logs, 2 apprentissages`);
}

async function main() {
  const user = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    console.error(`Compte démo ${DEMO_EMAIL} introuvable — lancer d'abord: bun scripts/seed-demo.ts`);
    process.exit(1);
  }

  for (const s of scenarios as Scenario[]) {
    await seedScenario(user.id, s);
  }

  // Backfill: any adapter without a sample payload inherits the input of
  // its most recent successful non-test log.
  const missing = await db.adapter.findMany({
    where: { userId: user.id, samplePayload: null },
    select: { id: true, name: true },
  });
  for (const a of missing) {
    const lastOk = await db.transformationLog.findFirst({
      where: { adapterId: a.id, success: true, isTest: false },
      orderBy: { createdAt: 'desc' },
      select: { inputJson: true },
    });
    // never backfill a value the form's own validator (100k cap) refuses
    if (lastOk && lastOk.inputJson.length <= 100_000) {
      await db.adapter.update({
        where: { id: a.id },
        data: { samplePayload: lastOk.inputJson },
      });
      console.log(`⤷  sample backfillé depuis les logs : ${a.name}`);
    }
  }

  const total = await db.adapter.count({ where: { userId: user.id } });
  console.log(`\nTerminé — ${total} adaptateurs sur le compte démo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
