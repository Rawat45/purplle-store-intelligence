#!/bin/bash
# Purplle Store Intelligence System Automated Orchestrator

echo "Writing configuration files..."
echo "Spinning up Docker Compose container network..."
docker compose down --volumes --remove-orphans
docker compose build --no-cache backend
docker compose up -d

echo "📊 Checking container health status..."
docker ps

echo "🎉 Architecture cluster is hot! Hit http://localhost:8000/metrics to verify."
