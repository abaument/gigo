/**
 * One-shot, idempotent migration of adapter credentials from legacy
 * CryptoJS ciphertexts to AES-256-GCM (`v1:` prefix).
 *
 * Tries the current ENCRYPTION_KEY first, then the old hardcoded dev
 * fallback (some prod rows may have been encrypted with it before the
 * fallback was removed).
 *
 * Run with: bun scripts/migrate-encryption.ts
 */

import { PrismaClient } from '@prisma/client';
import { encrypt, decryptLegacy, isLegacyCiphertext } from '../src/lib/encryption';

const LEGACY_FALLBACK_KEY = 'default-dev-key-change-in-prod!';

const db = new PrismaClient();

async function main() {
  const adapters = await db.adapter.findMany({
    where: { encryptedAuthValue: { not: null } },
    select: { id: true, name: true, encryptedAuthValue: true },
  });

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const adapter of adapters) {
    const ciphertext = adapter.encryptedAuthValue!;
    if (!isLegacyCiphertext(ciphertext)) {
      skipped++;
      continue;
    }

    let plaintext = '';
    for (const key of [process.env.ENCRYPTION_KEY!, LEGACY_FALLBACK_KEY]) {
      try {
        plaintext = decryptLegacy(ciphertext, key);
        if (plaintext) break;
      } catch {
        // wrong key — try the next one
      }
    }

    if (!plaintext) {
      console.warn(`SKIP (undecryptable): adapter ${adapter.id} "${adapter.name}"`);
      failed++;
      continue;
    }

    await db.adapter.update({
      where: { id: adapter.id },
      data: { encryptedAuthValue: encrypt(plaintext) },
    });
    migrated++;
  }

  console.log(`Done. migrated=${migrated} already-v1=${skipped} undecryptable=${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
