# ColorWizard Monorepo Guide

## Quick start

```bash
npm install
npm run dev
```

Run services separately:

```bash
npm run dev:mcp
npm run dev:web
```

Build and test:

```bash
npm run build
npm run test
```

## Repo map

- `apps/mcp`: MCP server, tool handlers, test suites, and HTTP bridge used by the UI.
- `apps/web`: Next.js UI (Magpie Embroidery), routes, client state, and static assets.
- `packages`: Reserved for future shared packages. Keep empty unless real cross-app sharing exists.
- `Dockerfile` / `docker-compose.yml`: Container setup for `apps/mcp`.

## Hard boundary rule

`apps/mcp` must never import from `apps/web` or any Next.js/React UI modules.

If shared logic is required, move it into `packages/shared` and import from there.

## How to add a new tool (checklist)

1. Add input/output types and handler in `apps/mcp/src/tools/`.
2. Register tool schema and handler in `apps/mcp/src/tools/index.ts`.
3. Wire request handling in `apps/mcp/src/index.ts` if needed.
4. Add or update tests in `apps/mcp/src/tools/__tests__/`.
5. If UI needs it, expose an HTTP endpoint in `apps/mcp/demo/server.ts` and call it from `apps/web/lib/api/`.
6. Run `npm run test` and confirm tool appears in MCP tool list/integration tests.
