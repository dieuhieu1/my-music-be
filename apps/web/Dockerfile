# Build context: repo root (docker-compose context: .)

# ── base ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm install --workspaces --include-workspace-root

# ── dev: hot reload via Next.js HMR ───────────────────────────────────────
FROM base AS dev
COPY . .
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── build ─────────────────────────────────────────────────────────────────
FROM base AS build
COPY . .
WORKDIR /app/apps/web
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ── prod ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod
WORKDIR /app/apps/web
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./.next/static
COPY --from=build /app/apps/web/public ./public
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
