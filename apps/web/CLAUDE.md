## Project Overview

- **App**: My Music — self-hosted Spotify alternative for 20–200 users
- **Stack**: Next.js 14 App Router · React 18 · TypeScript · Tailwind · Zustand · axios · next-intl · zod + react-hook-form
- **UI lib**: Radix UI (Dialog, Dropdown, Toast, Avatar only) + lucide-react icons
- **Build**: `next build`, output standalone (Docker), port 3000
- **Monorepo**: `@mymusic/types` shared package from `packages/types/`
- Read `../../CLAUDE.md` for API conventions, phase status, BL codes, queue names

---

## Folder Structure

```
src/
  app/              # Next.js App Router — [locale]/(app|auth|public)/
  components/       # Shared UI: auth/ layout/ music/ profile/ providers/
  hooks/            # usePlayer.ts, useQueue.ts
  lib/
    api/            # 17 axios modules (*.api.ts) + axios.ts client
    utils/          # roleRedirect.ts
  store/            # 4 Zustand stores (use*Store.ts)
  i18n/             # config.ts + request.ts (next-intl)
  middleware.ts     # Locale detection + auth route guard
  messages/         # en.json, vi.json — i18n strings
```

---

## Architecture & Patterns

- **Route groups**: `(app)` = auth-required + Sidebar/PlayerBar shell; `(auth)` = redirects if logged in; `(public)` = open
- **Auth**: httpOnly cookies (`access_token`/`refresh_token`); middleware checks cookie; 401 → silent refresh via axios interceptor queue → retry
- **State**: Zustand stores; `useAuthStore` hydrated by `AuthProvider` on mount via `GET /users/me`
- **API**: axios instance at `src/lib/api/axios.ts`; base `http://localhost:3001/api/v1`; `withCredentials: true`
- **Response unwrap**: API returns `{ success, data }` envelope; use `res.data?.data ?? res.data` pattern
- **Data fetching**: `useEffect` + local `useState(loading/data)` — no React Query
- **Optimistic updates**: save prev → update state → call API → rollback on catch
- **Forms**: react-hook-form + zod resolver; no custom form abstractions
- **Styling rule**: layout/spacing/dynamic state → inline `style={{}}`; animations/effects → `className`
- **No error boundaries**: error handling via try-catch in each page; no global `error.tsx`
- **Toast**: local inline pattern (`useState` + `setTimeout(3000)`) — no global toast provider yet

---

## Key Files

| File | Role |
|------|------|
| `src/middleware.ts` | Locale routing + auth cookie guard |
| `src/app/globals.css` | Midnight Vinyl design tokens + all `@keyframes` |
| `src/lib/api/axios.ts` | Axios instance, 401 interceptor, refresh queue |
| `src/components/providers/AuthProvider.tsx` | Hydrates `useAuthStore` on app mount |
| `src/store/useAuthStore.ts` | User identity, roles, premium; `hasRole()`, `isPremium()` |
| `src/store/usePlayerStore.ts` | Current song, play state, volume, position |
| `src/store/useQueueStore.ts` | Queue items, smart order toggle |
| `src/hooks/usePlayer.ts` | Howler.js wrapper; fetches stream URL; fires play event at ≥30s |
| `src/app/[locale]/(app)/layout.tsx` | Persistent shell: Sidebar + TopBar + PlayerBar (`pb-24`) |
| `src/app/[locale]/layout.tsx` | NextIntlClientProvider + AuthProvider wrapper |
| `src/lib/utils/roleRedirect.ts` | `getRoleHome()` — role-based post-login redirect |
| `src/i18n/config.ts` | Locales `['en', 'vi']`, defaultLocale `'en'` |
| `src/components/layout/Sidebar.tsx` | Nav links, locale switcher, user avatar |
| `src/components/layout/PlayerBar.tsx` | Fixed bottom player, uses `usePlayer` + `usePlayerStore` |

---

## Naming Conventions

- **Component files**: PascalCase `.tsx` — `SongCard.tsx`, `AuthButton.tsx`
- **Page files**: always `page.tsx` in route folder
- **Hooks**: `use` prefix camelCase — `usePlayer.ts`, `useQueue.ts`
- **Stores**: `use` prefix + `Store` suffix — `useAuthStore.ts`, `usePlayerStore.ts`
- **API modules**: camelCase + `.api.ts` — `songs.api.ts`, `admin.api.ts`
- **Utils**: camelCase, descriptive — `roleRedirect.ts`
- **Types/interfaces**: PascalCase; component props suffix `Props` — `SongCardProps`
- **Route folders**: lowercase kebab-case — `forgot-password/`, `verify-email/`
- **i18n keys**: namespace dot notation — `useTranslations('auth')` then `t('login')`

---

## Data Flow

1. **User action** → component event handler (or form `onSubmit`)
2. **Optimistic**: update Zustand store immediately if applicable
3. **API call**: `src/lib/api/*.api.ts` → axios instance → `POST/GET/PATCH /api/v1/...`
4. **Response**: unwrap `res.data?.data ?? res.data` → set local state / update store
5. **Auth failure**: 401 interceptor → refresh token → retry → on fail redirect `/[locale]/login`
6. **Render**: component reads from store (`useAuthStore`, `usePlayerStore`) or local state

---

## Common Commands

```bash
npm run dev        # Start Next.js on port 3000
npm run build      # Production build
npm run start      # Serve production build on port 3000
npm run lint       # ESLint check
```

---

## Environment & Config

- `NEXT_PUBLIC_API_URL` — API base (default: `http://localhost:3001/api/v1`)
- `NEXT_PUBLIC_MINIO_URL` — MinIO public URL for image/audio assets
- Config files: `next.config.mjs` (standalone output, remote images), `tailwind.config.ts`, `tsconfig.json`
- MinIO remote image pattern: `localhost:9000` (configured in `next.config.mjs`)
- i18n locales defined in `src/i18n/config.ts`; middleware matcher excludes `_next`, `api`, static files

---

## Known Gotchas

- **Double-unwrap**: API interceptor may or may not unwrap envelope — always use `res.data?.data ?? res.data`
- **`isPremium()` method**: admins bypass premium checks in `useAuthStore` — check roles before gating
- **Tailwind gray-\* banned**: never use `gray-*` palette; use CSS vars (`--surface`, `--muted-text`)
- **No hex in className**: inline `style` only for color values; className for animation classes
- **`vinyl-spin` circular only**: applying to non-circle elements causes visual glitch
- **`@keyframes` location**: ALL keyframes must live in `globals.css` — never in component files
- **Radix UI scope**: only Dialog, Dropdown, Toast, Avatar are approved — no other Radix primitives
- **`anim-fade-up` stagger cap**: max index is 8 (`anim-fade-up-8`); cap with `Math.min(i+1, 8)`
- **`use client` everywhere**: most pages are client components; RSC is minimal
- **Locale in all links**: always prefix hrefs with `/${locale}/` or use next-intl `<Link>`
- **Auth layout canvas**: `(auth)/layout.tsx` uses `requestAnimationFrame` canvas — do not SSR it

---

## Reference Docs

Read this file first. Only open a doc when it answers something this CLAUDE.md can't.

| Doc | Read when… |
|-----|-----------|
| `../../docs/02_specification.md` | You need the exact screen layout or role-access matrix for a specific screen code (A1–L6) |
| `../../docs/07_api_interfaces.md` | You need the full request body / response shape of an endpoint not listed here |
| `../../docs/10_implementation_plan.md` | You're starting a phase — read **only the `### Frontend` sub-section** of that phase |
| `../../docs/08_ai_architecture.md` | You're building the AI chat page (H5, Phase 10) — need the `actions[]` response schema and skill list |
| `../../docs/01_requirements_en.md` | You need the exact wording of a BL code to understand a business rule |
| `../../CLAUDE.md` | You need API response envelope, phase status, BullMQ queues, song status machine |

**Rule**: open one doc, find the single answer you need, close it. Never read docs upfront before you have a specific question.
