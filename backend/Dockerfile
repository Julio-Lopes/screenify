# syntax=docker/dockerfile:1

# Construído a partir da RAIZ do monorepo (o backend depende do shared/ e do lockfile da raiz):
#   docker build -f backend/Dockerfile -t screenify-backend .

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# 1. build: todas as dependências, Prisma Client gerado e TypeScript compilado
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app

# Ferramentas para compilar o worker do mediasoup, caso o binário pronto não possa ser baixado
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Primeiro só os manifestos: enquanto eles não mudarem, o Docker reaproveita esta camada
# e o npm ci (a parte mais lenta) não roda de novo
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace @screenify/backend --workspace @screenify/shared

COPY shared/ shared/
COPY backend/ backend/

# O prisma.config.ts exige DATABASE_URL, mas gerar o client não conecta no banco
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build --workspace @screenify/backend

# ---------------------------------------------------------------------------
# 2. prod-deps: só o que o servidor precisa para rodar
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# A pasta existe mesmo se o npm não criar nada nela, para o COPY do estágio final não falhar
RUN mkdir -p backend/node_modules \
  && npm ci --omit=dev --workspace @screenify/backend --workspace @screenify/shared \
  && npm cache clean --force

# ---------------------------------------------------------------------------
# 3. runtime: a imagem que vai para produção
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

# tini: processo 1 do container (repassa sinais e recolhe os processos do mediasoup)
# openssl: o Prisma precisa para detectar a plataforma e falar TLS com o banco
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PATH=/app/node_modules/.bin:$PATH
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --chown=node:node shared/ shared/
COPY --chown=node:node backend/package.json backend/prisma.config.ts backend/docker-entrypoint.sh backend/
COPY --chown=node:node backend/prisma backend/prisma
COPY --from=build --chown=node:node /app/backend/dist backend/dist

# Garante quebras de linha do Linux no script, mesmo que ele tenha sido salvo com CRLF no Windows
RUN sed -i 's/\r$//' backend/docker-entrypoint.sh

# Sem root: o processo roda como o usuário "node" que a imagem oficial já traz
USER node
WORKDIR /app/backend

# HTTP e WebSocket na 3000; mídia do mediasoup na 40000 (UDP e, como plano B, TCP)
EXPOSE 3000 40000/udp 40000/tcp

# Sem curl na imagem slim: o próprio Node faz a verificação
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["tini", "--"]
CMD ["sh", "docker-entrypoint.sh"]