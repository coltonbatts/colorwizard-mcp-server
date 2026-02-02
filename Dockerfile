# INFRA-CW-01: Containerized for persistent artisan service.
# ColorWizard MCP Server Docker Image
# Multi-stage build for optimal image size

# Build stage
FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for TypeScript)
RUN npm ci

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Runtime stage
FROM node:20-slim

# Install runtime dependencies required for sharp (image processing library)
# These are necessary for sharp to work correctly in Linux/Docker environments
RUN apt-get update && apt-get install -y \
    libvips \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Expose port for potential SSE (Server-Sent Events) transport
# Currently using stdio, but port reserved for future HTTP/SSE transport
EXPOSE 3000

# Run the MCP server
# Using node directly on the compiled JavaScript entry point
CMD ["node", "dist/index.js"]
