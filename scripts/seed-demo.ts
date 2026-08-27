/**
 * Seed demo data themed around the Lyon innovation ecosystem
 * (IRIIG demo — Sept 21, 2026).
 *
 * Creates:
 *  - a confirmed demo account (demo@gigo.dev / GigoLyon2026!)
 *  - 3 adapters: innovation events, startup leads → CRM, Vélo'v open data
 *  - ~24 realistic transformation logs spread over the last 10 days
 *
 * Idempotent: wipes and re-creates the demo user's adapters on each run.
 * Run with: bun scripts/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const DEMO_EMAIL = 'demo@gigo.dev';
const DEMO_PASSWORD = 'GigoLyon2026!';
const DEMO_NAME = 'Démo GIGO';

const db = new PrismaClient();

async function ensureDemoUser(): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Look for an existing auth user first
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`Supabase admin listUsers: ${listError.message}`);
  let authUser = list.users.find((u) => u.email === DEMO_EMAIL);

  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DEMO_NAME },
    });
    if (error) throw new Error(`Supabase admin createUser: ${error.message}`);
    authUser = data.user!;
    console.log(`✔ Compte auth créé : ${DEMO_EMAIL}`);
  } else {
    console.log(`✔ Compte auth déjà présent : ${DEMO_EMAIL}`);
  }

  await db.user.upsert({
    where: { id: authUser.id },
    update: { email: DEMO_EMAIL, name: DEMO_NAME },
    create: { id: authUser.id, email: DEMO_EMAIL, name: DEMO_NAME },
  });

  return authUser.id;
}

const daysAgo = (d: number, h = 10, m = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(h, m + Math.floor(Math.random() * 45), Math.floor(Math.random() * 59), 0);
  return date;
};

const pretty = (o: unknown) => JSON.stringify(o, null, 2);

interface LogSeed {
  input: unknown;
  output?: unknown;
  success?: boolean;
  error?: string;
  provider: 'openai' | 'anthropic';
  model: string;
  day: number;
  isTest?: boolean;
  forwarded?: boolean;
  sourceIp?: string;
  userAgent?: string;
}

async function createAdapterWithLogs(opts: {
  userId: string;
  name: string;
  description: string;
  targetSchema: unknown;
  modelProvider: 'openai' | 'anthropic';
  modelName: string;
  destinationUrl?: string;
  webhookSecret?: string;
  logs: LogSeed[];
}) {
  const adapter = await db.adapter.create({
    data: {
      userId: opts.userId,
      name: opts.name,
      description: opts.description,
      targetSchema: pretty(opts.targetSchema),
      schemaSourceType: 'manual',
      modelProvider: opts.modelProvider,
      modelName: opts.modelName,
      destinationUrl: opts.destinationUrl ?? null,
      destinationMethod: 'POST',
      authMethod: opts.destinationUrl ? 'bearer' : 'none',
      webhookSecret: opts.webhookSecret ?? null,
    },
  });

  for (const log of opts.logs) {
    const success = log.success ?? true;
    const transformMs = 700 + Math.floor(Math.random() * 1800);
    const forwardMs = log.forwarded ? 120 + Math.floor(Math.random() * 400) : null;
    await db.transformationLog.create({
      data: {
        adapterId: adapter.id,
        inputJson: pretty(log.input),
        outputJson: success && log.output ? pretty(log.output) : null,
        success,
        error: success ? null : (log.error ?? 'Transformation failed'),
        transformDuration: transformMs,
        forwardedAt: log.forwarded ? daysAgo(log.day) : null,
        forwardingSuccess: log.forwarded ? true : null,
        forwardingStatus: log.forwarded ? 200 : null,
        forwardingResponse: log.forwarded ? pretty({ status: 'received', id: `evt_${Math.random().toString(36).slice(2, 10)}` }) : null,
        forwardDuration: forwardMs,
        totalDuration: transformMs + (forwardMs ?? 0) + 40,
        provider: log.provider,
        modelName: log.model,
        inputTokens: 250 + Math.floor(Math.random() * 500),
        outputTokens: 60 + Math.floor(Math.random() * 180),
        isTest: log.isTest ?? false,
        sourceIp: log.isTest ? 'playground' : (log.sourceIp ?? '212.95.67.14'),
        userAgent: log.isTest ? 'GIGO Playground' : (log.userAgent ?? 'python-requests/2.32'),
        createdAt: daysAgo(log.day),
      },
    });
  }

  console.log(`✔ Adaptateur « ${opts.name} » + ${opts.logs.length} logs`);
  return adapter;
}

async function main() {
  const userId = await ensureDemoUser();

  // Idempotence: wipe the demo user's adapters (cascades to logs)
  const wiped = await db.adapter.deleteMany({ where: { userId } });
  if (wiped.count > 0) console.log(`  (reset : ${wiped.count} adaptateurs précédents supprimés)`);

  // ==========================================================
  // 1. Événements innovation Lyon (Claude) — fiches de salons
  // ==========================================================
  const eventSchema = {
    event_name: 'SIDO Lyon',
    start_date: '2026-09-17',
    end_date: '2026-09-18',
    venue: 'Cité Internationale, Lyon',
    theme: 'IoT, IA & robotique',
    organizer_email: 'contact@exemple.fr',
    expected_attendees: 9500,
    is_free: false,
  };

  await createAdapterWithLogs({
    userId,
    name: 'Événements innovation Lyon',
    description: 'Normalise les fiches événements (salons, meetups) vers notre format agenda',
    targetSchema: eventSchema,
    modelProvider: 'anthropic',
    modelName: 'claude-sonnet-5',
    webhookSecret: 'whsec_demo_lyon_2026_sido',
    logs: [
      {
        day: 9, provider: 'anthropic', model: 'claude-sonnet-5',
        input: {
          EVT_TITRE: 'SIDO LYON 2026', dates: '17 au 18 septembre 2026',
          lieu: { nom: 'Cité Internationale', ville: 'LYON' },
          thematique: 'IoT / IA / Robotique', nb_visiteurs_attendus: '9 500',
          tarif: 'payant', mail_orga: 'CONTACT@EXEMPLE.FR',
        },
        output: { ...eventSchema, organizer_email: 'contact@exemple.fr' },
      },
      {
        day: 8, provider: 'anthropic', model: 'claude-sonnet-5',
        input: {
          title: 'Pollutec 2026', period: '24-27 nov. 2026',
          location: 'Eurexpo Lyon-Chassieu', focus: 'cleantech & économie circulaire',
          visitors: 45000, free_entry: 'non', contact: 'info@exemple.fr',
        },
        output: {
          event_name: 'Pollutec 2026', start_date: '2026-11-24', end_date: '2026-11-27',
          venue: 'Eurexpo, Lyon-Chassieu', theme: 'Cleantech & économie circulaire',
          organizer_email: 'info@exemple.fr', expected_attendees: 45000, is_free: false,
        },
      },
      {
        day: 6, provider: 'anthropic', model: 'claude-sonnet-5',
        input: {
          nom_event: 'Apéro French Tech One Lyon', quand: 'jeudi 8 octobre 2026, 18h30',
          ou: "H7, 70 quai Perrache Lyon 2e", sujet: 'levées de fonds deeptech',
          places: '120', gratuit: 'oui', orga: 'events@exemple.fr',
        },
        output: {
          event_name: 'Apéro French Tech One Lyon', start_date: '2026-10-08', end_date: '2026-10-08',
          venue: 'H7, 70 quai Perrache, Lyon 2e', theme: 'Levées de fonds deeptech',
          organizer_email: 'events@exemple.fr', expected_attendees: 120, is_free: true,
        },
      },
      {
        day: 4, provider: 'anthropic', model: 'claude-sonnet-5',
        input: {
          titre: 'BioVision — World Life Sciences Forum', du: '2027-03-15', au: '2027-03-17',
          adresse: 'Centre de Congrès, Cité Internationale, Lyon 6e',
          domaine: 'santé & biotech', participants_estimes: 3000, entree_libre: false,
          email: 'forum@exemple.fr',
        },
        output: {
          event_name: 'BioVision — World Life Sciences Forum', start_date: '2027-03-15', end_date: '2027-03-17',
          venue: 'Centre de Congrès, Cité Internationale, Lyon 6e', theme: 'Santé & biotech',
          organizer_email: 'forum@exemple.fr', expected_attendees: 3000, is_free: false,
        },
      },
      {
        day: 3, provider: 'anthropic', model: 'claude-sonnet-5', success: false,
        error: 'Anthropic request timed out',
        input: { titre: 'Hackathon OnlyLyon x IRIIG', date: '??', lieu: 'à confirmer' },
      },
      {
        day: 1, provider: 'anthropic', model: 'claude-sonnet-5', isTest: true,
        input: {
          EVT_TITRE: 'Web Summit side-event Lyon', dates: '12/11/2026',
          lieu: { nom: 'Le Sucre', ville: 'Lyon 2e' }, tarif: 'gratuit',
          mail_orga: 'hello@exemple.fr', nb_visiteurs_attendus: '250',
        },
        output: {
          event_name: 'Web Summit side-event Lyon', start_date: '2026-11-12', end_date: '2026-11-12',
          venue: 'Le Sucre, Lyon 2e', theme: 'Tech & innovation',
          organizer_email: 'hello@exemple.fr', expected_attendees: 250, is_free: true,
        },
      },
    ],
  });

  // ==========================================================
  // 2. Leads startups → CRM (OpenAI) — écosystème lyonnais
  // ==========================================================
  const crmSchema = {
    company_name: 'Agicap',
    sector: 'fintech',
    city: 'Lyon',
    contact: { first_name: 'Camille', last_name: 'Durand', email: 'camille@exemple.fr' },
    funding_stage: 'series_b',
    amount_raised_eur: 15000000,
  };

  await createAdapterWithLogs({
    userId,
    name: 'Leads startups → CRM',
    description: "Nettoie les leads de l'écosystème French Tech One Lyon vers le format CRM",
    targetSchema: crmSchema,
    modelProvider: 'openai',
    modelName: 'gpt-4o-2024-08-06',
    destinationUrl: 'https://crm.exemple.fr/api/leads',
    logs: [
      {
        day: 10, provider: 'openai', model: 'gpt-4o-2024-08-06', forwarded: true,
        input: {
          societe: 'AGICAP', activite: 'gestion de trésorerie SaaS', ville: 'LYON',
          contact_nom: 'DURAND Camille', contact_mail: 'Camille.Durand@EXEMPLE.FR',
          stade: 'Série B', montant_leve: '15 M€',
        },
        output: crmSchema,
      },
      {
        day: 8, provider: 'openai', model: 'gpt-4o-2024-08-06', forwarded: true,
        sourceIp: '89.84.126.7', userAgent: 'Zapier',
        input: {
          company: 'Esker', what: 'automatisation documentaire (IA)', hq: 'Villeurbanne / Lyon',
          person: { firstname: 'thomas', lastname: 'morel', mail: 'thomas@exemple.fr' },
          stage: 'cotée en bourse', raised: 'N/A',
        },
        output: {
          company_name: 'Esker', sector: 'document automation / IA', city: 'Villeurbanne',
          contact: { first_name: 'Thomas', last_name: 'Morel', email: 'thomas@exemple.fr' },
          funding_stage: 'public', amount_raised_eur: 0,
        },
      },
      {
        day: 7, provider: 'openai', model: 'gpt-4o-2024-08-06', forwarded: true,
        input: {
          raison_sociale: 'Navya SAS', secteur: "navettes autonomes", commune: 'Villeurbanne',
          prenom: 'sofia', nom: 'BENALI', email_pro: 'SOFIA.BENALI@exemple.fr',
          "levée": { serie: 'C', montant: '30000000', devise: 'EUR' },
        },
        output: {
          company_name: 'Navya', sector: 'autonomous vehicles', city: 'Villeurbanne',
          contact: { first_name: 'Sofia', last_name: 'Benali', email: 'sofia.benali@exemple.fr' },
          funding_stage: 'series_c', amount_raised_eur: 30000000,
        },
      },
      {
        day: 5, provider: 'openai', model: 'gpt-4o-2024-08-06', forwarded: true,
        sourceIp: '89.84.126.7', userAgent: 'Make/2.1',
        input: {
          startup: 'The Greener Good', domaine: 'consommation responsable', localisation: 'Lyon 7e',
          referent: 'Léa Fontaine <lea@exemple.fr>', financement: 'amorçage, 800k€',
        },
        output: {
          company_name: 'The Greener Good', sector: 'green tech', city: 'Lyon',
          contact: { first_name: 'Léa', last_name: 'Fontaine', email: 'lea@exemple.fr' },
          funding_stage: 'seed', amount_raised_eur: 800000,
        },
      },
      {
        day: 4, provider: 'openai', model: 'gpt-4o-2024-08-06', success: false,
        error: 'OpenAI rate limit exceeded',
        input: { societe: 'batch import #442', rows: '250 leads CSV' },
      },
      {
        day: 2, provider: 'openai', model: 'gpt-4o-2024-08-06', forwarded: true,
        input: {
          org: 'H7 (incubateur)', type: "lieu totem French Tech", city: 'Lyon 2e — Confluence',
          main_contact: 'j.perret@exemple.fr (Jules Perret)', program: 'accélération',
        },
        output: {
          company_name: 'H7', sector: 'incubator', city: 'Lyon',
          contact: { first_name: 'Jules', last_name: 'Perret', email: 'j.perret@exemple.fr' },
          funding_stage: 'not_applicable', amount_raised_eur: 0,
        },
      },
      {
        day: 0, provider: 'openai', model: 'gpt-4o-2024-08-06', isTest: true,
        input: {
          societe: 'IRIIG', activite: "école d'innovation", ville: 'Lyon',
          contact: 'admissions@exemple.fr',
        },
        output: {
          company_name: 'IRIIG', sector: 'education / innovation', city: 'Lyon',
          contact: { first_name: '', last_name: '', email: 'admissions@exemple.fr' },
          funding_stage: 'not_applicable', amount_raised_eur: 0,
        },
      },
    ],
  });

  // ==========================================================
  // 3. Open Data Grand Lyon — Vélo'v (Claude) — format JCDecaux réel
  // ==========================================================
  const velovSchema = {
    station_id: '10023',
    station_name: 'Place Bellecour',
    district: 'Lyon 2e',
    bikes_available: 12,
    docks_available: 8,
    lat: 45.7578,
    lng: 4.832,
    updated_at: '2026-08-27T10:12:00Z',
  };

  const velovInput = (num: number, name: string, commune: string, bikes: number, stands: number, lat: number, lng: number, day: number) => ({
    number: num,
    name: `${num} - ${name.toUpperCase()}`,
    address: '',
    commune: commune.toUpperCase(),
    position: { lat, lng },
    available_bikes: String(bikes),
    available_bike_stands: String(stands),
    status: 'OPEN',
    last_update: daysAgo(day).getTime(),
  });

  await createAdapterWithLogs({
    userId,
    name: "Open Data Grand Lyon — Vélo'v",
    description: "Convertit le format brut de l'API JCDecaux vers notre schéma mobilité",
    targetSchema: velovSchema,
    modelProvider: 'anthropic',
    modelName: 'claude-sonnet-5',
    logs: [
      {
        day: 7, provider: 'anthropic', model: 'claude-sonnet-5',
        sourceIp: '134.214.108.22', userAgent: 'grandlyon-cron/1.0',
        input: velovInput(10023, 'Bellecour', 'Lyon 2 eme', 12, 8, 45.7578, 4.832, 7),
        output: velovSchema,
      },
      {
        day: 6, provider: 'anthropic', model: 'claude-sonnet-5',
        sourceIp: '134.214.108.22', userAgent: 'grandlyon-cron/1.0',
        input: velovInput(3080, 'Part-Dieu / Vivier Merle', 'Lyon 3 eme', 3, 19, 45.7605, 4.8593, 6),
        output: {
          station_id: '3080', station_name: 'Part-Dieu / Vivier Merle', district: 'Lyon 3e',
          bikes_available: 3, docks_available: 19, lat: 45.7605, lng: 4.8593,
          updated_at: daysAgo(6).toISOString(),
        },
      },
      {
        day: 5, provider: 'anthropic', model: 'claude-sonnet-5',
        sourceIp: '134.214.108.22', userAgent: 'grandlyon-cron/1.0',
        input: velovInput(1002, 'Opera', 'Lyon 1 er', 7, 13, 45.7679, 4.8368, 5),
        output: {
          station_id: '1002', station_name: 'Opéra', district: 'Lyon 1er',
          bikes_available: 7, docks_available: 13, lat: 45.7679, lng: 4.8368,
          updated_at: daysAgo(5).toISOString(),
        },
      },
      {
        day: 3, provider: 'anthropic', model: 'claude-sonnet-5',
        sourceIp: '134.214.108.22', userAgent: 'grandlyon-cron/1.0',
        input: velovInput(7045, 'Gerland / Halle Tony Garnier', 'Lyon 7 eme', 21, 1, 45.7314, 4.8318, 3),
        output: {
          station_id: '7045', station_name: 'Gerland / Halle Tony Garnier', district: 'Lyon 7e',
          bikes_available: 21, docks_available: 1, lat: 45.7314, lng: 4.8318,
          updated_at: daysAgo(3).toISOString(),
        },
      },
      {
        day: 2, provider: 'anthropic', model: 'claude-sonnet-5',
        sourceIp: '134.214.108.22', userAgent: 'grandlyon-cron/1.0',
        input: velovInput(9012, 'Valmy', 'Lyon 9 eme', 0, 22, 45.7772, 4.8046, 2),
        output: {
          station_id: '9012', station_name: 'Valmy', district: 'Lyon 9e',
          bikes_available: 0, docks_available: 22, lat: 45.7772, lng: 4.8046,
          updated_at: daysAgo(2).toISOString(),
        },
      },
      {
        day: 1, provider: 'anthropic', model: 'claude-sonnet-5',
        sourceIp: '134.214.108.22', userAgent: 'grandlyon-cron/1.0',
        input: velovInput(2010, 'Confluence / H7', 'Lyon 2 eme', 15, 5, 45.7402, 4.8155, 1),
        output: {
          station_id: '2010', station_name: 'Confluence / H7', district: 'Lyon 2e',
          bikes_available: 15, docks_available: 5, lat: 45.7402, lng: 4.8155,
          updated_at: daysAgo(1).toISOString(),
        },
      },
    ],
  });

  const [users, adapters, logs] = await Promise.all([
    db.user.count(),
    db.adapter.count({ where: { userId } }),
    db.transformationLog.count({ where: { adapter: { userId } } }),
  ]);

  console.log('\n=== Seed terminé ===');
  console.log(`Login démo : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Adaptateurs : ${adapters} · Logs : ${logs} · Users en base : ${users}`);
}

main()
  .catch((err) => {
    console.error('SEED ÉCHOUÉ :', err.message || err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
