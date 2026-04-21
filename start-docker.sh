#!/bin/bash

# Script para subir o ecossistema Beta via Docker

echo "🚀 Iniciando ecossistema Beta via Docker..."

# Verifica se o Docker está rodando
if ! docker info > /dev/null 2>&1; then
  echo "❌ Erro: O daemon do Docker não está rodando."
  exit 1
fi

# Build e Up
docker-compose up -d --build || { echo "❌ Erro no build do Docker."; exit 1; }

echo ""
echo "✅ Sistema Beta em execução!"
echo "-----------------------------------"
echo "🤖 Bot Telegram: Ativo"
echo "🖥️ Dashboard: http://localhost:8081"
echo "📡 Admin API: http://localhost:3001"
echo "🧠 Qdrant DB: http://localhost:6333"
echo "-----------------------------------"
echo "Use 'docker-compose logs -f' para acompanhar os logs."
