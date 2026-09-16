/**
 * Payload pairs shown in the landing hero.
 *
 * Trimmed from scripts/demo-scenarios.json (the same scenarios the demo
 * account is seeded with) so the page shows real inputs and real target
 * structures, never invented ones.
 */

import type { TransformPair } from './LiveTransform';

/**
 * What the model actually corrected, per pair. Shown as lettered notes
 * under the bench so the visitor reads the transformation instead of
 * guessing it. Keys index into the `landing.hero.notes` messages.
 */
export const HERO_NOTES: string[][] = [
  ['n1a', 'n1b', 'n1c'],
  ['n2a', 'n2b', 'n2c'],
  ['n3a', 'n3b', 'n3c'],
];

export const HERO_PAIRS: TransformPair[] = [
  {
    tag: 'e-commerce',
    ms: 1840,
    input: `{
  "REF_CMDE": "  fa-2026-0412 ",
  "date_cmd": "12/03/2026",
  "acheteur": {
    "prenom_contact": "jean-PIERRE",
    "nom_du_contact": "MARTIN",
    "mail": "  JP.Martin@Exemple.FR "
  },
  "expedition": { "commune": "villeurbanne" },
  "total_ttc_affiche": "1 250,50 €",
  "tracking": { "utm_source": "instagram_ads" }
}`,
    output: `{
  "invoice_number": "FA-2026-0412",
  "issue_date": "2026-03-12",
  "customer_first_name": "Jean-Pierre",
  "customer_last_name": "Martin",
  "customer_email": "jp.martin@exemple.fr",
  "shipping_city": "Villeurbanne",
  "total_incl_vat_cents": 125050,
  "currency": "EUR"
}`,
  },
  {
    tag: 'support',
    ms: 2260,
    input: `{
  "source": "email",
  "from": "  J.MARCHAND@Boulangerie-CR.FR ",
  "from_name": "jean-PIERRE MARCHAND",
  "subject": "URGENT!!! le TPE est down depuis ce matin",
  "body": "Depuis 8h le terminal ne repond plus.
    Commande CMD-2026-88245, facture 1 250,50 € TTC.
    Rappelez vite au 06 12 34 56 78."
}`,
    output: `{
  "ticket_reference": "CMD-2026-88245",
  "requester_first_name": "Jean-Pierre",
  "requester_last_name": "Marchand",
  "requester_email": "j.marchand@boulangerie-cr.fr",
  "requester_phone": "+33612345678",
  "priority": "high",
  "category": "payment_terminal"
}`,
  },
  {
    tag: 'capteurs',
    ms: 1610,
    input: `{
  "devEUI": "70B3D57ED0056A21",
  "station": " lyon-confluence-03 ",
  "ts": "09/03/2026 07:30",
  "mesures": {
    "pm25": "18,4 ug/m3",
    "no2": "52,7",
    "temp": "7,9 C"
  },
  "batt": "84%"
}`,
    output: `{
  "station_id": "LYON-CONFLUENCE-03",
  "measured_at": "2026-03-09T07:30:00+01:00",
  "pm25_ug_m3": 18.4,
  "no2_ug_m3": 52.7,
  "temperature_c": 7.9,
  "status": "vigilance",
  "battery_percent": 84
}`,
  },
];
