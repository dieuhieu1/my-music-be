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
# Đổi WORKDIR về thư mục gốc
WORKDIR /app
ENV NODE_ENV=production

# Copy toàn bộ cấu trúc standalone
COPY --from=build /app/apps/admin/.next/standalone ./

# Copy file static vào đúng vị trí bên trong app
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static

# (Tùy chọn) Bỏ comment dòng dưới nếu admin bạn có thư mục public
# COPY --from=build /app/apps/admin/public ./apps/admin/public

EXPOSE 3002

# Trỏ đúng đường dẫn tới file server.js
CMD ["node", "apps/admin/server.js"]
