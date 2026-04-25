## Project Overview

- **App**: My Music — self-hosted Spotify alternative for 20–200 users
- **Stack**: Next.js 14 App Router · React 18 · TypeScript · Tailwind · Zustand · axios · next-intl · zod + react-hook-form · date-fns
- **UI lib**: Radix UI (Dialog, Dropdown, Toast, Avatar **only**) + lucide-react icons
- **Build**: `next build`, output standalone (Docker), port 3000
- **Monorepo**: `@mymusic/types` shared package from `packages/types/`
- Read `../../CLAUDE.md` for API conventions, phase status, BL codes, queue names

---

## Folder Structure

```
src/
  app/
    [locale]/
      (app)/          ← auth-required, has Sidebar + TopBar + PlayerBar shell
      (auth)/         ← redirects to home if already logged in
      (public)/       ← open routes, no shell
    globals.css       ← ALL design tokens + ALL @keyframes (never add inline)
    layout.tsx
  components/
    auth/             ← AuthButton, AuthInput, OtpInput, PasswordInput
    downloads/        ← DownloadModal, DownloadRow
    drops/            ← DropCountdown, CancelDropModal, RescheduleDropModal
    layout/           ← Sidebar, TopBar, PlayerBar, NotificationBell, PremiumBadge
    music/            ← SongCard, SongRow, SongContextMenu, AlbumCard, PlaylistCard
    payment/          ← PlanCard, GatewaySelector, PremiumUpgradeModal, PaymentResultCard
    profile/          ← AvatarUpload, FollowButton
    providers/        ← AuthProvider
    LanguageSwitcher.tsx
  hooks/
    usePlayer.ts      ← Howler.js wrapper; stream URL fetch; fires play event at ≥30s
    useQueue.ts       ← Queue manipulation helpers
    useNotifications.ts ← Polls /notifications/unread-count every 30s via setInterval
  lib/
    api/              ← 17 axios modules (see API Modules section below)
    utils/
      roleRedirect.ts ← getRoleHome(roles, locale) → role-based post-login redirect
  store/
    useAuthStore.ts   ← user identity, roles, premium; hasRole(), isPremium(), clearUser()
    usePlayerStore.ts ← current song, play state, volume, seek position
    useQueueStore.ts  ← queue items, smart order toggle
    useLocaleStore.ts ← active locale string
  i18n/
    config.ts         ← locales: ['en','vi'], defaultLocale: 'en'
    request.ts        ← next-intl server request config
  middleware.ts       ← Locale detection + auth cookie guard (protects (app) routes)
  messages/
    en.json, vi.json  ← i18n strings
```

---

## Route Map

### `(public)` — No auth, no shell

| Route | File | Description |
|-------|------|-------------|
| `/[locale]` | `(public)/page.tsx` | Landing / home page (marketing hero, featured content) |
| `/[locale]/artists/[id]` | `(public)/artists/[id]/page.tsx` | Public artist profile page |
| `/[locale]/genres` | `(public)/genres/page.tsx` | Genre browse page |
| `/[locale]/songs/[id]/teaser` | `(public)/songs/[id]/teaser/page.tsx` | **Phase 8** — Drop teaser page; shows cover, countdown, Notify Me CTA; unauthenticated-safe |

### `(auth)` — Redirects away if already logged in

| Route | File | Description |
|-------|------|-------------|
| `/[locale]/login` | `(auth)/login/page.tsx` | Login form |
| `/[locale]/register` | `(auth)/register/page.tsx` | Registration form |
| `/[locale]/forgot-password` | `(auth)/forgot-password/page.tsx` | Request password reset |
| `/[locale]/reset-password` | `(auth)/reset-password/page.tsx` | Set new password with token |
| `/[locale]/verify-reset` | `(auth)/verify-reset/page.tsx` | Email OTP verification for reset |

### `(app)` — Auth-required, persistent Sidebar + TopBar + PlayerBar shell

| Route | File | Description |
|-------|------|-------------|
| `/[locale]/browse` | `(app)/browse/page.tsx` | Browse songs/albums grid |
| `/[locale]/browse/search` | `(app)/browse/search/page.tsx` | Search results page |
| `/[locale]/feed` | `(app)/feed/page.tsx` | Social activity feed (follows) |
| `/[locale]/queue` | `(app)/queue/page.tsx` | Current play queue view |
| `/[locale]/notifications` | `(app)/notifications/page.tsx` | **Phase 8** — Full notifications inbox; paginated list, mark read, mark all read |
| `/[locale]/profile` | `(app)/profile/page.tsx` | Current user's profile |
| `/[locale]/profile/edit` | `(app)/profile/edit/page.tsx` | Edit display name, bio, avatar |
| `/[locale]/profile/password` | `(app)/profile/password/page.tsx` | Change password |
| `/[locale]/profile/sessions` | `(app)/profile/sessions/page.tsx` | Active sessions management |
| `/[locale]/profile/premium` | `(app)/profile/premium/page.tsx` | Premium status page |
| `/[locale]/users/[id]` | `(app)/users/[id]/page.tsx` | Other user's public profile |
| `/[locale]/albums/[id]` | `(app)/albums/[id]/page.tsx` | Album detail / tracklist |
| `/[locale]/albums/create` | `(app)/albums/create/page.tsx` | Create new album |
| `/[locale]/albums/[id]/edit` | `(app)/albums/[id]/edit/page.tsx` | Edit album metadata |
| `/[locale]/playlists` | `(app)/playlists/page.tsx` | My playlists list |
| `/[locale]/playlists/[id]` | `(app)/playlists/[id]/page.tsx` | Playlist detail / tracklist |
| `/[locale]/playlists/create` | `(app)/playlists/create/page.tsx` | Create playlist |
| `/[locale]/playlists/[id]/edit` | `(app)/playlists/[id]/edit/page.tsx` | Edit playlist |
| `/[locale]/playlists/liked` | `(app)/playlists/liked/page.tsx` | Liked songs playlist |
| `/[locale]/playlists/saved` | `(app)/playlists/saved/page.tsx` | Saved playlists |
| `/[locale]/playlists/mood` | `(app)/playlists/mood/page.tsx` | **Phase 10** — Mood selector + mood-filtered song list (G7) |
| `/[locale]/onboarding` | `(app)/onboarding/page.tsx` | **Phase 10** — Genre preference onboarding (A8); own layout overrides app shell |
| `/[locale]/downloads` | `(app)/downloads/page.tsx` | Premium downloads list |
| `/[locale]/payment` | `(app)/payment/page.tsx` | Premium upgrade plan selector |
| `/[locale]/payment/vnpay` | `(app)/payment/vnpay/page.tsx` | VNPay payment result page |
| `/[locale]/payment/momo` | `(app)/payment/momo/page.tsx` | MoMo payment result page |
| `/[locale]/verify-email` | `(app)/verify-email/page.tsx` | Email verification (post-register) |
| **Artist routes** | | |
| `/[locale]/artist/profile` | `(app)/artist/profile/page.tsx` | Artist public-facing profile preview |
| `/[locale]/artist/edit` | `(app)/artist/edit/page.tsx` | Edit artist stage name, bio, avatar |
| `/[locale]/artist/songs` | `(app)/artist/songs/page.tsx` | Artist's uploaded songs list |
| `/[locale]/artist/songs/[id]/edit` | `(app)/artist/songs/[id]/edit/page.tsx` | Edit song metadata |
| `/[locale]/artist/songs/[id]/resubmit` | `(app)/artist/songs/[id]/resubmit/page.tsx` | Resubmit after REUPLOAD_REQUIRED |
| `/[locale]/artist/upload` | `(app)/artist/upload/page.tsx` | Upload new song (audio + cover + metadata + optional dropAt) |
| `/[locale]/artist/albums` | `(app)/artist/albums/page.tsx` | Artist's albums list |
| `/[locale]/artist/analytics` | `(app)/artist/analytics/page.tsx` | Play/download stats |
| `/[locale]/artist/drops` | `(app)/artist/drops/page.tsx` | **Phase 8** — Scheduled drops dashboard; countdown, cancel/reschedule modals |
| **Admin routes** | | |
| `/[locale]/admin` | `(app)/admin/page.tsx` | Admin dashboard overview |
| `/[locale]/admin/songs` | `(app)/admin/songs/page.tsx` | Song moderation queue (approve/reject/takedown) |
| `/[locale]/admin/users` | `(app)/admin/users/page.tsx` | User management |
| `/[locale]/admin/genres` | `(app)/admin/genres/page.tsx` | Genre management |
| `/[locale]/admin/payments` | `(app)/admin/payments/page.tsx` | Payment records |
| `/[locale]/admin/audit` | `(app)/admin/audit/page.tsx` | Audit log |
| `/[locale]/admin/reports` | `(app)/admin/reports/page.tsx` | Reported content |

---

## API Modules (`src/lib/api/`)

All modules use `apiClient` from `axios.ts` with `withCredentials: true`. Response envelope: `res.data?.data ?? res.data`.

| File | Key methods |
|------|-------------|
| `axios.ts` | Axios instance; base `http://localhost:3001/api/v1`; 401 interceptor → silent refresh → retry queue |
| `auth.api.ts` | `login`, `register`, `logout`, `refreshToken`, `forgotPassword`, `resetPassword`, `verifyEmail` |
| `users.api.ts` | `getMe`, `getUser`, `updateProfile`, `changePassword`, `getSessions`, `deleteSession`, `uploadAvatar` |
| `songs.api.ts` | `uploadSong`, `getSongs`, `getSong`, `getSongTeaser`, `updateSong`, `deleteSong`, `streamSong`, `likeSong`, `unlikeSong` |
| `artist.api.ts` | `getArtistProfile`, `updateArtistProfile`, `getArtistSongs`, `getArtistStats` |
| `albums.api.ts` | `getMyAlbums`, `getAlbum`, `createAlbum`, `updateAlbum`, `deleteAlbum`, `addSongToAlbum` |
| `playlists.api.ts` | `getPlaylists`, `getPlaylist`, `createPlaylist`, `updatePlaylist`, `deletePlaylist`, `addSong`, `removeSong`, `savePlaylist`, `unsavePlaylist` |
| `genres.api.ts` | `getGenres`, `createGenre`, `deleteGenre` |
| `feed.api.ts` | `getFeed`, `followUser`, `unfollowUser`, `getFollowers`, `getFollowing` |
| `downloads.api.ts` | `getDownloads`, `downloadSong` |
| `payments.api.ts` | `getPlans`, `createVNPayPayment`, `createMoMoPayment`, `verifyPayment`, `getPaymentHistory` |
| `playback.api.ts` | `getStreamUrl`, `recordPlay` |
| `admin.api.ts` | `getSongsQueue`, `approveSong`, `rejectSong`, `requireReupload`, `takedownSong`, `restoreSong`, `getUsers`, `updateUserRoles`, `getPayments`, `getAuditLog`, `getReports` |
| `drops.api.ts` | `getDrops(page,size)` → `GET /drops`; `cancelDrop(songId)` → `DELETE /songs/:id/drop`; `rescheduleDrop(songId,dropAt)` → `PATCH /songs/:id/drop`; `subscribeNotify(songId)` → `POST /songs/:id/notify`; `unsubscribeNotify(songId)` → `DELETE /songs/:id/notify` |
| `notifications.api.ts` | `getNotifications(page,limit)` → `GET /notifications`; `getUnreadCount()` → `GET /notifications/unread-count`; `markAsRead(id)` → `PATCH /notifications/:id/read`; `markAllAsRead()` → `PATCH /notifications/read-all` |
| `recommendations.api.ts` | `getRecommendations(params, ctx)` → `SongRecommendationDto[]`; `getMoodRecommendations(params, ctx)` → `{ mood, inferred, songs }`. Context headers: `X-Device-Type`, `X-Local-Hour`, `X-Location-Context`. |
| `reports.api.ts` | `reportContent`, `getReports`, `resolveReport` |

---

## Zustand Stores (`src/store/`)

### `useAuthStore`
```ts
{ user, setUser, clearUser, hasRole(role: Role): boolean, isPremium(): boolean }
```
- Hydrated by `AuthProvider` on mount via `GET /users/me`
- `user.roles` is `Role[]` — `Role.USER | Role.ARTIST | Role.ADMIN`; PREMIUM is a separate role in the same array
- `isPremium()`: returns true for ADMIN regardless (admin bypasses premium gates)
- `hasRole()`: checks `user.roles.includes(role)`

### `usePlayerStore`
```ts
{ currentSong, isPlaying, volume, position, duration, setCurrentSong, setPlaying, setVolume, setPosition }
```

### `useQueueStore`
```ts
{ queue: Song[], currentIndex, smartOrder, addToQueue, removeFromQueue, clearQueue, setCurrentIndex, toggleSmartOrder }
```

### `useLocaleStore`
```ts
{ locale, setLocale }
```

---

## Hooks (`src/hooks/`)

### `usePlayer.ts`
- Wraps Howler.js for audio playback
- Fetches stream URL from `playback.api.ts`
- Fires play event (records stream play) when position ≥ 30s
- Reads/writes `usePlayerStore` and `useQueueStore`

### `useQueue.ts`
- Queue helpers: next/prev song, shuffle, repeat logic
- Reads `useQueueStore`

### `useNotifications.ts` *(Phase 8)*
```ts
export function useNotifications(): { unreadCount: number; refetch: () => void }
```
- Polls `GET /notifications/unread-count` every 30s via `setInterval`
- Only polls when `user` is set (from `useAuthStore`)
- Clears interval on unmount
- Used by `NotificationBell` in TopBar

---

## Components

### Layout (`src/components/layout/`)

**`Sidebar.tsx`** — Fixed left nav; links to browse/feed/playlists/queue/profile; role-based artist/admin links; locale switcher; user avatar mini

**`TopBar.tsx`** — Sticky top bar; back/forward nav arrows; right side: `NotificationBell` (auth only) + user avatar dropdown (Home / Profile / Artist Studio / Admin Panel / Change Password / Sign out)

**`PlayerBar.tsx`** — Fixed bottom (`z-50`, `pb-24` on shell layout); uses `usePlayer` + `usePlayerStore`; shows current song, play/pause/prev/next, seek bar, volume

**`NotificationBell.tsx`** *(Phase 8)* — Radix DropdownMenu; Bell icon with unread badge (`email-pulse-icon`); loads last 10 notifications on open; mark read on click; "Mark all read" button; vinyl-spin loading; footer "View all notifications" → `/${locale}/notifications`

**`PremiumBadge.tsx`** — Small gold badge shown next to premium users

### Drops (`src/components/drops/`) *(Phase 8)*

**`DropCountdown.tsx`** — Live countdown via `setInterval(1s)`; props: `dropAt: string; compact?: boolean`
- Default: 4 gold bordered cells showing D / H / M / S with Playfair Display numbers
- Compact: inline string `"1d 2h 30m 5s"`
- Expired: "Dropping now!" with `email-pulse-icon`

**`CancelDropModal.tsx`** — Radix Dialog; AlertTriangle warning; "Keep Drop" / "Cancel Drop" buttons; calls `dropsApi.cancelDrop(songId)`; fires `onSuccess()`

**`RescheduleDropModal.tsx`** — Radix Dialog; `datetime-local` input; validates min = now+1h; gold warning banner when `hasRescheduled === true` (final reschedule warning); calls `dropsApi.rescheduleDrop`; passes `requiresReApproval` to `onSuccess(requiresReApproval: boolean)`

### Music (`src/components/music/`)

**`SongCard.tsx`** — Grid card; cover art, title, artist, play button on hover; like button
**`SongRow.tsx`** — Table row format; used in playlists/albums; drag-to-reorder
**`SongContextMenu.tsx`** — Right-click context menu; add to queue/playlist, like, download, share
**`AlbumCard.tsx`** — Album cover + title + artist grid card
**`PlaylistCard.tsx`** — Playlist cover + title + track count grid card

### Downloads (`src/components/downloads/`)

**`DownloadModal.tsx`** — Radix Dialog; quality selector; calls `downloadsApi.downloadSong`
**`DownloadRow.tsx`** — Row in downloads page; title, quality, expiry date, re-download button

### Payment (`src/components/payment/`)

**`PlanCard.tsx`** — Premium plan display card (price, features list)
**`GatewaySelector.tsx`** — VNPay / MoMo radio selector
**`PremiumUpgradeModal.tsx`** — Radix Dialog wrapping PlanCard + GatewaySelector
**`PaymentResultCard.tsx`** — Success/failure result after gateway redirect

### Auth (`src/components/auth/`)

**`AuthInput.tsx`** — Underline input with `auth-field` class (gold focus bar)
**`AuthButton.tsx`** — Submit button with loading state
**`PasswordInput.tsx`** — AuthInput + show/hide toggle
**`OtpInput.tsx`** — 6-digit OTP input boxes

### Profile (`src/components/profile/`)

**`AvatarUpload.tsx`** — Avatar preview + file picker; calls `usersApi.uploadAvatar`
**`FollowButton.tsx`** — Follow/unfollow toggle; `follow-bounce` animation on state change

---

## Midnight Vinyl Design System

### CSS Custom Properties (never use hex directly)

```css
--gold: #e8b84b          /* Primary accent — use sparingly */
--gold-dim: #a07d2e      /* Muted gold for secondary/dim contexts */
--gold-glow: rgba(232,184,75,0.15)  /* Subtle gold background tint */
--ivory: #f5eed8         /* Primary text color */
--charcoal: #0d0d0d      /* Page background */
--surface: #111111       /* Card / panel background */
--surface-2: #181818     /* Elevated surface (dropdowns, modals) */
--muted-text: #5a5550    /* Secondary / placeholder text */
--font-display: 'Playfair Display', Georgia, serif   /* Headings, stats, numbers */
--font-body: 'DM Sans', system-ui, sans-serif        /* All UI text */
```

Tailwind HSL vars (for Radix / shadcn compat):
```css
hsl(var(--destructive))  /* Red — used for destructive actions */
hsl(var(--border))       /* Border color */
```

### Animation Classes (ALL defined in `globals.css` — never add inline `@keyframes`)

**Entrance animations:**
```
.anim-fade-up            fadeUp 0.55s — base entrance
.anim-fade-up-1 to -8    stagger delays 0.04s → 0.46s (cap with Math.min(i+1, 8))
.anim-scale-reveal        scaleReveal 0.55s — for modals, cards
.anim-hero-reveal         heroReveal 0.65s — for hero sections
.anim-glitch-skew         glitchSkew 0.8s — for error states
```

**Continuous animations:**
```
.vinyl-spin              vinylSpin 28s linear infinite — loading discs, player
.vinyl-glow              vinylGlow 4s ease-in-out infinite — glowing disc effect
.email-pulse-icon        emailPulse 2.4s — notification badge, "Dropping now!" badge
.avatar-ring-pulse       ringPulse 2.8s — artist avatar ring
.follow-bounce           followBounce 0.4s — on follow/unfollow click
```

**Utility classes:**
```
.btn-gold        Gold shimmer gradient button; hover: translateY(-1px) + gold glow
.auth-field      Input wrapper with gold underline on :focus-within
.noise           Subtle noise texture overlay (::before pseudo)
```

### Styling Rules

- **Layout, spacing, colors** → always `style={{}}` inline
- **Animations, effects** → always `className` (references globals.css)
- **Hover states** → `onMouseEnter/onMouseLeave` updating `e.currentTarget.style`
- **Transition standard**: `cubic-bezier(0.16,1,0.3,1)` for transforms; `0.15s–0.25s` for color/opacity
- **Loading state** → always `vinyl-spin` disc, never bare `Loader2`
- **Playfair Display** → all `h1/h2/h3`, all stat numbers, all counts
- **DM Sans** → all body/UI text, buttons, labels
- **No hardcoded hex** — only CSS vars or `rgba(232,184,75,x)` for gold transparencies
- **No Tailwind gray palette** — use `--surface`, `--muted-text`, `--charcoal`
- **No Framer Motion / GSAP / @motionone**
- **No inline `@keyframes`** in component files

---

## Architecture & Patterns

### Auth & Routing
- `middleware.ts`: locale detection + cookie check; 401 on `(app)` routes → redirect to `/[locale]/login`
- `AuthProvider.tsx`: hydrates `useAuthStore` on mount via `GET /users/me`
- All links: always `/${locale}/path` — never hard-coded locale
- Shell layout: `src/app/[locale]/(app)/layout.tsx` renders Sidebar + TopBar + PlayerBar; body has `pb-24` for PlayerBar clearance

### Data Fetching
- Pattern: `useEffect` + local `useState(loading/data)` for Phases 1–9
- **Phase 10+ uses React Query (`@tanstack/react-query` v5)** — `staleTime: 5*60*1000`, no `refetchInterval`
- Query keys: `['recommendations', timeRange, size]`, `['recommendations','mood',mood]`, `['genres']` (staleTime 1h)
- Response unwrap: `const data = res.data?.data ?? res.data`
- Optimistic updates: save prev state → update store/state → call API → rollback on catch

### Forms
- `react-hook-form` + `zod` resolver — no custom form abstractions

### Toast Pattern
- Local inline: `useState<{text,kind}|null>` + `setTimeout(3500, () => setToast(null))`
- Fixed position, `zIndex: 70`, `anim-fade-up` entrance
- No global toast provider

### Modals
- Radix `Dialog.Root/Trigger/Portal/Content/Overlay`
- `anim-scale-reveal` on `DialogContent`
- Always include `Dialog.Title` (visually hidden acceptable)
- Approved Radix primitives: **Dialog, DropdownMenu, Toast, Avatar only**

---

## Key Files Quick Reference

| File | What it does |
|------|-------------|
| `src/app/globals.css` | ALL design tokens + ALL @keyframes — source of truth |
| `src/middleware.ts` | Locale routing + auth guard |
| `src/lib/api/axios.ts` | Axios instance, 401 interceptor, refresh token queue |
| `src/components/providers/AuthProvider.tsx` | Hydrates `useAuthStore` on mount |
| `src/store/useAuthStore.ts` | User identity, `hasRole()`, `isPremium()` |
| `src/hooks/usePlayer.ts` | Howler.js audio playback |
| `src/app/[locale]/(app)/layout.tsx` | Shell: Sidebar + TopBar + PlayerBar |
| `src/lib/utils/roleRedirect.ts` | `getRoleHome(roles, locale)` |
| `src/i18n/config.ts` | Locales: `['en','vi']`, defaultLocale: `'en'` |

---

## Known Gotchas

- **Double-unwrap**: always `res.data?.data ?? res.data` — never assume single envelope level
- **`isPremium()` + admin**: ADMIN users return true from `isPremium()` — check role separately if needed
- **Tailwind gray-\* banned**: use CSS vars, never `gray-*`, `white`, `black` utilities
- **`vinyl-spin` circular only**: only apply to elements with `borderRadius: '50%'`
- **`@keyframes` must be in globals.css**: never declare keyframes inside component files
- **Radix scope**: Dialog, Dropdown, Toast, Avatar only — no Slider, Select, etc.
- **Stagger cap at 8**: `className={`anim-fade-up anim-fade-up-${Math.min(i+1,8)}`}`
- **`use client` everywhere**: almost all pages are client components; RSC is minimal
- **Locale prefix on every href**: `/${locale}/path` — no bare `/path`
- **Auth layout canvas**: `(auth)/layout.tsx` uses `requestAnimationFrame` canvas — do not SSR
- **TopBar NotificationBell**: only rendered when `user` is authenticated
- **Upload page dropAt**: scheduled drop date handled inline as `datetime-local` in Advanced Options — no separate modal needed
- **`hasRescheduled` in RescheduleDropModal**: shows final-reschedule warning; backend enforces once-only; `requiresReApproval: true` in response means song returns to pending review
- **Queue add pattern**: always use `useQueue().addToQueue(songId)` (API-backed) — never `useQueueStore().addToQueue(item)` directly from pages/components
- **Recommendations context headers**: `useRecommendations` and `useMoodRecs` auto-inject `X-Device-Type` (based on `window.innerWidth`) and `X-Local-Hour` (`new Date().getHours()`) — do not pass manually from components
- **Onboarding route**: `/[locale]/(app)/onboarding` — has its own `layout.tsx` full-screen overlay (z-index 200) to bypass app shell; protected by JWT (middleware) but visually shell-free
- **`SongRecommendationDto` → `Song` adapter**: defined inline in each consumer (G7 `page.tsx`, `RecommendationSection`) — maps `totalPlays→listenCount`, fills missing fields with safe defaults
- **React Query provider**: `ReactQueryProvider` client component wraps locale layout; `defaultOptions.staleTime = 5min`
- **Phase 10 gap**: AI Chat page H5 not yet started

---

## Phase Status

| Phase | Feature | Frontend Status |
|-------|---------|----------------|
| 1 | Infrastructure + App Shell | ✅ |
| 2 | Auth & Sessions | ✅ |
| 3 | User & Artist Profiles | ✅ |
| 4A | Content Upload & DSP Processing | ✅ |
| 4B | Admin Approval & Moderation | ✅ |
| 5 | Browse, Search & Streaming | ✅ |
| 6 | Playlists & Social Feed | ✅ |
| 7 | Payments & Premium Downloads | ✅ |
| 8 | Drops & Notifications | ✅ |
| 9 | Reports, Analytics & Admin Tools | 🔲 |
| 10 | Recommendations, Mood Engine & AI Chat | ✅ (E1 + G7; AI Chat H5 not yet started) |

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
- i18n locales in `src/i18n/config.ts`; middleware matcher excludes `_next`, `api`, static files

---

## Reference Docs

Read this file first. Only open a doc when it answers something this CLAUDE.md can't.

| Doc | Read when… |
|-----|-----------|
| `../../docs/02_specification.md` | Exact screen layout or role-access matrix for a specific screen code (A1–L6) |
| `../../docs/07_api_interfaces.md` | Full request body / response shape of an endpoint not listed above |
| `../../docs/10_implementation_plan.md` | Starting a new phase — read **only that phase's `### Frontend` sub-section** |
| `../../docs/08_ai_architecture.md` | Building the AI chat page (H5, Phase 10) |
| `../../docs/01_requirements_en.md` | Exact wording of a BL code |
| `../../CLAUDE.md` | API envelope, phase status, BullMQ queues, song status machine |

**Rule**: open one doc, extract what you need, close it. Never read docs upfront before you have a specific question.

---

## Phase 10 FE Additions

### Infrastructure
- `@tanstack/react-query` v5 installed
- `ReactQueryProvider` wraps `[locale]/layout.tsx` (client component using `useState`)
- Default `staleTime`: 5 minutes; retry: 1

### Store update
- `useAuthStore.AuthUser` now includes `onboardingCompleted: boolean`
- Populated from `GET /users/me` response — **BE must return this field** (`users.service.ts → buildUserResponse`)

### New files
| File | Purpose |
|------|---------|
| `components/providers/ReactQueryProvider.tsx` | `QueryClientProvider` wrapper |
| `components/onboarding/GenreChip.tsx` | Selectable genre pill — gold border/bg when active, disabled at max-10 |
| `app/[locale]/(app)/onboarding/layout.tsx` | Fixed full-screen overlay (`z-index: 200`) bypasses app shell |
| `app/[locale]/(app)/onboarding/page.tsx` | A8 — genre selection form with `useMutation` submit |

### Hooks pattern (Phase 10)
All recommendation hooks use `useQuery` (React Query v5) — not `useEffect + useState`.
Query key patterns:
- `['recommendations', timeRange, size]`
- `['recommendations', 'mood', mood, size]`
- `['genres']` (staleTime 1 hour)

### Intentional omissions
- `X-Location-Context` header: TODO V2 (requires explicit user action)
- AI Chat page H5: not started
