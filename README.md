# GIGO V1 - Garbage In, Gold Out

A production-ready SaaS platform for intelligent JSON transformation. Transform chaotic data into perfectly structured payloads using AI.

## 🚀 What's New in V1

- **Multi-tenant SaaS** - User authentication with Supabase
- **Smart Schema Generator** - AI extracts schemas from API documentation
- **Destination Forwarding** - Auto-forward transformed data to any endpoint
- **Encrypted Credentials** - Secure storage for API keys and tokens
- **Advanced Logging** - Full audit trail with timing metrics

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14+ (App Router) |
| Auth | Supabase Auth |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| AI | OpenAI GPT-4o (Structured Outputs) |
| Validation | Zod |
| Styling | Tailwind CSS |

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account ([supabase.com](https://supabase.com))
- OpenAI API key ([platform.openai.com](https://platform.openai.com))

### 1. Clone & Install

```bash
cd universal-data-adapter
npm install
```

### 2. Setup Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anon public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service role key (`SUPABASE_SERVICE_ROLE_KEY`)
3. Go to **Settings > Database** and copy the connection string

### 3. Configure Environment

Create a `.env` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:password@db.your-project.supabase.co:5432/postgres"

# OpenAI
OPENAI_API_KEY="sk-your-key"

# Encryption (generate a random 32-char string)
ENCRYPTION_KEY="your-32-character-encryption-key!"

# Base URL
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 4. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to Supabase
npm run db:push
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

### 🔐 Authentication

- Sign up / Sign in with email
- Protected routes with middleware
- User-scoped data (row-level security logic)

### ✨ Smart Schema Generator

Generate target schemas automatically from:

1. **Documentation Text** - Paste cURL examples or API docs
2. **URL Import** - Fetch and parse documentation pages
3. **Manual Input** - Write JSON schemas directly

### 🎯 Transformation Engine

1. Receives ANY JSON payload via webhook
2. AI transforms to match your target schema
3. Handles:
   - Key renaming (`firstName` → `first_name`)
   - Type conversion (`"42"` → `42`)
   - Nested restructuring
   - Missing field handling

### 📤 Destination Forwarding

Configure adapters to auto-forward transformed data:

| Auth Method | Description |
|-------------|-------------|
| None | No authentication |
| Bearer | `Authorization: Bearer <token>` |
| API Key | Custom header with key value |
| Basic | HTTP Basic authentication |

### 📊 Logging & Analytics

Every transformation is logged with:
- Input/output JSON
- Success/failure status
- Transform duration
- Forward duration (if applicable)
- Destination response
- Source IP & User Agent

## API Reference

### POST /api/webhook/[adapterId]

Transform a JSON payload.

**Request:**
```bash
curl -X POST http://localhost:3000/api/webhook/YOUR_ADAPTER_ID \
  -H "Content-Type: application/json" \
  -d '{"user_first_name": "John", "user_email": "john@test.com"}'
```

**Response (without forwarding):**
```json
{
  "success": true,
  "data": {
    "firstName": "John",
    "email": "john@test.com"
  },
  "meta": {
    "adapterId": "...",
    "transformedAt": "2024-01-15T10:30:00Z",
    "transformDurationMs": 1234,
    "totalDurationMs": 1250
  }
}
```

**Response (with forwarding):**
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... },
  "forwarding": {
    "success": true,
    "status": 200,
    "durationMs": 456,
    "response": { ... }
  }
}
```

### GET /api/webhook/[adapterId]

Get adapter info and usage instructions.

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── adapters/
│   │   ├── new/page.tsx         # Create adapter with Smart Schema
│   │   └── [id]/logs/page.tsx   # View transformation logs
│   ├── api/webhook/[id]/route.ts # Transformation engine
│   ├── layout.tsx
│   └── page.tsx                  # Dashboard
├── components/
│   ├── AdapterCard.tsx
│   ├── LogEntry.tsx
│   ├── UserMenu.tsx
│   └── ...
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser client
│   │   ├── server.ts            # Server client
│   │   └── middleware.ts        # Session refresh
│   ├── actions.ts               # Server actions
│   ├── db.ts                    # Prisma client
│   ├── encryption.ts            # AES encryption
│   ├── schema-generator.ts      # AI doc parser
│   ├── transformer.ts           # OpenAI transformation
│   └── schemas.ts               # Zod schemas
├── middleware.ts                # Auth middleware
└── ...
```

## Security

- **Authentication** - Supabase Auth with email/password
- **Authorization** - All queries filter by `userId`
- **Encryption** - API keys encrypted with AES before storage
- **Webhooks** - Public endpoints (by design) with CORS support

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Add environment variables
3. Deploy!

### Other Platforms

Ensure your platform supports:
- Node.js 18+
- PostgreSQL database
- Environment variables

## License

MIT
