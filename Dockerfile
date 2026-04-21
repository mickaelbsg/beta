# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Instala ferramentas de build necessárias para better-sqlite3 e outros nativos
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-slim

WORKDIR /app

# Instala dependências de sistema para o Playwright (Browser use)
RUN apt-get update && apt-get install -y \
    libgbm-dev \
    libnss3 \
    libasound2 \
    libxshmfence1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libpango-1.0-0 \
    libcairo2 \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Reinstala apenas dependências de prod e reconstrói módulos nativos para o ambiente linux/slim
RUN npm install --omit=dev && npm rebuild better-sqlite3

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/soul.md ./soul.md
COPY --from=builder /app/tools-contract-spec.md ./tools-contract-spec.md
COPY --from=builder /app/tools ./tools

# Garante existência dos diretórios de volume e permissões
RUN mkdir -p data logs vault && chown -R 1000:1000 /app

USER 1000

EXPOSE 3001

CMD ["npm", "start"]
