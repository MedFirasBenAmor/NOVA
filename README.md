# NOVA

Digital insurance orchestration platform. This repository contains the V1 technical foundation only; insurance, OCR, LLM, and Risk & Eligibility engines are intentionally absent.

## Requirements

- Node.js 22+
- pnpm 11+ (or Corepack, included with Node.js)
- Docker with Compose

## Start locally

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Health: http://localhost:3001/health

The offline Intelligence MVP uses `AI_PROVIDER=mock`. Analyze an interaction with `POST /leads/:leadId/interactions`; Gemini is optional and requires `AI_PROVIDER=gemini` plus `GEMINI_API_KEY`.

## Checks

```bash
pnpm lint
pnpm test
pnpm build
```

If `pnpm` is not on your `PATH`, prefix these commands with `corepack`.

See [V1 scope](docs/architecture/v1-scope.md) for the product boundary.
See [Datapoint foundation](docs/architecture/datapoint-foundation.md) for the dossier data model.
