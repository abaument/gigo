 # GIGO — Runbook opérationnel (FR)

> Le guide de survie pour lancer, dépanner et **démontrer** GIGO.
> Le README.md (anglais) est la vitrine publique ; ce fichier est ton manuel de bord.

---

## 0. Prérequis (une fois par machine)

```bash
# bun est installé dans ~/.bun — ouvre un nouveau terminal, ou :
export PATH="$HOME/.bun/bin:$PATH"

cd ~/Desktop/Gigo/universal-data-adapter
bun install
```

**Fichier `.env`** — les 7 variables obligatoires (voir `.env.example`) :

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | idem |
| `DATABASE_URL` | Actuellement en **connexion directe** `db.<ref>.supabase.co:5432` (le pooler s'était désenregistré après une pause). Les caractères spéciaux du mot de passe doivent être encodés (`*` → `%2A`) |
| `OPENAI_API_KEY` | platform.openai.com |
| `ANTHROPIC_API_KEY` | console.anthropic.com — **manquante aujourd'hui** : sans elle, le provider Claude renvoie une erreur AUTH (OpenAI fonctionne) |
| `ENCRYPTION_KEY` | 16+ caractères — **l'app refuse de démarrer sans** |

---

## 1. Tout exécuter

### Développement (le quotidien)

```bash
bun run dev            # → http://localhost:3000
```

### Qualité

```bash
bun run test           # 61 tests Vitest (aucune clé API requise, tout est mocké)
bun run test:watch     # en continu
bunx tsc --noEmit      # typecheck strict
bun run build          # build de production
```

### Base de données

```bash
bun run db:deploy      # applique les migrations (prod-safe, ne génère rien)
bun run db:migrate     # crée une NOUVELLE migration après modif de prisma/schema.prisma
bun run db:generate    # régénère le client Prisma
bun run db:studio      # interface web pour explorer les données
bun run migrate:encryption   # one-shot : re-chiffre les vieux credentials CryptoJS → AES-GCM
```

### Production locale

```bash
bun run build && bun run start   # sert le build sur :3000
```

### Docker (self-host)

```bash
docker compose up -d   # Postgres inclus + migrations automatiques + app sur :3000
docker compose logs -f app
docker compose down    # -v pour supprimer aussi les données
```
> ⚠ Le build d'image complet n'a jamais été testé (Docker n'était pas lancé sur cette machine).
> **À tester une fois avant de le montrer** — prévois ~5 min de build la première fois.

### Tester le webhook à la main

```bash
# L'URL et le cURL exacts (avec secret) sont copiables depuis la page de l'adaptateur
curl -X POST http://localhost:3000/api/webhook/<ADAPTER_ID> \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: whsec_..." \
  -d '{"user_first_name": "jean", "amount": "49,90 €"}'
```

---

## 2. Dépannage — erreurs connues

| Symptôme | Cause | Remède |
|---|---|---|
| `tenant/user postgres.xxx not found` / webhook en 500 | **Le projet Supabase gratuit s'est mis en pause** (≈1 semaine d'inactivité). C'est arrivé 2 fois déjà. | Dashboard Supabase → « Restore project » (2-3 min). Voir §3 pour l'empêcher avant la démo |
| `ENCRYPTION_KEY environment variable is required` | `.env` absent ou clé < 16 chars | Compléter `.env` |
| Login : « Email not confirmed » | Confirmation email active par défaut | Supabase → Authentication → Sign In/Providers → Email → décocher « Confirm email » |
| Playground : erreur AUTH avec Claude | `ANTHROPIC_API_KEY` absente | L'ajouter au `.env`, relancer `bun run dev` |
| `RATE_LIMIT — OpenAI rate limit exceeded` dès le 1er appel | **Crédits OpenAI épuisés** (le 429 d'OpenAI couvre aussi insufficient_quota) | Recharger le compte sur platform.openai.com → Billing |
| Données disparues juste après un « Restore » Supabase | La restauration écrase la base pendant plusieurs minutes | Attendre la fin du restore, puis relancer `bun run db:deploy` + `bun scripts/seed-demo.ts` (idempotent) |
| `429 RATE_LIMITED` sur le playground | Garde-fou : 20 tests/min/utilisateur | Attendre 1 min (ou le dire au jury : « c'est une protection, elle marche ») |
| `command not found: bun` | PATH du shell | `export PATH="$HOME/.bun/bin:$PATH"` ou nouveau terminal |
| Le build casse en CI/Docker sans `.env` | Normal : des valeurs factices sont injectées (voir `ci.yml` / `Dockerfile`) | Rien à faire |

---

## 3. Préparer la démo du 21 septembre

### ⚠ Le risque n°1 : Supabase en pause le jour J

Le projet gratuit se met en veille après ~1 semaine sans activité. **Trois parades, choisis-en une :**

1. **(Recommandé)** Passer le projet en plan Pro (~25 $/mois) pour septembre uniquement → plus jamais de pause.
2. Ping hebdomadaire : ouvrir le dashboard Supabase ou lancer l'app 1×/semaine, et **impérativement à J-1 et le matin du jour J**.
3. Démo 100 % locale via `docker compose up` (Postgres local inclus) — mais l'auth passe quand même par Supabase cloud, donc le projet doit être réveillé de toute façon.

### Checklist J-21 → J-7 (avant le 14 septembre)

- [ ] **Réveiller Supabase** (il est en pause en ce moment même) et décider : Pro ou ping hebdo
- [ ] **Ajouter `ANTHROPIC_API_KEY`** au `.env` → la démo « 2 moteurs d'IA » ne marche pas sans
- [ ] Créditer les comptes API (OpenAI + Anthropic) : ~5 € suffisent largement
- [x] Compte de démo créé par le seed : `demo@gigo.dev` / `GigoLyon2026!`
- [ ] Désactiver « Confirm email » dans Supabase (évite un blocage en live)
- [x] 3 adaptateurs lyonnais seedés (`bun scripts/seed-demo.ts`, idempotent) : Événements innovation Lyon, Leads startups → CRM, Vélo'v Grand Lyon
- [x] 19 logs réalistes seedés sur 10 jours (succès, échecs à rejouer, tests playground)
- [ ] **Tester `docker compose up` une fois** de bout en bout
- [ ] Enregistrer une **vidéo de secours** (2-3 min, screen recording du scénario complet) — le plan B absolu
- [ ] Optionnel mais fort : déployer une instance sur **Vercel** → une URL publique = plan B réseau + « c'est déjà en ligne »

### Checklist J-1

- [ ] Ouvrir l'app, faire un test playground complet (réveille Supabase + vérifie les clés API)
- [ ] Re-tester le cURL webhook + le forwarding vers webhook.site
- [ ] Recharger la vidéo de secours sur le bureau
- [ ] Charger le laptop, préparer le partage de connexion du téléphone (plan B WiFi)

### Jour J — mise en scène

- [ ] Zoom navigateur à 125-150 % (le fond de salle doit lire le JSON)
- [ ] Mode Ne pas déranger (macOS) — zéro notification
- [ ] Fermer tous les onglets sauf : GIGO, webhook.site, terminal
- [ ] Terminal : police 18+, le cURL de démo pré-tapé dans l'historique (`↑` suffit)
- [ ] `bun run dev` lancé AVANT de monter sur scène + un test playground fait

---

## 4. Le scénario « wahou » (7 minutes)

> Fil rouge : *« Je ne vais pas vous parler du produit, je vais le faire fonctionner devant vous. »*

**Acte 1 — Le problème incarné (1 min).**
Slide « spaghetti » du PPT, puis : « Voici les données qu'envoie réellement un formulaire mal fichu » — montre un JSON sale préparé (casse incohérente, montant `"49,90 €"` en texte, structure imbriquée).

**Acte 2 — Créer un adaptateur en direct (2 min).**
New Adapter → onglet **« From Docs (AI) »** → colle un extrait de doc d'API (préparé) → **le schéma se génère sous leurs yeux** → nomme l'adaptateur, choisis **Claude**, crée.
*Effet : « je n'ai écrit ni code ni règle de mapping ».*

**Acte 3 — Le playground (2 min). Le moment wahou.**
Colle le JSON sale → **Run** → la sortie propre apparaît avec latence + tokens + modèle.
Puis improvise : *« donnez-moi un champ à ajouter dans le JSON d'entrée »* — le jury dicte, tu l'ajoutes, tu relances → l'IA le mappe ou l'ignore proprement. C'est l'imprévu maîtrisé qui bluffe.

**Acte 4 — Le vrai webhook + forwarding (1,5 min).**
Écran partagé avec **webhook.site** (ouvert en plan B visuel) : configure la destination de l'adaptateur vers l'URL webhook.site → depuis le terminal, envoie le cURL → **le payload transformé apparaît en direct sur webhook.site**.
Bonus sécurité 10 s : enlève le header `X-Webhook-Secret` du cURL → **401 en live** → « et voilà pourquoi on peut l'exposer sur Internet ».

**Acte 5 — L'observabilité (30 s).**
Page Logs : le call apparaît (indicateur live), clique → drawer avec input/output/durées/tokens → bouton **Replay** sur un échec préparé.

**Clôture.** Bascule l'interface en FR/EN en un clic, puis : *« Tout ce que vous venez de voir sera open source — voici la roadmap. »* → slide finale.

### Plans B en cascade

1. Le WiFi lâche → partage de connexion téléphone (préparé J-1)
2. Supabase/OpenAI down → instance Vercel déployée (si faite) 
3. Tout est down → **la vidéo de secours** (et tu la commentes en live, ça passe très bien)

---

## 4bis. Déployer la démo publique sur Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → `abaument/gigo` (framework Next.js auto-détecté).
2. Variables d'environnement à coller (Settings → Environment Variables) :
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (⚠ les valeurs **régénérées**)
   - `DATABASE_URL` = **pooler** (IPv4, obligatoire sur Vercel) : `postgresql://postgres.<ref>:<MDP-ENCODÉ>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`
   - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ENCRYPTION_KEY`
   - `NEXT_PUBLIC_BASE_URL` = l'URL Vercel (ex. `https://gigo-demo.vercel.app`) — redéployer après l'avoir connue
   - `MONTHLY_TOKEN_QUOTA` = `150000` (garde-fou : ~quelques euros max par utilisateur/mois)
3. En parallèle, plafonner la dépense côté fournisseurs : OpenAI → Billing → *Monthly budget* ; Anthropic → *Spend limits*.
4. Chaque `git push` sur main redéploie automatiquement. Supprimer le projet Vercel après la démo = le « site éphémère » disparaît.

## 5. Rappels sécurité (avant de rendre le repo public)

- [ ] **Régénérer les secrets Supabase** (mot de passe DB + service_role + secret key — ils ont circulé en clair)
- [ ] Vérifier que `.env` n'est pas commité (`git log --all --full-history -- .env` doit être vide)
- [ ] Choisir la **licence** (MIT ou AGPL) — le README l'attend, c'est le dernier bloquant de publication
