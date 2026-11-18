# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# Standalone install of the Prisma CLI (with all its deps) for `migrate deploy` at startup
FROM base AS migrator
WORKDIR /migrator
COPY package-lock.json ./
RUN PRISMA_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") \
 && npm init -y >/dev/null && npm install --no-audit --no-fund --omit=dev "prisma@$PRISMA_VERSION"

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 STORAGE_LOCAL_DIR=/app/uploads
RUN groupadd -r app && useradd -r -g app app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=migrator /migrator/node_modules ./prisma-cli/node_modules
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p /app/uploads && chown -R app:app /app/uploads
USER app
EXPOSE 3000
CMD ["sh", "-c", "node prisma-cli/node_modules/prisma/build/index.js migrate deploy && node server.js"]
