# GIGO — Garbage In, Gold Out

**The AI-powered universal data adapter.** Send any JSON to a webhook, get back a payload that matches *your* schema — renamed, retyped, restructured — and optionally forwarded straight to its destination.

No field-by-field mapping rules. You show GIGO **one example** of the output you want; the AI understands the *meaning* of incoming data and reshapes it accordingly.

```
{ "user_first_name": "jean",          { "first_name": "Jean",
  "user_MAIL": "jean@ex.fr",    ──►     "email": "jean@ex.fr",
  "amount": "49,90 €",                  "amount_cents": 4990,
  "infos": { "ville": "Lyon" } }        "city": "Lyon" }
```

## Why

Every service speaks its own dialect: `firstName` here, `first_name` there, amounts as strings, nested structures nobody agreed on. Connecting N sources to M destinations means writing and maintaining N×M brittle integrations. GIGO replaces them with a single hub: one webhook per target schema, AI does the translation, full audit trail included.

## Features

- **Adapters by example** — paste a sample of the JSON you want, or let AI extract the schema from API docs or a documentation URL
- **Two AI providers** — OpenAI (GPT-4o structured outputs) or Anthropic (Claude, strict tool use + prompt caching), selectable per adapter
- **Live playground** — test payloads in the UI: see the transformed output, latency, and token usage before wiring anything
- **Destination forwarding** — auto-deliver transformed data (POST/PUT/PATCH) with Bearer / API-Key / Basic auth, credentials encrypted at rest (AES-256-GCM)
- **Production-grade webhook** — per-adapter secret (timing-safe verification), rate limiting, 1MB payload cap, timeouts and retries everywhere
- **Full observability** — every transformation logged with input/output, durations, tokens, trace IDs; cursor-paginated log explorer with live refresh and one-click **replay**
- **Bilingual UI** — English / French, switchable at runtime
- **Multi-tenant** — Supabase Auth, all data scoped per user

## Quickstart

### Prerequisites

- [Bun](https://bun.sh) 1.x
- A [Supabase](https://supabase.com) project (auth + Postgres)
- An [OpenAI](https://platform.openai.com) and/or [Anthropic](https://console.anthropic.com) API key

### Setup

```bash
git clone <repo-url>
cd universal-data-adapter
bun install

cp .env.example .env       # then fill in your values
bun run db:deploy          # apply database migrations
bun run db:generate
bun run dev                # → http://localhost:3000
```

> `ENCRYPTION_KEY` (min 16 chars) is **required** — the app refuses to start without it. It encrypts destination credentials with AES-256-GCM.

### Docker

```bash
docker compose up -d       # see docker-compose.yml for configuration
```

## Usage

1. **Sign up**, then create an adapter: paste an example of your target JSON (or generate it from docs).
2. Pick the AI model, optionally configure a destination + webhook secret.
3. Test it in the **Playground** on the adapter page.
4. Point any service at your webhook:

```bash
curl -X POST https://your-instance/api/webhook/<ADAPTER_ID> \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: whsec_..." \
  -d '{"any": "json", "shape": "works"}'
```

Response:

```json
{
  "status": "success",
  "trace_id": "…",
  "data": { "…": "transformed payload" },
  "meta": {
    "duration_ms": 1250, "transform_duration_ms": 1180,
    "provider": "anthropic", "model": "claude-sonnet-5",
    "input_tokens": 412, "output_tokens": 96
  }
}
```

Errors are typed: `401 INVALID_SECRET`, `413 PAYLOAD_TOO_LARGE`, `429 RATE_LIMITED` (+ `Retry-After`), `422 MAX_TOKENS`, `504 TIMEOUT` — always with a `trace_id` you can look up in the logs.

## Architecture

```
 Sender ──POST──►  /api/webhook/[id]
                     │  secret check (timing-safe) → rate limit → size cap
                     ▼
              shared pipeline (src/lib/pipeline.ts)
                     │  transform → validate → forward → log → usage
                     ▼
          provider layer (src/lib/providers/)
            ├─ openai.ts     GPT-4o, strict structured outputs
            └─ anthropic.ts  Claude, forced strict tool use + prompt caching
```

The same pipeline powers the public webhook, the authenticated playground (`POST /api/adapters/[id]/test`) and log replay — three entry points, one behavior.

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript strict |
| Database | PostgreSQL + Prisma (versioned migrations) |
| Auth | Supabase Auth |
| AI | `openai` + `@anthropic-ai/sdk` behind a common `TransformProvider` interface |
| i18n | next-intl (cookie mode, no URL prefix) |
| Tests | Vitest — `bun run test` |
| Tooling | Bun |

## Security notes

- Destination credentials: AES-256-GCM, versioned ciphertext format, no fallback key.
- Webhook secrets: compared timing-safe (SHA-256 + `timingSafeEqual`).
- User-supplied URLs (doc import, destinations) go through an SSRF guard: DNS resolution, private/link-local/metadata IP blocking, re-validation on every redirect, streamed 2MB response cap.
- Rate limiting: fixed window in Postgres — serverless-safe, zero extra infrastructure.

## Development

```bash
bun run test          # 61 unit/integration tests
bun run test:watch
bunx tsc --noEmit     # typecheck
bun run build         # production build
bun run db:studio     # browse the database
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Roadmap

- [ ] One-command self-host (Docker) polish
- [ ] Local model support (Ollama) via the provider interface
- [ ] Per-user usage quotas
- [ ] Input formats beyond JSON (CSV, XML)
- [ ] Batch transformations

## License

[MIT](LICENSE)
