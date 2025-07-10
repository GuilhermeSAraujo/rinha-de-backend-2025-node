#!/bin/bash

# Build and publish script for Rinha de Backend 2025 - Node.js API

set -e

echo "🚀 Building Rinha de Backend 2025 - Node.js API"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -rf node_modules

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production=false

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t rinha-node-backend .

echo "✅ Build completed successfully!"
echo "🚀 To run with docker-compose: docker-compose up --build"
echo "🌐 Server will be available at: http://localhost:9999" 