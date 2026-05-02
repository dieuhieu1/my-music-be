# MyMusic Admin Portal — CLAUDE.md

Standalone Next.js 14 App Router admin interface for MyMusic. Completely separate from `apps/web` — no shared imports, no Midnight Vinyl design tokens, no music player.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS (utility classes) + inline styles |
| State (server cache) | TanStack React Query v5 |
| State (auth) | Zustand (persisted to `localStorage`) |
| HTTP | Axios with request/response interceptors |
| UI primitives | `@radix-ui/react-dialog` + locally written CVA components |
| Icons | `lucide-react` |
| Dates | `date-fns` |
| Port | 3002 |

---

## Directory Layout

```
apps/admin/
  app/
    login/              ← Standalone login page (no layout)
    (main)/             ← Route group — renders AdminSidebar + AdminHeader
      layout.tsx
      dashboard/
      songs/
      users/
      genres/
      reports/
      audit/
      payments/
      revenue/
  components/
    layout/
      AdminSidebar.tsx  ← Fixed 240px left nav; badge counts via React Query
      AdminHeader.tsx   ← Page title derived from pathname
    songs/
      ApprovalQueue.tsx
    users/
      UserTable.tsx
    genres/
      GenreSuggestionQueue.tsx
    payments/
      PaymentTable.tsx
      GrantModal.tsx
    ui/                 ← Local design system (no imports from apps/web)
      badge.tsx
      button.tsx
      dialog.tsx        ← Radix Dialog wrapper; exports ConfirmDialog
      input.tsx         ← Input + Select components
      table.tsx         ← Table + Pagination primitives
      toast.tsx         ← Context-based toast stack (bottom-right, 3500ms auto-dismiss)
  lib/
    api/
      axios.ts          ← Axios instance; reads admin_token cookie → Bearer header
      auth.api.ts       ← Login (separate raw axios instance, no auth interceptor)
      admin.api.ts      ← All admin API calls + TypeScript types
    utils/
      cn.ts             ← clsx + tailwind-merge helper
      cookies.ts        ← setAdminToken / getAdminToken / clearAdminToken
  store/
    auth.store.ts       ← Zustand AdminUser store; persisted to localStorage
  middleware.ts         ← Edge middleware; reads admin_token cookie for route protection
```

---

## Auth Strategy

**Token storage**: Regular (non-httpOnly) cookie `admin_token` with `SameSite=Strict; max-age=900` (15 min). This is intentional — the BE returns tokens in the response body (not via Set-Cookie), so client-side JS must write the cookie. Edge middleware reads it for route protection.

**Login flow**:
1. POST `/auth/login` with `{ email, password }` (raw axios, no interceptors)
2. Check `roles.includes('ADMIN')` in response
3. If not admin OR if credentials wrong → show identical error (never reveal which failed)
4. On success: call `setAdminToken(accessToken)`, save `AdminUser` to Zustand store

**Route protection** (`middleware.ts`):
- No `admin_token` → redirect to `/login`
- On `/login` with valid `admin_token` → redirect to `/dashboard`
- Root `/` → redirect to `/dashboard`

**Sign out**: `clearAdminToken()` + `clearAdminUser()` + `router.push('/login')`

---

## API Layer

**`lib/api/axios.ts`** (authenticated instance):
- Reads `admin_token` from cookie → sets `Authorization: Bearer <token>` on every request
- Response interceptor: unwraps `{ success, data }` envelope → `response.data = response.data.data`
- 401 → `clearAdminToken()` + `window.location.href = '/login'`

**`lib/api/auth.api.ts`** (raw instance — no interceptors):
- Used only for `POST /auth/login` to avoid circular 401 redirect on failed login

**`lib/api/admin.api.ts`**: Exports the `adminApi` object and all TypeScript types.

---

## TypeScript Types (admin.api.ts)

All types reflect actual BE response field names — these differ from what spec docs say in some cases:

```ts
interface AdminSong {
  id: string;
  title: string;
  artistName: string | null;
  coverArtUrl: string | null;   // added Phase 9 task 3; rendered in ApprovalQueue
  status: SongStatus;
  createdAt: string;            // BE: createdAt (NOT uploadedAt)
  dropAt: string | null;
  totalPlays: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;                 // BE toUserSummaryDto: "name" (NOT displayName)
  roles: string[];
  isPremium: boolean;
  premiumExpiresAt: string | null;
  createdAt: string;
}

interface AdminSession {
  id: string;
  deviceName: string | null;
  deviceType: string;
  ip: string;                   // BE: "ip" (NOT ipAddress)
  lastSeenAt: string;           // BE: "lastSeenAt" (NOT lastUsedAt)
  createdAt: string;
}

interface GenreSuggestion {
  id: string;
  name: string;
  userId: string;               // BE: userId (NOT userEmail — no email in response)
  songId: string | null;        // BE: songId (NOT songTitle — no title in response)
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface Genre {
  id: string;
  name: string;
  description: string | null;
  songCount: number;            // BE: counted via unnest(string_to_array(genre_ids,','))
}

interface PaymentRecord {
  id: string;
  userId: string;
  userEmail: string | null;
  provider: string;
  status: string;
  premiumType: string | null;
  amountVnd: number | null;     // BE: "amountVnd" (NOT amount)
  transactionId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Paginated<T> {
  items: T[];
  totalItems: number;           // BE: "totalItems" (NOT total)
  page: number;
  size: number;
  totalPages: number;
}

// Report — confirmed BE enum values (different from earlier spec assumptions)
interface Report {
  targetType: 'SONG' | 'PLAYLIST' | 'ARTIST' | 'USER';  // NOT COMMENT
  status: 'PENDING' | 'DISMISSED' | 'RESOLVED';          // NOT TAKEN_DOWN
  // ... (other fields omitted for brevity)
}

interface RevenueSummary {
  today: number;
  thisMonth: number;
  thisYear: number;
  allTime: number;
  last6Months: { month: string; total: number }[];        // month = 'Jan', 'Feb', etc.
  byProvider: { provider: string; total: number; count: number }[];
}
```

---

## Key Behavioral Rules

- **Genre suggestions**: `GET /admin/genres/suggestions` returns a **plain array** (no pagination). The component filters PENDING client-side.
- **Genres list**: `GET /genres` (public endpoint, not `/admin/genres`) returns `{ id, name, description, songCount }[]`. `songCount` is aggregated server-side via PostgreSQL `unnest`.
- **Create genre**: `POST /genres` with `{ name, description? }` — ADMIN role required. Returns the new genre object.
- **Report targetType**: BE enum is `SONG | PLAYLIST | ARTIST | USER` — **ARTIST**, not COMMENT. ARTIST icon = `Mic`.
- **Report status**: BE enum is `PENDING | DISMISSED | RESOLVED` — **RESOLVED**, not TAKEN_DOWN. The action button is still labelled "Takedown" and hits `PATCH /admin/reports/:id/takedown`, but the resulting status stored is `RESOLVED`.
- **Revenue summary**: `GET /admin/revenue/summary` returns pre-aggregated totals + 6-month breakdown + provider breakdown. Use this for stat cards and charts — do **not** fetch bulk payments client-side for revenue calculations.
- **Premium revoke**: `POST /admin/payments/revoke` with body `{ userId, notes? }` — it is a **POST**, not DELETE.
- **Genre suggestion paths**: `/admin/genres/suggestions/:id/approve` and `.../reject` — under `admin` prefix.
- **Session display**: show `deviceName ?? deviceType` when rendering session device column.
- **Song cover art**: `coverArtUrl` may be null; render a `<Music2>` placeholder icon when null.

---

## Design System

Light professional theme — not Midnight Vinyl. No dark mode, no CSS variables from `apps/web`.

| Token | Value |
|-------|-------|
| Background | `#F9FAFB` |
| Surface (cards, sidebar) | `#FFFFFF` |
| Border | `#E5E7EB` |
| Primary text | `#111827` |
| Secondary text | `#6B7280` |
| Muted text | `#9CA3AF` |
| Primary blue | `#2563EB` |
| Primary blue bg | `#EFF6FF` |
| Danger red | `#DC2626` |
| Success green | `#16A34A` |
| Warning amber | `#D97706` |

---

## Sidebar Badge Counts

`AdminSidebar.tsx` + `NotificationBell.tsx` poll counts via `BADGE_QUERY_KEYS` (exported from `NotificationBell.tsx`):

| Key | Query | Used by |
|-----|-------|---------|
| `pendingSongs` | `GET /admin/songs?status=PENDING&size=1` → `totalItems` | Songs nav item |
| `pendingReports` | `GET /admin/reports?status=PENDING&size=1` → `totalItems` | Reports nav item |
| `genreSuggestions` | `GET /admin/genres/suggestions` → filter PENDING client-side | Genres nav item |

Always invalidate `BADGE_QUERY_KEYS.pendingReports` after dismiss/takedown mutations in `reports/page.tsx`.

---

## docker-compose

Admin service is defined in root `docker-compose.yml`:
- Image: Node 20 Alpine, `npm run dev` on port 3002
- Volumes: mounts `app/`, `components/`, `lib/`, `store/`, `middleware.ts` for hot-reload

---

## What NOT To Do

- **NEVER** import from `apps/web` — admin is fully standalone
- **NEVER** use `user.displayName` — BE field is `name`
- **NEVER** use `session.ipAddress` or `session.lastUsedAt` — BE fields are `ip` and `lastSeenAt`
- **NEVER** use `payment.amount` — BE field is `amountVnd`
- **NEVER** use `song.uploadedAt` — BE field is `createdAt`
- **NEVER** use `data.total` for pagination total — BE field is `totalItems`
- **NEVER** paginate genre suggestions — BE returns a plain array
- **NEVER** call `DELETE /admin/payments/revoke` — it's `POST /admin/payments/revoke`
- **NEVER** use `COMMENT` as a report `targetType` — BE enum is `SONG | PLAYLIST | ARTIST | USER`
- **NEVER** use `TAKEN_DOWN` as a report `status` — BE enum is `PENDING | DISMISSED | RESOLVED`
- **NEVER** fetch bulk payments client-side for revenue calculations — use `GET /admin/revenue/summary`
- **NEVER** add Midnight Vinyl design tokens or CSS vars from `apps/web`
