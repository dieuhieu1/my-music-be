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
# Đổi WORKDIR về thư mục gốc
WORKDIR /app
ENV NODE_ENV=production

# Copy toàn bộ cấu trúc standalone (sẽ tự động bung ra apps/web/server.js)
COPY --from=build /app/apps/web/.next/standalone ./

# Copy file static vào đúng vị trí bên trong app
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

# (Tùy chọn) Bỏ comment dòng dưới nếu web bạn có thư mục public (chứa logo, favicon, hình ảnh tĩnh...)
# COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000

# Trỏ đúng đường dẫn tới file server.js
CMD ["node", "apps/web/server.js"]
