/**
 * Creates the connector used by the multi-format demo.
 *
 * The scenario is deliberately one where several formats are not a gimmick but
 * the normal state of affairs: a shipper receives tracking events from four
 * carriers, and every carrier has its own system, its own vocabulary and its
 * own file format. Nobody will ever agree on one. That is precisely the problem
 * a universal adapter exists for.
 *
 *   bun scripts/seed-demo-livraisons.ts
 */

import { db } from '../src/lib/db';
import { generateWebhookSecret } from '../src/lib/security';

const NAME = 'Transporteurs → Suivi client';

const TARGET = {
  tracking_number: 'COL-2026-884512',
  carrier: 'chronopost',
  status: 'in_transit',
  status_label: 'En cours de livraison',
  recipient_name: 'Nadia Cherif',
  recipient_email: 'nadia.cherif@exemple.fr',
  recipient_phone: '+33612345678',
  delivery_city: 'Villeurbanne',
  delivery_postcode: '69100',
  weight_grams: 2450,
  shipped_at: '2026-09-18T08:30:00+02:00',
  estimated_delivery: '2026-09-21',
  incident: false,
};

const SAMPLE = {
  NUM_COLIS: '  col-2026-884512 ',
  transporteur: 'CHRONOPOST',
  etat: 'EN COURS DE LIVRAISON',
  destinataire: {
    nom_complet: 'CHERIF nadia',
    mail: '  Nadia.Cherif@Exemple.FR ',
    tel: '06 12 34 56 78',
    adresse: '22 rue Franklin, 69100 villeurbanne',
  },
  poids_affiche: '2,45 kg',
  date_expedition: '18/09/2026 08:30',
  livraison_estimee: '21/09/2026',
  incident: 'non',
  meta_interne: { tournee: 'LYO-7', scan: 'sess_9f2ab41' },
};

async function main() {
  const user = await db.user.findFirst({ where: { email: 'demo@gigo.dev' } });
  if (!user) throw new Error('compte de démonstration introuvable');

  const existing = await db.adapter.findFirst({ where: { userId: user.id, name: NAME } });
  if (existing) {
    await db.transformationLog.deleteMany({ where: { adapterId: existing.id } });
    await db.adapter.delete({ where: { id: existing.id } });
    console.log('ancien connecteur supprimé');
  }

  const adapter = await db.adapter.create({
    data: {
      userId: user.id,
      name: NAME,
      description:
        'Quatre transporteurs, quatre systèmes, quatre formats. Un seul suivi pour le client.',
      targetSchema: JSON.stringify(TARGET, null, 2),
      samplePayload: JSON.stringify(SAMPLE, null, 2),
      schemaSourceType: 'manual',
      modelProvider: 'openai',
      destinationUrl: process.env.DEMO_DESTINATION_URL ?? null,
      destinationMethod: 'POST',
      authMethod: 'none',
      webhookSecret: generateWebhookSecret(),
      forwardTimeoutMs: 10_000,
      rateLimitPerMin: 120,
      outputFormat: 'json',
      isActive: true,
    },
  });

  console.log('connecteur créé');
  console.log('  nom      :', adapter.name);
  console.log('  id       :', adapter.id);
  console.log('  secret   :', adapter.webhookSecret);
  console.log('  destination :', adapter.destinationUrl ?? 'aucune');
  await db.$disconnect();
}

main();
