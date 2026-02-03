# ColorWizard MCP Server Docker Image (monorepo workspace)

# Build stage
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install workspace dependencies for MCP app
COPY package.json package-lock.json ./
COPY apps/mcp/package.json ./apps/mcp/package.json
RUN npm ci --workspace apps/mcp --include-workspace-root=false

# Copy MCP source and build
COPY apps/mcp/tsconfig.json ./apps/mcp/tsconfig.json
COPY apps/mcp/tsconfig.build.json ./apps/mcp/tsconfig.build.json
COPY apps/mcp/src ./apps/mcp/src
RUN npm run build --workspace apps/mcp

# Runtime stage
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    libvips \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/mcp/package.json ./apps/mcp/package.json
RUN npm ci --omit=dev --workspace apps/mcp --include-workspace-root=false

COPY --from=builder /app/apps/mcp/dist ./apps/mcp/dist
COPY --from=builder /app/apps/mcp/src/data ./apps/mcp/src/data

WORKDIR /app/apps/mcp

EXPOSE 3000

CMD ["node", "dist/index.js"]
