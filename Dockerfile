# syntax=docker/dockerfile:1
# One Dockerfile for both apps (pick with --target): turbo prune keeps only the workspace packages an app needs,
# so a web change doesn't rebuild the API image and vice versa.
#
#   docker build --target api -t offerleap-api .
#   docker build --target web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 -t offerleap-web .
#   docker build --target migrate -t offerleap-migrate .   # prisma migrate deploy + seed, then exits

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
RUN npm install -g pnpm@12.8.2 turbo@2.11.6
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo

# ── 1. Keep only what one app needs ─────────────────────────────────────────────────────────────────────────────
FROM base AS prune-api
COPY . .
RUN turbo prune @offerleap/api --docker

FROM base AS prune-web
COPY . .
RUN turbo prune @offerleap/web --docker

# ── 2. Install (cached until a package.json or the lockfile changes), then build ────────────────────────────────
FROM base AS build-api
COPY --from=prune-api /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune-api /repo/out/full/ .
# Root files turbo prune leaves out but every package's tsconfig extends.
COPY tsconfig.base.json ./
# prisma.config.ts requires DATABASE_URL even for `prisma generate`, which never connects: a placeholder is enough.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build turbo run build --filter=@offerleap/api

FROM base AS build-web
# Baked into the client bundle at build time (Next.js NEXT_PUBLIC_* variables).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=prune-web /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune-web /repo/out/full/ .
COPY tsconfig.base.json ./
RUN turbo run build --filter=@offerleap/web

# ── 3a. Database migrations + seed (needs the Prisma CLI, a dev dependency) ──────────────────────────────────────
FROM build-api AS migrate
WORKDIR /repo/apps/api
CMD ["sh", "-c", "pnpm db:deploy && pnpm db:seed"]

# ── 3b. API runtime: production dependencies only, non-root ─────────────────────────────────────────────────────
FROM build-api AS api-deps
RUN pnpm install --prod --frozen-lockfile --offline

FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=api-deps --chown=node:node /repo .
RUN mkdir -p /repo/apps/api/storage && chown node:node /repo/apps/api/storage
USER node
WORKDIR /repo/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${API_PORT:-4000}/api/v1/health" > /dev/null || exit 1
CMD ["node", "dist/main.js"]

# ── 3c. Web runtime: Next.js standalone output (server + traced node_modules only) ──────────────────────────────
FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build-web --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build-web --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
