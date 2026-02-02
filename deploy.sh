#!/bin/bash

# ColorWizard MCP Deployment Script
# Builds the project, creates Docker image, and restarts the container

set -e  # Exit on error

echo "🔨 Building TypeScript project..."
npm run build

echo "🐳 Building Docker image..."
docker-compose build

echo "🔄 Restarting container..."
docker-compose down
docker-compose up -d

echo "✅ Deployment complete!"
echo "📊 Container status:"
docker-compose ps

echo ""
echo "📝 View logs with: docker-compose logs -f"
