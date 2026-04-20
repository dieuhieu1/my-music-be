# apps/web — Frontend CLAUDE.md

Next.js 14 App Router · React 18 · TypeScript · Tailwind · shadcn/ui · next-intl

Read `../../CLAUDE.md` first for project-level context (ports, phases, API conventions).

---

## Design System — Midnight Vinyl

Dark warm aesthetic: charcoal bg, gold accents, ivory text. No white, no grays.

### CSS Custom Properties (`src/app/globals.css`)

| Token | Value | Use |
|-------|-------|-----|
| `--gold` | `#e8b84b` | Primary accent, active states, borders |
| `--gold-dim` | `#a07d2e` | Scrollbar, subdued gold |
| `--gold-glow` | `rgba(232,184,75,0.15)` | Box shadows, ambient glows |
| `--ivory` | `#f5eed8` | Primary text |
| `--charcoal` | `#0d0d0d` | Page background |
| `--surface` | `#111111` | Card backgrounds |
| `--surface-2` | `#181818` | Hover state |
| `--muted-text` | `#5a5550` | Secondary labels, placeholders |
| `--font-display` | `Playfair Display` | All h1–h4, stats, numbers |
| `--font-body` | `DM Sans` | Body text, UI labels |

### Styling Rules

- **Layout/spacing/sizing/dynamic state** → inline `style={{}}`
- **Animations + utility effects** → `className="..."`
- **Never** hardcode hex in className. Never use Tailwind `gray-*` palette.

### Animation Classes (all keyframes in `globals.css`)

| Class | Use |
|-------|-----|
| `anim-fade-up` | Section/row entrance |
| `anim-fade-up-1` … `anim-fade-up-8` | Stagger (cap at 8) |
| `anim-scale-reveal` | Album art, avatars on mount |
| `anim-hero-reveal` | Hero banners |
| `vinyl-spin` | Spinning disc (circular elements only) |
| `vinyl-glow` | Gold glow ring when playing |
| `avatar-ring-pulse` | Artist/user avatars |
| `btn-gold` | Primary CTA button (shimmer effect) |
| `auth-field` | Input with animated gold underline |
| `noise` | Analog texture overlay |
| `shimmer` | Skeleton loading state |

**Stagger recipe:**
```tsx
<div className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}>
```

**Hover without useState** (use onMouseEnter/Leave directly on element):
```tsx
onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.3)'; }}
onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.1)'; }}
```

**Hidden button reveal on row hover** (data attribute pattern):
```tsx
// Row hover:
onMouseEnter={e => {
  const btn = e.currentTarget.querySelector<HTMLElement>('[data-action-btn]');
  if (btn) btn.style.opacity = '1';
}}
// Button: style={{ opacity: 0, transition: 'opacity 0.15s' }} data-action-btn
```

### Glassmorphism Card Pattern

```tsx
style={{
  background: 'rgba(17,17,17,0.75)',
  border: '1px solid rgba(232,184,75,0.1)',
  backdropFilter: 'blur(12px)',
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  transition: 'border-color 0.2s, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
}}
```

### Transition Standard

```tsx
transition: 'color 0.18s, background 0.18s, border-color 0.18s'  // state changes
transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)'         // movement (spring)
```

### Prohibited

- No Framer Motion / GSAP / @motionone
- No `@keyframes` inside component files (globals.css only)
- No Radix UI beyond: Dialog, Dropdown, Toast, Avatar
- No `vinyl-spin` on non-circular elements
- No purple/blue accents
- No bare `<Loader2>` for full-page loads (use `vinyl-spin` disc)

---

## Routing Structure

```
src/app/
  [locale]/
    (app)/            ← Auth-required, has Sidebar + PlayerBar
      feed/           — H1 Activity Feed
      playlists/
        page.tsx      — G1 My Playlists
        create/       — G3 Create Playlist
        liked/        — G5 Liked Songs
        saved/        — G6 Saved Playlists
        [id]/
          page.tsx    — G2 Playlist Detail
          edit/       — G4 Edit Playlist
      users/[id]/     — H4 Public User Profile
      songs/[id]/     — F1 Song Detail / Stream
      albums/[id]/    — F3 Album Detail
      artists/[id]/   — C1 Public Artist Profile
      browse/         — E2 Browse
      search/         — E3 Search Results
      queue/          — F2 Queue Page
      profile/
        page.tsx      — B1 View Profile
        edit/         — B2 Edit Profile
        premium/      — B5 Premium Upgrade
      artist/
        songs/        — D2 My Songs
        upload/       — D1 Upload Song
        albums/       — G9 Create Album
        drops/        — I2 Artist Drops
        analytics/    — D3 Artist Analytics
      payment/
        page.tsx      — J1 Payment Selection
        vnpay/        — J2 VNPay
        momo/         — J3 MoMo
      downloads/      — K2 Downloads Page
      ai/             — H5 AI Chat
      admin/
        songs/        — D5 Admin Song Queue
        genres/       — L2 Genre Management
        users/        — L3 User Management
        reports/      — L4 Reports
        audit/        — L5 Audit Log
        payments/     — L6 Payments
    (auth)/           ← Redirects to / if logged in
      login/          — A4
      register/       — A1
      register/artist/— A2
      verify-email/   — A3
      forgot-password/— A5
      verify-code/    — A6
      reset-password/ — A7
    (public)/         — No auth required
      songs/[id]/teaser/ — I1 Drop Teaser
```

---

## Zustand Stores (`src/store/`)

### useAuthStore
```ts
interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  hydrate: () => Promise<void>;  // calls GET /users/me
  logout: () => Promise<void>;
}
interface User {
  id: string; name: string; email: string; avatarUrl: string | null;
  roles: string[]; isPremium: boolean; isEmailVerified: boolean;
}
```

### usePlayerStore
```ts
interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  positionSeconds: number;
  duration: number;
  volume: number;
  setCurrent: (song: Song) => void;
  setPlaying: (v: boolean) => void;
  setPosition: (s: number) => void;
  setDuration: (s: number) => void;
  setVolume: (v: number) => void;
}
```

### useQueueStore
```ts
interface QueueState {
  items: QueueItem[];
  isSmartOrder: boolean;
  setItems: (items: QueueItem[]) => void;
  addItem: (song: Song) => void;
  removeItem: (id: string) => void;
  toggleSmartOrder: () => void;
}
```

### useLocaleStore
```ts
interface LocaleState {
  locale: 'en' | 'vi';
  setLocale: (l: 'en' | 'vi') => void;
}
```

---

## API Layer (`src/lib/api/`)

**axios instance** (`axios.ts`): base URL `http://localhost:3001/api/v1`, `withCredentials: true`, 401 interceptor → `POST /auth/refresh` → retry.

**Response unwrap pattern** (API returns `{ success, data }` envelope — axios interceptor unwraps):
```ts
const res = await songsApi.getSong(id);
const song = res.data?.data ?? res.data;  // defensive double-unwrap if interceptor missed
```

### All API Files + Key Methods

**`auth.api.ts`**: `login`, `register`, `registerArtist`, `logout`, `refresh`, `forgotPassword`, `verifyCode`, `resetPassword`, `verifyEmail`, `resendVerification`, `getSessions`, `deleteSession`

**`songs.api.ts`**: `uploadSong`, `getExtractionStatus(jobId)`, `getSongs(params)`, `getSong(id)`, `updateSong(id, dto)`, `deleteSong(id)`, `playSong(id, secondsPlayed)`, `getStreamUrl(id)`, `getNextSong(id)`, `markPlayed(id)`, `likeSong(id)`, `unlikeSong(id)`, `getTeaser(id)`, `subscribeDropNotify(id)`, `cancelDrop(id)`, `rescheduleDrop(id, dto)`, `searchSongs(q)`

**`albums.api.ts`**: `createAlbum`, `getAlbums`, `getAlbum(id)`, `updateAlbum(id, dto)`, `deleteAlbum(id)`, `addSongToAlbum(albumId, songId)`, `removeSongFromAlbum(albumId, songId)`

**`playlists.api.ts`**: `getPlaylists(page, limit)`, `createPlaylist(dto)`, `getPlaylist(id)`, `updatePlaylist(id, dto)`, `deletePlaylist(id)`, `addSong(playlistId, songId)`, `removeSong(playlistId, songId)`, `savePlaylist(id)`, `unsavePlaylist(id)`, `getSavedPlaylists()`, `getLikedSongs()`, `getUserPlaylists(userId, page, limit)`

**`users.api.ts`**: `getMe`, `updateMe(dto)`, `uploadAvatar(file)`, `getUser(id)`, `getFollowing(id, page, limit)`, `getFollowers(id, page, limit)`, `followUser(id)`, `unfollowUser(id)`, `submitOnboarding(genreIds)`, `updateGenres(genreIds)`

**`artist.api.ts`**: `getArtist(id)`, `getMyProfile`, `updateMyProfile(dto)`, `uploadAvatar(file)`, `followArtist(id)`, `unfollowArtist(id)`, `getFollowers(id)`

**`playback.api.ts`**: `getState`, `saveState(dto)`, `getQueue`, `addToQueue(songId)`, `reorderQueue(items)`, `toggleSmartOrder`, `shuffleQueue`, `removeFromQueue(itemId)`, `clearQueue`, `skipSong(songId)`

**`recommendations.api.ts`**: `getRecommendations(page, limit)`, `getMoodPlaylist(mood?, timezone?, localHour?, limit?)`

**`feed.api.ts`**: `getFeed(page, limit)`

**`notifications.api.ts`**: `getNotifications(page, limit)`, `getUnreadCount`, `markRead(id)`, `markAllRead`

**`drops.api.ts`**: `getDrops`

**`downloads.api.ts`**: `downloadSong(songId)`, `getDownloads`, `revalidateDownloads`, `removeDownload(songId)`

**`payments.api.ts`**: `initiateVnpay(premiumType)`, `initiateMomo(premiumType)`

**`genres.api.ts`**: `getGenres(page, limit)`

**`reports.api.ts`**: `submitReport(dto)`

**`admin.api.ts`**: `getAdminSongs(status)`, `approveSong(id)`, `rejectSong(id, reason)`, `requestReupload(id, reason)`, `restoreSong(id)`, `getGenreSuggestions`, `approveGenreSuggestion(id)`, `rejectGenreSuggestion(id)`, `getAdminUsers(params)`, `updateUserRoles(id, dto)`, `grantPremium(id, dto)`, `revokePremium(id)`, `getAdminReports(params)`, `dismissReport(id)`, `takedownReport(id)`, `getAuditLog(params)`, `getAdminPayments(params)`, `getAdminStats`

**`ai.api.ts`**: `chat(message, conversationId?, timezone?)`

---

## Key Hooks (`src/hooks/`)

### usePlayer
```ts
// Wraps Howler.js instance
// - play(song: Song): fetches streamUrl via GET /songs/:id/stream, loads Howler
// - Called POST /songs/:id/play when secondsPlayed >= 30
// - Sets navigator.mediaSession metadata
// - On track end: calls GET /songs/:id/next, auto-plays result
```

### useQueue
```ts
// Queue CRUD helpers — calls playback.api.ts
// toggleSmartOrder(): PATCH /playback/queue/smart-order
// shuffle(): PATCH /playback/queue/shuffle
```

---

## i18n

- `src/messages/en.json` and `src/messages/vi.json`
- All user-visible strings must use `useTranslations('namespace')`
- Locale segment: `/en/...` or `/vi/...` — handled by middleware

---

## Data Fetching Pattern

```ts
// Standard page pattern (no React Query for one-off loads)
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  api.getResource(id)
    .then(r => setData(r.data?.data ?? r.data))
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
}, [id]);
```

**Optimistic update with rollback:**
```ts
// 1. Save previous value
// 2. Update state immediately
// 3. Call API
// 4. On catch: restore previous value
```

---

## Per-Phase FE Checklist

### Phase 7 — Payments & Premium Downloads
**Files to create/modify:**
- `src/app/[locale]/(app)/profile/premium/page.tsx` — B5 pricing table (4 plans)
- `src/app/[locale]/(app)/payment/page.tsx` — J1 VNPay vs MoMo selection
- `src/app/[locale]/(app)/payment/vnpay/page.tsx` — J2 redirect + callback result page
- `src/app/[locale]/(app)/payment/momo/page.tsx` — J3 MoMo result page
- `src/app/[locale]/(app)/downloads/page.tsx` — K2 downloads list
- `src/components/music/DownloadModal.tsx` — K1 download modal
- `src/lib/api/payments.api.ts` — `initiateVnpay`, `initiateMomo`
- `src/lib/api/downloads.api.ts` — `downloadSong`, `getDownloads`, `revalidateDownloads`, `removeDownload`
- `src/lib/utils/crypto.ts` — Web Crypto API AES-256-CBC decrypt for offline `.enc` files
- Wire "Download" option in `SongContextMenu` (visible only when `user.isPremium`)
- Show `PremiumBadge` in header/sidebar when `user.isPremium`

### Phase 8 — Drops & Notifications
**Files to create/modify:**
- `src/app/[locale]/(public)/songs/[id]/teaser/page.tsx` — I1 Drop Teaser
- `src/app/[locale]/(app)/artist/drops/page.tsx` — I2 Artist My Drops
- `src/components/drops/DropCountdown.tsx` — live countdown with `setInterval`
- `src/components/drops/DropCard.tsx`
- `src/components/drops/CancelDropModal.tsx`
- `src/components/drops/RescheduleDropModal.tsx`
- `src/components/layout/NotificationBell.tsx` — polls unread-count every 30s, Radix Dropdown
- `src/hooks/useNotifications.ts`
- `src/lib/api/notifications.api.ts`
- Wire dropAt date picker into existing `UploadForm.tsx` (D1)

### Phase 9 — Reports, Analytics & Admin Tools
**Files to create/modify:**
- `src/app/[locale]/(app)/artist/analytics/page.tsx` — D3 with recharts LineChart
- `src/app/[locale]/(app)/admin/users/page.tsx` — L3
- `src/app/[locale]/(app)/admin/reports/page.tsx` — L4
- `src/app/[locale]/(app)/admin/audit/page.tsx` — L5
- `src/app/[locale]/(app)/admin/payments/page.tsx` — L6
- `src/components/modals/ReportModal.tsx` — triggered from SongContextMenu
- Wire "Report" option in `SongContextMenu`

### Phase 10 — Recommendations, Mood & AI Chat
**Files to create/modify:**
- `src/app/[locale]/(app)/playlists/mood/page.tsx` — G7 mood selector
- `src/app/[locale]/(app)/ai/page.tsx` — H5 AI chat
- Update `src/app/[locale]/(app)/feed/page.tsx` (E1 Home) — add "Recommended for you" row
- `src/lib/api/recommendations.api.ts` — `getRecommendations`, `getMoodPlaylist`
- `src/lib/api/ai.api.ts` — `chat(message, conversationId?, timezone?)`
