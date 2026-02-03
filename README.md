# ColorWizard Monorepo

ColorWizard is split into a monorepo with a standalone MCP server and a standalone Next.js UI.

## Repo layout

```text
apps/
  mcp/   # MCP server, tools, tests, HTTP bridge for web UI
  web/   # Next.js Magpie Embroidery UI
packages/
  # reserved for future shared packages (empty for now)
```

## Hard boundary

- `apps/mcp` must **not** import from `apps/web` (or any React/Next files).
- `apps/web` can call MCP capabilities over HTTP, or import only from future shared packages under `packages/`.

## Requirements

- Node.js 20+
- npm 10+

## Quick start

```bash
npm install
npm run dev
```

This starts:
- MCP HTTP bridge at `http://localhost:3001`
- Next.js web UI at `http://localhost:3000`

## Scripts

### Root

```bash
npm run dev          # run mcp + web
npm run dev:mcp      # run MCP HTTP bridge
npm run dev:mcp:stdio# run MCP stdio server
npm run dev:web      # run Next.js app
npm run build        # build mcp + web
npm run test         # run current test suite(s)
```

### MCP app (`apps/mcp`)

```bash
npm run dev:http
npm run dev:stdio
npm run build
npm run test
npm run test:watch
```

### Web app (`apps/web`)

```bash
npm run dev
npm run build
npm run start
```

## Environment variables

### Web (`apps/web/.env.local`)

- `NEXT_PUBLIC_DEMO_ORIGIN` (default: `http://localhost:3001`)
- `NEXT_PUBLIC_BLUEPRINT_MOCK` (`1`/`0`, development behavior)

### MCP (`apps/mcp`)

- `DEMO_PORT` (default: `3001`)
- `VERSION`
- `ENABLE_PERF_LOGS`
- `NODE_ENV`

## MCP tools (server)

Implemented in `apps/mcp/src/tools` and exposed through `apps/mcp/src/index.ts`.

Current tools include:
- `ping`
- `health`
- `match_dmc`
- `image_register`
- `sample_color`
- `analyze_image_region`
- `apply_aesthetic_offset`
- `generate_stitch_pattern`
- `generate_blueprint`
- `generate_blueprint_v1`
- `generate_blueprint_v2`

## Web ↔ MCP HTTP endpoints

The web app uses the MCP HTTP bridge (`apps/mcp/demo/server.ts`) with:
- `GET /health`
- `POST /api/image-register`
- `POST /api/match-dmc-batch`
- `POST /api/generate-blueprint-v1`

## Docker

The root `Dockerfile` and `docker-compose.yml` target `apps/mcp`.

```bash
docker compose up --build
```

## Adding a new MCP tool

1. Add handler/types in `apps/mcp/src/tools/`.
2. Register in `apps/mcp/src/tools/index.ts`.
3. Wire request handling in `apps/mcp/src/index.ts` if needed.
4. Add tests under `apps/mcp/src/tools/__tests__/`.
5. If web needs it, expose HTTP route in `apps/mcp/demo/server.ts` and call it from `apps/web/lib/api/`.
6. Run `npm run test`.
