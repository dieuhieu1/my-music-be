# Build context: repo root (docker-compose context: .)
# This allows access to packages/ (shared types) alongside apps/api/

# ── base: install deps with workspace awareness ───────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# native bindings needed by bcrypt
RUN apk add --no-cache python3 make g++

# Copy workspace manifests first — layer cached until package.json changes
# package*.json glob works whether or not package-lock.json exists yet
COPY package*.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json

RUN npm install --workspaces --include-workspace-root

# ── dev: hot reload via src/ volume mount ─────────────────────────────────
FROM base AS dev
COPY . .
WORKDIR /app/apps/api
EXPOSE 3001
# --legacy-watch uses polling — required inside Docker on Windows/Mac hosts
CMD ["npx", "nest", "start", "--watch", "--legacy-watch"]

# ── build: compile TypeScript → dist/ ─────────────────────────────────────
FROM base AS build
COPY . .
WORKDIR /app/apps/api
RUN npx nest build

# ── prod: minimal runtime image ───────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --workspaces --include-workspace-root --omit=dev

COPY --from=build /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main"]
