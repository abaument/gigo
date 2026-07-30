# ============================================================
# GIGO — multi-stage build
#   builder : bun install + prisma generate + next build
#   migrate : one-shot `prisma migrate deploy` (compose service)
#   runner  : minimal Next.js standalone runtime
# ============================================================

FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile
RUN bunx prisma generate

COPY . .

# Dummy build-time values — real ones are injected at runtime.
# (encryption.ts refuses to load without a key; the build evaluates modules.)
ARG ENCRYPTION_KEY=build-time-dummy-key-32-chars!!
ARG NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy
ENV ENCRYPTION_KEY=$ENCRYPTION_KEY \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# ------------------------------------------------------------
FROM oven/bun:1 AS migrate
WORKDIR /app
COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
CMD ["bunx", "prisma", "migrate", "deploy"]

# ------------------------------------------------------------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# openssl is required by the Prisma engine
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
