import { PrismaClient } from '@prisma/client';
async function main() {
  const db = new PrismaClient();
  const rows = await db.adapter.findMany({ select: { id: true, name: true, modelProvider: true, webhookSecret: true } });
  console.log("count:", rows.length);
  console.log(JSON.stringify(rows, null, 2));
  await db.$disconnect();
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
