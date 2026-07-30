# Contributing to GIGO

Thanks for your interest! GIGO is young — issues, docs fixes, bug reports and feature discussions are all welcome.

## Getting set up

```bash
git clone <repo-url>
cd universal-data-adapter
bun install
cp .env.example .env    # fill in Supabase + at least one AI provider key
bun run db:deploy && bun run db:generate
bun run dev
```

We use **Bun** for everything (install, scripts, running TS files directly).

## Before opening a PR

```bash
bun run test        # the whole Vitest suite must pass
bunx tsc --noEmit   # zero type errors
bun run build       # production build must succeed
```

- Keep PRs focused: one change per PR.
- New behavior needs a test (see `src/lib/__tests__/` for patterns — providers are mocked, no API keys needed to run the suite).
- Match the existing code style; UI work must use the existing design system (`globals.css` classes) and both locales (`messages/en.json` + `messages/fr.json` — never hardcode UI strings).

## Project map

| Path | What lives there |
|---|---|
| `src/lib/providers/` | AI provider abstraction (add new providers here — e.g. Ollama) |
| `src/lib/pipeline.ts` | The shared transform → forward → log pipeline |
| `src/app/api/webhook/[id]/` | Public webhook (secret, rate limit, size caps) |
| `src/app/api/adapters/[id]/test/` | Authenticated playground endpoint |
| `src/lib/actions.ts` | All server actions (auth + ownership checks) |
| `src/lib/schemas.ts` | Zod schemas — single source of truth for validation |
| `messages/` | i18n catalogs (EN/FR) |
| `prisma/` | Schema + versioned migrations |

## Adding an AI provider

Implement the `TransformProvider` interface (`src/lib/providers/types.ts`), register it in the factory (`src/lib/providers/index.ts`), add its models to `models.ts`, and mock it in `src/lib/__tests__/providers.test.ts`. The rest of the app (pipeline, UI picker, logs) picks it up automatically.

## Security

If you find a vulnerability, please **do not open a public issue** — contact the maintainer directly.

## Code of conduct

Be kind, be constructive, assume good faith. Harassment or personal attacks are not tolerated.
