# Build from the repo root:  docker build -f apps/api/Dockerfile -t fieldpulse-api .
FROM node:20-alpine AS base
WORKDIR /repo

# 1. Prune the monorepo down to the API and the packages it depends on.
FROM base AS pruner
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @fieldpulse/api --docker

# 2. Install deps (cached on lockfile) and build.
FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN npm ci
COPY --from=pruner /repo/out/full/ .
COPY tsconfig.base.json ./
RUN npx turbo run build --filter=@fieldpulse/api...
RUN npm prune --omit=dev

# 3. Slim runtime image.
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/migrations ./apps/api/migrations
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4000/healthz || exit 1
# Run `node dist/migrate.js` as a release step before starting new instances.
CMD ["node", "dist/index.js"]
