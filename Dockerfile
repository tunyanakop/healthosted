# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

WORKDIR /app

# openssl нужен Prisma, ca-certificates — для сетевых запросов
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

FROM base AS builder
ENV DATABASE_URL="file:/tmp/build.db"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# .next/cache — 120 МБ артефактов сборки, в рантайме не нужен
RUN npm run build \
    && rm -rf .next/cache
# оставляем только production-зависимости: меньше образ, меньше поверхностей
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data \
    DATABASE_URL="file:/data/app.db"

# --chown на каждом COPY вместо `chown -R` после копирования:
# рекурсивная смена владельца переписывает весь node_modules в новый слой (+742 МБ).
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/next.config.ts ./next.config.ts
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# том создаётся пустым и принадлежит node; chown только на каталог, не на /app
RUN mkdir -p /data/uploads \
    && chown node:node /data /data/uploads \
    && chmod 0755 /usr/local/bin/docker-entrypoint.sh

USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
