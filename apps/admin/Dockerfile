# Build context: repo root (docker-compose context: .)

# ── base ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/admin/package.json ./apps/admin/package.json
RUN npm install --workspaces --include-workspace-root

# ── dev: hot reload via Next.js HMR ───────────────────────────────────────
FROM base AS dev
COPY . .
WORKDIR /app/apps/admin
EXPOSE 3002
CMD ["npm", "run", "dev"]

# ── build ─────────────────────────────────────────────────────────────────
FROM base AS build
COPY . .
WORKDIR /app/apps/admin
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ── prod ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app/apps/admin
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./.next/static
EXPOSE 3002
ENV NODE_ENV=production
CMD ["node", "server.js"]
