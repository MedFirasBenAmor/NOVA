# NOVA deployment notes: Vercel + Supabase

## Current deployable shape

NOVA is a monorepo with:

- `apps/web`: Next.js frontend. This is deployable to Vercel.
- `apps/api`: NestJS API. This is a persistent Node service today.
- PostgreSQL via Prisma.
- Redis/BullMQ for document processing.
- Local document storage and optional Paddle OCR helper.

The current API is not a pure Vercel Functions app. For production, deploy the
web app on Vercel and run the API on a persistent Node runtime unless/until the
API is refactored for serverless storage, queues, and workers.

## Vercel project: web

Create one Vercel project from the GitHub repository:

- Root Directory: `apps/web`
- Framework: Next.js
- Install Command: `corepack pnpm install --frozen-lockfile`
- Build Command: `corepack pnpm --filter @nova/web build`

Environment variables:

```text
NEXT_PUBLIC_API_URL=https://<api-production-host>
```

After the API has a production URL, set that URL here and redeploy the web
project.

## Supabase database

Create a Supabase project and use its Postgres connection string for the API.

Recommended:

- Use the runtime connection string for app traffic.
- Use a direct connection string when running Prisma migrations from a trusted
  environment if Supabase provides both pooled and direct URLs.

API environment variable:

```text
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<db>?schema=public
```

Then run:

```bash
corepack pnpm --filter @nova/api prisma:generate
corepack pnpm --filter @nova/api prisma:migrate
corepack pnpm --filter @nova/api prisma:seed
```

Do not run `prisma migrate reset` against production.

## API production runtime

Deploy `apps/api` to a persistent Node host such as Railway, Render, Fly.io, or
another container/VM platform.

Required API environment variables:

```text
NODE_ENV=production
API_PORT=3001
WEB_ORIGIN=https://<vercel-web-domain>
DATABASE_URL=<supabase-postgres-url>
AI_PROVIDER=mock
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.7-flash
GEMINI_TIMEOUT_MS=30000
DOCUMENT_STORAGE_PROVIDER=local
DOCUMENT_STORAGE_PATH=./var/documents
MAX_DOCUMENT_UPLOAD_BYTES=10485760
ANONYMOUS_SESSION_TTL_SECONDS=86400
ANONYMOUS_SESSION_COOKIE_NAME=nova_session
REDIS_HOST=<redis-host>
REDIS_PORT=<redis-port>
OCR_PROVIDER=mock
PADDLE_OCR_URL=
OCR_TIMEOUT_MS=30000
```

Notes:

- For production document uploads, replace local disk storage with object
  storage before relying on uploaded files across deploys.
- For real OCR, run the Paddle OCR helper as a separate service and set
  `OCR_PROVIDER=paddle` plus `PADDLE_OCR_URL`.
- For Gemini, set `AI_PROVIDER=gemini` and provide `GEMINI_API_KEY`.

## Why not deploy the current API entirely to Vercel yet?

The current API starts a Nest HTTP server, owns a BullMQ/Redis worker, stores
documents on local disk, and optionally calls a separate OCR service. Those are
stateful or long-running backend concerns. Vercel is ideal for the Next.js web
app and serverless endpoints, but this API needs either a persistent backend
host or a refactor to Vercel-compatible services for storage, queues, and
background processing.
