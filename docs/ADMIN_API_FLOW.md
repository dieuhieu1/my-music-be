# MyMusic — Admin Portal & Backend API: Full Logic & Flow Reference

> Extracted from `apps/admin` (Next.js 14, port 3002) and `apps/api` (NestJS 10, port 3001).
> Last updated: 2026-04-27

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Admin Portal — Stack & Configuration](#2-admin-portal--stack--configuration)
3. [Admin Portal — Authentication Flow](#3-admin-portal--authentication-flow)
4. [Admin Portal — Layout & Navigation](#4-admin-portal--layout--navigation)
5. [Admin Portal — Pages](#5-admin-portal--pages)
   - [Dashboard](#51-dashboard)
   - [Songs](#52-songs)
   - [Users](#53-users)
   - [Genres](#54-genres)
   - [Payments](#55-payments)
   - [Reports](#56-reports)
   - [Audit Log](#57-audit-log)
6. [Admin Portal — Shared UI Components](#6-admin-portal--shared-ui-components)
7. [Admin Portal — API Client Layer](#7-admin-portal--api-client-layer)
8. [Backend API — Core Infrastructure](#8-backend-api--core-infrastructure)
9. [Backend API — Guard Execution Order](#9-backend-api--guard-execution-order)
10. [Backend API — Response Envelope](#10-backend-api--response-envelope)
11. [Backend API — Modules](#11-backend-api--modules)
    - [Auth](#111-auth-module)
    - [Songs](#112-songs-module)
    - [Admin](#113-admin-module)
    - [Payments](#114-payments-module)
    - [Notifications](#115-notifications-module)
    - [Drops](#116-drops-module)
    - [Reports](#117-reports-module)
    - [Audit](#118-audit-module)
    - [Genres](#119-genres-module)
    - [Playback](#1110-playback-module)
    - [Search](#1111-search-module)
    - [Playlists](#1112-playlists-module)
    - [Recommendations](#1113-recommendations-module)
    - [Queue & Workers](#1114-queue--workers)
    - [Storage](#1115-storage-service)
    - [Mail](#1116-mail-service)
12. [Cross-Cutting Concerns](#12-cross-cutting-concerns)
13. [Critical Field Name Reference](#13-critical-field-name-reference)
14. [Complete Admin → API Integration Flows](#14-complete-admin--api-integration-flows)

---

## 1. System Overview

```
Browser (Admin)
      │
      ▼  port 3002
┌─────────────────────┐
│  Next.js 14 Admin   │  ← standalone app, NO shared code with apps/web
│  apps/admin/        │
└────────┬────────────┘
         │  Axios (Bearer token from admin_token cookie)
         ▼  port 3001 /api/v1
┌─────────────────────┐
│  NestJS 10 API      │  ← JWT httpOnly cookies for web users
│  apps/api/          │     Admin portal uses Authorization header instead
└────────┬────────────┘
         ├── PostgreSQL 16 (TypeORM 0.3)
         ├── Redis 7 (BullMQ + cache + JWT denylist)
         ├── AWS S3 v3 (3 buckets)
         ├── Gmail SMTP (Nodemailer)
         └── Python DSP sidecar (port 5000, /extract)
```

---

## 2. Admin Portal — Stack & Configuration

| Layer           | Technology                                     | Notes                                                             |
| --------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| Framework       | Next.js 14 App Router                          | TypeScript strict mode                                            |
| Server cache    | TanStack React Query v5                        | staleTime 60s, retry 1                                            |
| Client state    | Zustand                                        | auth store only                                                   |
| HTTP client     | Axios                                          | custom instance with interceptors                                 |
| Auth token      | `admin_token` cookie                           | non-httpOnly, 15 min, SameSite=Strict                             |
| UI primitives   | Radix UI                                       | Dialog, Checkbox, etc.                                            |
| Styling         | Tailwind CSS + CSS variables                   | dark theme; vars: `--bg`, `--surface`, `--accent`, `--muted-text` |
| Date formatting | date-fns                                       | `format`, `formatDistanceToNow`, `parseISO`                       |
| Icons           | lucide-react                                   |                                                                   |
| Charts          | Custom SVG via LineChart / BarChart components |                                                                   |

### Directory Map

```
apps/admin/
├── app/
│   ├── login/page.tsx              ← Standalone; no layout wrapper
│   ├── (main)/                     ← Route group: sidebar + header layout
│   │   ├── layout.tsx              ← Renders AdminSidebar + AdminHeader
│   │   ├── dashboard/page.tsx
│   │   ├── songs/page.tsx
│   │   ├── users/page.tsx
│   │   ├── genres/page.tsx
│   │   ├── payments/page.tsx
│   │   ├── reports/page.tsx
│   │   └── audit/page.tsx
│   ├── layout.tsx                  ← Root: QueryClientProvider, ToastProvider, AuthProvider
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── AdminSidebar.tsx        ← Fixed 240 px; badge polling every 60 s
│   │   └── AdminHeader.tsx         ← Page title + admin avatar (initials)
│   ├── ui/
│   │   ├── DataTable.tsx           ← Generic table with bulk selection + pagination
│   │   ├── StatCard.tsx            ← KPI card with trend arrow
│   │   ├── StatusBadge.tsx         ← Color-coded enum label
│   │   ├── ActivityFeed.tsx        ← Admin actions timeline, polls every 30 s
│   │   ├── dialog.tsx              ← Radix Dialog + ConfirmDialog abstraction
│   │   └── toast.tsx               ← Stack (bottom-right), 3.5 s auto-dismiss
│   └── charts/
│       ├── LineChart.tsx           ← 30-day upload trend
│       └── BarChart.tsx            ← 6-month revenue in VND
├── lib/
│   ├── api/
│   │   ├── axios.ts                ← Auth instance; envelope unwrap; 401 redirect
│   │   ├── auth.api.ts             ← Raw instance (login only, no interceptors)
│   │   └── admin.api.ts            ← All typed endpoint functions + TS interfaces
│   └── utils/
│       ├── cn.ts                   ← clsx + tailwind-merge helper
│       └── cookies.ts              ← setAdminToken / getAdminToken / clearAdminToken
├── store/
│   └── auth.store.ts               ← Zustand: AdminUser | null, setAdminUser, clearAdminUser
└── middleware.ts                   ← Edge: route guard + redirects
```

---

## 3. Admin Portal — Authentication Flow

### Login (`app/login/page.tsx`)

1. Admin submits email + password form.
2. **Raw axios** (no interceptors to avoid 401-loop) → `POST /auth/login`
3. Response returns `{ accessToken, user: { id, email, name, roles } }`.
4. Check `roles.includes('ADMIN')` → if false, show permission error, do NOT redirect.
5. `setAdminToken(accessToken)` — writes non-httpOnly cookie `admin_token`, path `/`, SameSite=Strict, max-age 900 s.
6. `setAdminUser({ id, email, name, roles })` — saves to Zustand.
7. `router.push('/dashboard')`.

### Route Protection (`middleware.ts`)

```
Every request to (main)/* → check admin_token cookie
  Missing or empty → redirect /login
  Present → continue

Request to /login with valid token → redirect /dashboard
Request to / → redirect /dashboard
```

### Sign Out

```typescript
clearAdminToken(); // delete admin_token cookie
clearAdminUser(); // clear Zustand store
router.push("/login");
```

### Axios Interceptors (`lib/api/axios.ts`)

**Request interceptor:**

```typescript
config.headers["Authorization"] = `Bearer ${getAdminToken()}`;
```

**Response interceptor:**

```typescript
// Success: unwrap envelope
response.data = response.data?.data ?? response.data;

// Error 401: clear token + hard redirect
if (error.response?.status === 401) {
  clearAdminToken();
  window.location.href = "/login";
}
```

---

## 4. Admin Portal — Layout & Navigation

### `AdminSidebar.tsx`

- Fixed 240 px left sidebar.
- Nav items: Dashboard, Songs, Users, Genres, Payments, Reports, Audit Log.
- **Badge polling** every 60 s (staleTime 30 s):
  - `GET /admin/songs?status=PENDING&size=1` → `totalItems` → yellow badge on Songs
  - `GET /admin/reports?status=PENDING&size=1` → `totalItems` → yellow badge on Reports
  - `GET /admin/genres/suggestions` → filter `status === 'PENDING'` client-side → badge on Genres
- Badges only render if count > 0.
- Active link highlighted with accent color.
- Sign Out button at bottom.

### `AdminHeader.tsx`

- Displays current page title (passed as prop from each page).
- Admin avatar: circle with 2-letter initials from `adminUser.name`.
- Admin email displayed next to avatar.

---

## 5. Admin Portal — Pages

### 5.1 Dashboard

**File:** `app/(main)/dashboard/page.tsx`

#### Data Fetched

| Query key                           | Endpoint                        | Params                  | Used for                  |
| ----------------------------------- | ------------------------------- | ----------------------- | ------------------------- |
| `['admin','songs','pending-count']` | `GET /admin/songs`              | `status=PENDING&size=1` | Stat card: Pending Review |
| `['admin','songs','live-count']`    | `GET /admin/songs`              | `status=LIVE&size=1`    | Stat card: Songs Live     |
| `['admin','songs','chart']`         | `GET /admin/songs`              | `status=LIVE&size=100`  | 30-day line chart         |
| `['admin','payments','chart']`      | `GET /admin/payments`           | `size=100`              | 6-month revenue chart     |
| `['admin','users','count']`         | `GET /admin/users`              | `size=1`                | Stat card: Total Users    |
| `['admin','reports','open']`        | `GET /admin/reports`            | `status=PENDING&size=1` | Stat card: Open Reports   |
| `['admin','genres','suggestions']`  | `GET /admin/genres/suggestions` | —                       | Genre badge count         |

#### UI Layout

```
┌────────────────────────────────────────────────────────────┐
│  [Total Users]  [Songs Live]  [Pending Review]  [Revenue]  │  ← 4 StatCards
├──────────────────────────────┬─────────────────────────────┤
│  LineChart: 30-day uploads   │  BarChart: 6-month revenue  │
├──────────────────────────────┴─────────────────────────────┤
│  ActivityFeed (recent admin actions — polls every 30 s)    │
├─────────────────────────────────────────────────────────────┤
│  Quick Actions: → Songs Queue  → Open Reports  → Genres    │
└─────────────────────────────────────────────────────────────┘
```

#### Client-Side Computation

**Line chart (30-day upload trend):**

```
songs.items → group by createdAt.substr(0,10) (yyyy-MM-dd)
→ count per day → fill gaps with 0 for last 30 days
→ x-axis: date labels, y-axis: count
```

**Bar chart (6-month revenue):**

```
payments.items → filter status === 'SUCCESS' → sum amountVnd per month-year bucket
→ x-axis: 'Jan 2026' etc., y-axis: VND (formatted with ₫ prefix)
```

**Activity feed:**

```
GET /admin/audit?size=20 → for each item:
  adminEmail.split('@')[0] as display name
  action (snake_case → Title Case mapping)
  notes if present
  formatDistanceToNow(createdAt) + ' ago'
```

---

### 5.2 Songs

**File:** `app/(main)/songs/page.tsx`

#### Endpoints

| Action            | Method | Path                                  | Body                          |
| ----------------- | ------ | ------------------------------------- | ----------------------------- |
| List songs        | GET    | `/admin/songs`                        | `?status&search&page&size=20` |
| Approve           | PATCH  | `/admin/songs/{id}/approve`           | —                             |
| Reject            | PATCH  | `/admin/songs/{id}/reject`            | `{ reason: string }`          |
| Reupload required | PATCH  | `/admin/songs/{id}/reupload-required` | `{ notes: string }`           |
| Restore           | PATCH  | `/admin/songs/{id}/restore`           | —                             |
| Takedown          | PATCH  | `/admin/songs/{id}/takedown`          | —                             |

#### Filters

| Filter         | Options                                                                          | Default   |
| -------------- | -------------------------------------------------------------------------------- | --------- |
| `statusFilter` | All, PENDING, LIVE, APPROVED, REJECTED, TAKEN_DOWN, SCHEDULED, REUPLOAD_REQUIRED | `PENDING` |
| `search`       | Free text (title or artist name)                                                 | `''`      |
| `page`         | Number                                                                           | `1`       |

#### State Variables

```typescript
statusFilter: string          // active status tab
search: string                // search input value
page: number                  // current page
selectedIds: Set<string>      // bulk selection
dialog: {
  type: 'approve' | 'reject' | 'reupload' | 'bulk-approve' | 'bulk-reject' | null
  song?: AdminSong
  notes: string
} | null
```

#### Table Columns

| Column     | Source             | Notes                             |
| ---------- | ------------------ | --------------------------------- |
| (Checkbox) | selectedIds        | Multi-select                      |
| Cover art  | `song.coverArtUrl` | 32×32 img or Music2 icon fallback |
| Title      | `song.title`       | Bold                              |
| Artist     | `song.artistName`  | Muted, "—" if null                |
| Status     | `song.status`      | `<StatusBadge>`                   |
| Plays      | `song.listenCount` | Number with comma formatting      |
| Uploaded   | `song.createdAt`   | `MMM d, yyyy`                     |
| Actions    | —                  | Inline buttons per row            |

#### Per-Row Actions by Status

| Song Status           | Available Actions                  |
| --------------------- | ---------------------------------- |
| PENDING               | Approve, Reject, Reupload Required |
| LIVE / APPROVED       | Takedown                           |
| TAKEN_DOWN / REJECTED | Restore                            |
| SCHEDULED             | Takedown                           |
| REUPLOAD_REQUIRED     | (none — waiting for artist)        |

#### Bulk Actions

- Appears as sticky bar when `selectedIds.size > 0`.
- Shows count, Approve All, Reject All, Clear buttons.
- Keyboard shortcuts shown: `A` = Approve all, `R` = Reject all, `Esc` = Clear.
- **Bulk Approve:** ConfirmDialog → `Promise.all` parallel PATCH approve for all selected IDs.
- **Bulk Reject:** Modal with textarea for shared reason → `Promise.all` parallel PATCH reject.

#### Modals

| Modal             | Trigger                      | Fields                       |
| ----------------- | ---------------------------- | ---------------------------- |
| Reject            | Click Reject button          | `reason` textarea (required) |
| Reupload Required | Click Reupload button        | `notes` textarea (optional)  |
| Bulk Approve      | Click Approve All (bulk bar) | Confirmation only            |
| Bulk Reject       | Click Reject All (bulk bar)  | `reason` textarea (shared)   |
| Takedown          | Click Takedown               | Confirmation only            |

---

### 5.3 Users

**File:** `app/(main)/users/page.tsx`

#### Endpoints

| Action         | Method | Path                                     | Body                        |
| -------------- | ------ | ---------------------------------------- | --------------------------- |
| List users     | GET    | `/admin/users`                           | `?role&search&page&size=20` |
| Update roles   | PATCH  | `/admin/users/{id}/roles`                | `{ roles: string[] }`       |
| Get sessions   | GET    | `/admin/users/{id}/sessions`             | —                           |
| Revoke session | DELETE | `/admin/users/{id}/sessions/{sessionId}` | —                           |

#### Filters

| Filter       | Options                           | Default |
| ------------ | --------------------------------- | ------- |
| `roleFilter` | ALL, USER, ARTIST, ADMIN, PREMIUM | `ALL`   |
| `search`     | Free text (email or name)         | `''`    |
| `page`       | Number                            | `1`     |

#### Table Columns

| Column  | Source               | Notes                |
| ------- | -------------------- | -------------------- |
| Avatar  | `user.name` initials | Circle with initials |
| Email   | `user.email`         | Bold                 |
| Name    | `user.name`          | Muted                |
| Roles   | `user.roles[]`       | Pill badges          |
| Premium | `user.isPremium`     | Green badge or "—"   |
| Joined  | `user.createdAt`     | `MMM d, yyyy`        |

#### Side Panel (opens on row click)

```
┌──────────────────────────────────────────────────────┐
│  [X]  User Detail                                    │
├──────────────────────────────────────────────────────┤
│  [Avatar] Name                                       │
│           email@example.com                          │
│           Roles: [USER] [ARTIST]                     │
├──────────────────────────────────────────────────────┤
│  Edit Roles                                          │
│  ☑ USER   ☐ ARTIST   ☐ ADMIN   ☐ PREMIUM            │
│  [Save Roles]                                        │
├──────────────────────────────────────────────────────┤
│  Active Sessions                                     │
│  ┌──────────────────────────────────────────────────┐│
│  │ [icon] Desktop · Chrome / Windows · 192.168.x.x  ││
│  │        Last seen 3 min ago          [Revoke]      ││
│  └──────────────────────────────────────────────────┘│
│  (loading skeleton while sessions fetch)             │
│  "No active sessions" if empty                       │
└──────────────────────────────────────────────────────┘
```

#### State Variables

```typescript
roleFilter: string
search: string
page: number
panelUser: AdminUser | null     // currently selected user
editRoles: string[]             // synced from panelUser.roles on open
```

---

### 5.4 Genres

**File:** `app/(main)/genres/page.tsx`

#### Endpoints

| Action                | Method | Path                                     | Body                           |
| --------------------- | ------ | ---------------------------------------- | ------------------------------ |
| List suggestions      | GET    | `/admin/genres/suggestions`              | — (plain array, no pagination) |
| List confirmed genres | GET    | `/genres`                                | — (public, plain array)        |
| Approve suggestion    | PATCH  | `/admin/genres/suggestions/{id}/approve` | —                              |
| Reject suggestion     | PATCH  | `/admin/genres/suggestions/{id}/reject`  | `{ notes?: string }`           |

#### Tabs

**Tab: Suggestions (default)**

- Filters client-side for `status === 'PENDING'`.
- Pending count badge on tab label.

| Column       | Source                 | Notes                                           |
| ------------ | ---------------------- | ----------------------------------------------- |
| Genre Name   | `suggestion.name`      |                                                 |
| Suggested By | `suggestion.userId`    | First 8 chars of UUID (no user email available) |
| Song         | `suggestion.songId`    | First 8 chars or "—"                            |
| Date         | `suggestion.createdAt` | `MMM d, yyyy`                                   |
| Status       | `suggestion.status`    | StatusBadge                                     |
| Actions      | —                      | Approve + Reject buttons (PENDING only)         |

Empty state: CheckCircle icon + "No pending suggestions"

**Tab: Confirmed**

- Read-only table.
- Client-side search box by genre name.

| Column      | Source                     |
| ----------- | -------------------------- |
| Name        | `genre.name`               |
| Description | `genre.description` or "—" |

#### Reject Modal

- Optional `notes` textarea.
- Confirm = `PATCH /admin/genres/suggestions/{id}/reject` with notes.

#### State Variables

```typescript
tab: 'suggestions' | 'confirmed'
rejectDialog: { id: string; notes: string } | null
genreSearch: string   // confirmed tab filter
```

---

### 5.5 Payments

**File:** `app/(main)/payments/page.tsx`

#### Endpoints

| Action                     | Method | Path                            | Body                                        |
| -------------------------- | ------ | ------------------------------- | ------------------------------------------- |
| List payments              | GET    | `/admin/payments`               | `?provider&status&from&to&page&size=20`     |
| List manual grants         | GET    | `/admin/payments/manual-grants` | `?page&size=20`                             |
| Search users (grant modal) | GET    | `/admin/users`                  | `?search&size=10`                           |
| Grant premium              | POST   | `/admin/payments/grant`         | `{ userId, durationDays, notes? }`          |
| Revoke premium             | POST   | `/admin/payments/revoke`        | `{ userId, notes? }` ← POST, **NOT DELETE** |

#### Tabs

**Tab: All Payments** — full transaction history

Filters:

- Provider: VNPAY, MOMO, ADMIN (dropdown)
- Status: SUCCESS, PENDING, FAILED, REFUNDED, ADMIN_GRANTED (dropdown)
- From date, To date (ISO date pickers)

**Tab: Manual Grants** — ADMIN_GRANTED records only

No filters. Adds Revoke button per row.

#### Table Columns

| Column              | Source                  | Notes                                                |
| ------------------- | ----------------------- | ---------------------------------------------------- |
| User Email          | `payment.userEmail`     | "—" if null                                          |
| Provider            | `payment.provider`      | Colored badge (VNPAY blue, MOMO green, ADMIN purple) |
| Amount              | `payment.amountVnd`     | `₫` + number formatted, "—" if null                  |
| Type                | `payment.premiumType`   | Muted label or "—"                                   |
| Status              | `payment.status`        | StatusBadge                                          |
| Txn ID              | `payment.transactionId` | Truncated 16 chars, monospace, "—" if null           |
| Date                | `payment.createdAt`     | `MMM d, yyyy`                                        |
| [grants tab] Revoke | —                       | Opens revoke confirmation dialog                     |

#### Grant Premium Modal

```
┌───────────────────────────────────────┐
│  Grant Premium                        │
├───────────────────────────────────────┤
│  User: [email search input]           │
│        [autocomplete dropdown — 6 max]│
│        [Selected: Name / email   [X]] │
│                                       │
│  Duration (days): [1–365 number input]│
│                                       │
│  Notes (optional): [textarea]         │
│                                       │
│  [Cancel]  [Grant Premium] (disabled if no user) │
└───────────────────────────────────────┘
```

#### Revoke Dialog

Confirmation: "Revoke premium from {email}? This will immediately remove premium access."
Buttons: Cancel, Revoke (destructive red).

#### State Variables

```typescript
tab: "all" | "grants";
provider: string; // filter, '' = all
status: string; // filter, '' = all
from: string; // ISO date string, '' = unset
to: string;
page: number;
grantOpen: boolean;
revokeDialog: PaymentRecord | null;
```

---

### 5.6 Reports

**File:** `app/(main)/reports/page.tsx`

#### Endpoints

| Action       | Method | Path                           | Body                              |
| ------------ | ------ | ------------------------------ | --------------------------------- |
| List reports | GET    | `/admin/reports`               | `?status&targetType&page&size=20` |
| Dismiss      | PATCH  | `/admin/reports/{id}/dismiss`  | `{ notes?: string }`              |
| Takedown     | PATCH  | `/admin/reports/{id}/takedown` | `{ notes?: string }`              |

#### Filters

| Filter       | Options                             | Default   |
| ------------ | ----------------------------------- | --------- |
| `status`     | All, PENDING, DISMISSED, TAKEN_DOWN | `PENDING` |
| `targetType` | All, SONG, USER, PLAYLIST, COMMENT  | `''`      |

#### Table Columns

| Column   | Source                 | Notes                                                                |
| -------- | ---------------------- | -------------------------------------------------------------------- |
| Type     | `report.targetType`    | Colored badge (SONG blue, USER purple, PLAYLIST amber, COMMENT gray) |
| Target   | `report.targetTitle`   | Name of reported content                                             |
| Reason   | `report.reason`        | Muted text                                                           |
| Reporter | `report.reporterEmail` | Muted                                                                |
| Status   | `report.status`        | StatusBadge                                                          |
| Filed    | `report.createdAt`     | `MMM d, yyyy`                                                        |
| Actions  | —                      | Dismiss + Takedown (only if PENDING)                                 |

#### Modals

**Dismiss Modal:**

- Title: "Dismiss report"
- Description: "Mark as dismissed — no action taken."
- Optional notes textarea.
- Buttons: Cancel (gray), Dismiss (default).

**Takedown Modal:**

- Title: "Takedown content"
- Description: "This will remove the {targetType} and cannot be undone."
- Optional notes textarea.
- Buttons: Cancel (gray), Takedown (destructive red).

#### State Variables

```typescript
status: string       // default 'PENDING'
targetType: string   // default ''
page: number
dialog: {
  type: 'dismiss' | 'takedown'
  report: Report
  notes: string
} | null
```

---

### 5.7 Audit Log

**File:** `app/(main)/audit/page.tsx`

#### Endpoints

| Action          | Method | Path                                               |
| --------------- | ------ | -------------------------------------------------- |
| List audit logs | GET    | `/admin/audit?action&adminId&from&to&page&size=25` |

#### Filters

| Filter    | Type        | Notes           |
| --------- | ----------- | --------------- |
| `action`  | Text input  | Substring match |
| `adminId` | Text input  | Substring match |
| `from`    | Date picker | ISO date        |
| `to`      | Date picker | ISO date        |

#### Table Columns (Read-Only)

| Column    | Source           | Notes                                                                                                                    |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Admin     | `log.adminEmail` |                                                                                                                          |
| Action    | `log.action`     | Colored badge (APPROVED green, REJECTED red, GRANTED amber, REVOKED orange, TAKEDOWN red, RESTORED blue, DISMISSED gray) |
| Type      | `log.targetType` | Muted or "—"                                                                                                             |
| Target ID | `log.targetId`   | Truncated 12 chars, monospace, "—" if null                                                                               |
| Notes     | `log.notes`      | Truncated, "—" if null                                                                                                   |
| Timestamp | `log.createdAt`  | `MMM d, yyyy HH:mm`                                                                                                      |

#### CSV Export

- Button top-right: "Export CSV"
- Exports all items on **current page** (not all pages).
- CSV columns: Admin Email, Action, Target Type, Target ID, Notes, Timestamp
- Filename: `audit-{yyyy-MM-dd}.csv`

#### State Variables

```typescript
action: string;
adminId: string;
from: string;
to: string;
page: number;
```

---

## 6. Admin Portal — Shared UI Components

### `DataTable`

```tsx
<DataTable
  columns={[{ key, label, render? }]}
  data={items}
  isLoading={boolean}
  emptyIcon={ReactNode}
  emptyTitle={string}
  emptySubtitle={string}
  selectable={boolean}
  selectedIds={Set<string>}
  onSelectRow={(id: string) => void}
  onSelectAll={() => void}
  pagination={{ page, totalPages, onPageChange }}
/>
```

- Checkbox column is prepended if `selectable=true`.
- Loading state: 3 skeleton rows.
- Pagination: Prev / Next buttons, disabled at bounds, "Page X of Y" label.

### `StatCard`

```tsx
<StatCard
  label="Total Users"
  value={1234}
  icon={<Users />}
  trend={{ value: 12, direction: "up" }} // optional
  isLoading={boolean}
/>
```

- Trend arrow: green up, red down.
- Loading: two placeholder lines.

### `StatusBadge`

```tsx
<StatusBadge status="PENDING" size="sm" | "md" />
```

Color map:
| Status | Text | Background |
|--------|------|-----------|
| PENDING | `#F59E0B` | `rgba(245,158,11,0.15)` |
| LIVE | `#10B981` | `rgba(16,185,129,0.15)` |
| APPROVED | `#3B82F6` | `rgba(59,130,246,0.15)` |
| REJECTED | `#EF4444` | `rgba(239,68,68,0.15)` |
| TAKEN_DOWN | `#6B7280` | `rgba(107,114,128,0.15)` |
| SCHEDULED | `#8B5CF6` | `rgba(139,92,246,0.15)` |
| REUPLOAD_REQUIRED | `#F97316` | `rgba(249,115,22,0.15)` |
| SUCCESS | `#10B981` | `rgba(16,185,129,0.15)` |
| FAILED | `#EF4444` | `rgba(239,68,68,0.15)` |
| ADMIN_GRANTED | `#8B5CF6` | `rgba(139,92,246,0.15)` |

### `ActivityFeed`

- `GET /admin/audit?size=20` with React Query, refetchInterval 30000 ms.
- Renders timeline dots + vertical connector lines.
- Dot colors by action type.
- Each item: admin username (before @), formatted action, optional notes, `formatDistanceToNow` timestamp.
- Loading: 5 skeleton rows.

### `ConfirmDialog`

```tsx
<ConfirmDialog
  open={boolean}
  title="Reject Song"
  description="Provide a reason for rejection."
  hasTextarea={boolean}
  textareaValue={string}
  onTextareaChange={(v: string) => void}
  textareaPlaceholder="Enter reason..."
  confirmLabel="Reject"
  cancelLabel="Cancel"
  destructive={boolean}       // true = red confirm button
  onConfirm={() => void}
  onCancel={() => void}
/>
```

- Esc key → cancel.
- Confirm button disabled while mutation is pending.

### `toast`

```tsx
const { addToast } = useToast();
addToast({ title: "Song approved", variant: "success" | "error" | "info" });
```

- Stack renders bottom-right.
- Auto-dismiss after 3500 ms.
- Slide-in animation.

---

## 7. Admin Portal — API Client Layer

### TypeScript Interfaces (`lib/api/admin.api.ts`)

```typescript
type SongStatus =
  | "PENDING"
  | "APPROVED"
  | "LIVE"
  | "REJECTED"
  | "TAKEN_DOWN"
  | "SCHEDULED"
  | "REUPLOAD_REQUIRED";

interface AdminSong {
  id: string;
  title: string;
  artistName: string | null;
  coverArtUrl: string | null;
  status: SongStatus;
  createdAt: string; // ISO8601
  dropAt: string | null;
  listenCount: number; // totalPlays in service layer
}

interface AdminUser {
  id: string;
  email: string;
  name: string; // field is `name` — NOT `displayName`
  roles: string[];
  isPremium: boolean;
  premiumExpiresAt: string | null;
  createdAt: string;
}

interface AdminSession {
  id: string;
  deviceName: string | null;
  deviceType: "MOBILE" | "TABLET" | "DESKTOP" | "OTHER";
  ip: string; // field is `ip` — NOT `ipAddress`
  lastSeenAt: string; // field is `lastSeenAt` — NOT `lastUsedAt`
  createdAt: string;
}

interface GenreSuggestion {
  id: string;
  name: string;
  userId: string; // raw UUID — no user email available
  songId: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface Genre {
  id: string;
  name: string;
  description: string | null;
}

interface Report {
  id: string;
  targetId: string;
  targetType: "SONG" | "USER" | "PLAYLIST" | "COMMENT";
  targetTitle: string;
  reason: string;
  reporterEmail: string;
  status: "PENDING" | "DISMISSED" | "TAKEN_DOWN";
  notes: string | null;
  createdAt: string;
}

interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetId: string | null;
  targetType: string | null;
  notes: string | null;
  createdAt: string;
}

interface PaymentRecord {
  id: string;
  userId: string;
  userEmail: string | null;
  provider: string;
  status: string;
  premiumType: string | null;
  amountVnd: number | null; // field is `amountVnd` — NOT `amount`
  transactionId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Paginated<T> {
  items: T[];
  totalItems: number; // field is `totalItems` — NOT `total`
  page: number;
  size: number;
  totalPages: number;
}
```

---

## 8. Backend API — Core Infrastructure

| Layer         | Technology                     | Config                                                               |
| ------------- | ------------------------------ | -------------------------------------------------------------------- |
| Framework     | NestJS 10 + Express            | `src/app.module.ts`                                                  |
| ORM           | TypeORM 0.3                    | `autoLoadEntities: true`; dev: `synchronize: true`; prod: migrations |
| DB            | PostgreSQL 16                  | `src/config/database.config.ts`                                      |
| Queue         | BullMQ + Redis 7               | `QueueModule` — `@Global()`                                          |
| Storage       | AWS S3 `@aws-sdk/client-s3` v3 | 3 buckets                                                            |
| Auth          | Passport JWT                   | httpOnly cookies: `access_token` 15 min, `refresh_token` 30 days     |
| Email         | Nodemailer + Gmail SMTP        | App Password; `smtp.gmail.com:587` STARTTLS                          |
| DSP sidecar   | Python FastAPI                 | `DSP_URL` env → `/extract` endpoint                                  |
| Cron          | `@nestjs/schedule`             | `ScheduleModule.forRoot()`                                           |
| Global prefix | `/api/v1`                      | Set in `main.ts`                                                     |

### Rate Limits (Redis-backed ThrottlerGuard)

| Route group                   | Limit              |
| ----------------------------- | ------------------ |
| General                       | 200 req/min per IP |
| Auth routes (`/auth/*`)       | 10 req/min per IP  |
| Upload (`POST /songs/upload`) | 5 req/min per user |

---

## 9. Backend API — Guard Execution Order

Every authenticated request flows through guards in this exact order:

```
1. ThrottlerGuard         — rate limit (Redis)
2. JwtAuthGuard           — global; reads access_token cookie; @Public() bypasses 2+3
3. EmailVerifiedGuard     — global; @SkipEmailVerified() bypasses
4. RolesGuard             — only activates when @Roles() is on handler
5. ValidationPipe         — whitelist:true, transform:true, forbidNonWhitelisted:true
6. Controller handler
7. Service                — all BL + ownership check (BL-50)
8. TransformInterceptor   — wraps { success, data } on way out
9. AuditLogInterceptor    — fires after success when @AuditAction() is present
```

**BL-50 Ownership check (always in service):**

```typescript
if (
  resource.userId !== currentUser.id &&
  !currentUser.roles.includes("ADMIN")
) {
  throw new ForbiddenException();
}
```

---

## 10. Backend API — Response Envelope

**Success:**

```json
{ "success": true, "data": { ... } }
```

**Error:**

```json
{
  "success": false,
  "data": null,
  "error": { "code": "SNAKE_CASE_CODE", "message": "..." }
}
```

**Paginated list (all list endpoints):**

```json
{
  "items": [...],
  "totalItems": 100,
  "page": 1,
  "size": 20,
  "totalPages": 5
}
```

> **Note:** Phase 8+ endpoints use query param `size`; Phase 1–7 use `limit`. Both still return `totalItems` in the response.

---

## 11. Backend API — Modules

### 11.1 Auth Module

**Path:** `src/modules/auth/`

#### Routes

| Method | Path                              | Guard       | Description                                        |
| ------ | --------------------------------- | ----------- | -------------------------------------------------- |
| POST   | `/auth/register`                  | @Public     | Register with USER role                            |
| POST   | `/auth/register/artist`           | @Public     | Register with ARTIST role + create ArtistProfile   |
| POST   | `/auth/login`                     | @Public     | Verify credentials, set httpOnly cookies           |
| POST   | `/auth/logout`                    | JWT         | Revoke session, add access_token to Redis denylist |
| POST   | `/auth/refresh`                   | jwt-refresh | Read refresh_token cookie, issue new access_token  |
| POST   | `/auth/forgot-password`           | @Public     | Send 6-digit code to email                         |
| POST   | `/auth/verify-code`               | @Public     | Verify code → return reset token                   |
| POST   | `/auth/reset-password`            | @Public     | Consume reset token, update passwordHash           |
| POST   | `/auth/verify-email`              | JWT         | Mark `user.isEmailVerified = true`                 |
| POST   | `/auth/resend-verification-email` | @Public     | Resend code                                        |
| POST   | `/auth/change-password`           | JWT         | Update passwordHash (current password required)    |
| GET    | `/auth/sessions`                  | JWT         | List user's active sessions                        |
| DELETE | `/auth/sessions/:id`              | JWT         | Revoke specific session                            |

#### Entities

**User** (`auth/entities/user.entity.ts`)

| Field               | Type                 | Notes                                                 |
| ------------------- | -------------------- | ----------------------------------------------------- |
| id                  | uuid PK              |                                                       |
| name                | varchar              | Display name                                          |
| email               | varchar UNIQUE       |                                                       |
| passwordHash        | varchar              | bcrypt                                                |
| roles               | simple-array         | USER, ARTIST, ADMIN, PREMIUM                          |
| isEmailVerified     | boolean              | default false                                         |
| failedAttempts      | int                  | brute-force counter                                   |
| lockUntil           | timestamptz nullable | set on 5th failed attempt                             |
| avatarUrl           | varchar nullable     | S3 public URL                                         |
| followerCount       | int                  | default 0                                             |
| followingCount      | int                  | default 0                                             |
| premiumExpiresAt    | timestamptz nullable |                                                       |
| downloadQuota       | int                  | download counter                                      |
| onboardingCompleted | boolean              | default false (Phase 10)                              |
| createdAt           | timestamptz          |                                                       |
| updatedAt           | timestamptz          |                                                       |
| **isPremium**       | getter               | `roles.includes('PREMIUM') && premiumExpiresAt > now` |
| **isLocked**        | getter               | `lockUntil && lockUntil > now`                        |

**Session** (`auth/entities/session.entity.ts`)

| Field            | Type             | Notes                          |
| ---------------- | ---------------- | ------------------------------ |
| id               | uuid PK          |                                |
| userId           | FK → users       |                                |
| accessTokenHash  | varchar          | bcrypt of JWT                  |
| refreshTokenHash | varchar          |                                |
| deviceName       | varchar nullable |                                |
| deviceType       | enum             | MOBILE, DESKTOP, TABLET, OTHER |
| userAgent        | text             |                                |
| ip               | varchar          | client IP                      |
| expiresAt        | timestamptz      | refresh_token expiry           |
| createdAt        | timestamptz      |                                |
| lastUsedAt       | timestamptz      |                                |

**VerificationCode** (`auth/entities/verification-code.entity.ts`)

| Field     | Type                 | Notes                        |
| --------- | -------------------- | ---------------------------- |
| id        | uuid PK              |                              |
| userId    | FK                   |                              |
| code      | varchar(6)           | 6-digit numeric              |
| type      | enum                 | EMAIL_VERIFY, PASSWORD_RESET |
| expiresAt | timestamptz          | 15 min from creation         |
| usedAt    | timestamptz nullable |                              |

**ArtistProfile** (`auth/entities/artist-profile.entity.ts`)

| Field                 | Type              | Notes                                 |
| --------------------- | ----------------- | ------------------------------------- |
| id                    | uuid PK           |                                       |
| userId                | FK UNIQUE → users |                                       |
| stageName             | varchar           | Display name for artist               |
| bio                   | text nullable     |                                       |
| socialLinks           | json              | `[{ platform: string, url: string }]` |
| followerCount         | int               | default 0                             |
| listenerCount         | int               | default 0                             |
| suggestedGenres       | simple-array      |                                       |
| createdAt / updatedAt | timestamptz       |                                       |

#### Business Logic

| BL Code  | Rule                                                                              |
| -------- | --------------------------------------------------------------------------------- |
| BL-11A   | 5 failed logins → lockUntil = now + 15 min; during lock, return 423               |
| BL-41    | Auth routes: 10 req/min throttle                                                  |
| BL-42    | Email verification: required before allowed to stream/upload (EmailVerifiedGuard) |
| BL-43    | isPremium getter: checks both role presence AND expiry                            |
| BL-60–62 | Session management: new login from same device revokes old session                |

---

### 11.2 Songs Module

**Path:** `src/modules/songs/`

#### Routes

| Method | Path                       | Guard          | Description                                           |
| ------ | -------------------------- | -------------- | ----------------------------------------------------- |
| POST   | `/songs/upload`            | ARTIST         | Multipart: `audio` (required) + `coverArt` (optional) |
| GET    | `/songs`                   | @Public        | Browse LIVE songs, paginated                          |
| GET    | `/songs/mine`              | ARTIST         | Own songs (all statuses)                              |
| GET    | `/songs/:id`               | OptionalJWT    | Song detail (no listenCount increment here)           |
| GET    | `/songs/:id/stream`        | JWT            | 15-min presigned S3 URL                               |
| PATCH  | `/songs/:id`               | JWT            | Update metadata + optional new cover art              |
| PATCH  | `/songs/:id/resubmit`      | ARTIST         | REUPLOAD_REQUIRED → PENDING                           |
| DELETE | `/songs/:id`               | JWT            | Hard-delete (BL-50 ownership)                         |
| POST   | `/songs/:id/like`          | JWT            | Delegates to PlaylistsService.likeSong()              |
| DELETE | `/songs/:id/like`          | JWT            | Delegates to PlaylistsService.unlikeSong()            |
| GET    | `/songs/downloads`         | JWT            | List own downloadable encrypted records               |
| POST   | `/songs/:id/download`      | PREMIUM\|ADMIN | Quota check; returns presigned .enc URL               |
| DELETE | `/songs/downloads/:songId` | JWT            | Remove own download record                            |

#### Upload Interceptor (Multer)

```typescript
FileFieldsInterceptor(
  [
    { name: "audio", maxCount: 1 },
    { name: "coverArt", maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (_, file, cb) => {
      // allowed: audio/mpeg, audio/flac, audio/wav, image/jpeg, image/png, image/webp
    },
  },
);
```

#### Upload Flow (BL-48, BL-39, BL-44)

```
1. BL-39 Quota check
   → non-premium: count songs WHERE userId=X AND status != REJECTED
   → if count >= 50 → 403 "Upload limit reached"

2. BL-44 Magic-byte validation
   → read first 12 bytes
   → ID3v2 (0x49 44 33) or MP3 frame sync (0xFF 0xEx) → audio/mpeg
   → FLAC (0x66 4C 61 43) → audio/flac
   → WAV (RIFF ... WAVE) → audio/wav
   → no match → 400 "Invalid audio file"

3. Strip ID3v2 tags (MP3 only)
   → decode syncsafe 4-byte size at offset 6
   → buf.subarray(10 + tagSize)

4. AES-256-CBC encryption
   → key = randomBytes(32)
   → iv  = randomBytes(16)
   → encrypted = cipher.update(buf) + cipher.final()

5. S3 uploads (parallel, before DB)
   → mymusic-audio  /audio/songs/{userId}/{songId}      ← plain
   → mymusic-audio  /audio/songs/{userId}/{songId}.enc  ← encrypted
   → mymusic-images /songs/{userId}/{songId}-cover      ← cover art (optional)

6. DB transaction
   → Song { status: PENDING, fileUrl, encryptedFileUrl, coverArtUrl, ... }
   → SongEncryptionKey { songId, aesKey (base64), iv (base64) }
   → AlbumSong (if dto.albumId)
   → GenreSuggestion (if dto.suggestGenre)
   → On failure: delete all S3 objects (Promise.allSettled)

7. Enqueue BullMQ job (fire-and-forget)
   → queue: audio-extraction
   → job: 'extract'
   → data: { songId }
```

#### Entities

**Song** (`songs/entities/song.entity.ts`)

| Field                 | Type                 | Notes                                                                       |
| --------------------- | -------------------- | --------------------------------------------------------------------------- |
| id                    | uuid PK              |                                                                             |
| userId                | FK → users           |                                                                             |
| title                 | varchar(255)         |                                                                             |
| duration              | int nullable         | seconds; set by DSP                                                         |
| fileUrl               | varchar              | S3 object key, plain audio                                                  |
| encryptedFileUrl      | varchar              | S3 object key, .enc file                                                    |
| coverArtUrl           | varchar nullable     | S3 object key                                                               |
| genreIds              | simple-array         | Genre UUIDs                                                                 |
| bpm                   | float nullable       | Set by DSP                                                                  |
| camelotKey            | varchar nullable     | e.g. "8A"; set by DSP                                                       |
| energy                | float nullable       | DSP composite; **NEVER exposed**                                            |
| status                | enum                 | PENDING, APPROVED, SCHEDULED, LIVE, REJECTED, REUPLOAD_REQUIRED, TAKEN_DOWN |
| dropAt                | timestamptz nullable |                                                                             |
| dropJob24hId          | varchar nullable     | BullMQ job ID                                                               |
| dropJob1hId           | varchar nullable     | BullMQ job ID                                                               |
| hasRescheduled        | boolean              | default false                                                               |
| reuploadReason        | text nullable        | Set by admin                                                                |
| rejectionReason       | text nullable        | Set by admin                                                                |
| listenCount           | int                  | default 0; column: `listen_count`                                           |
| createdAt / updatedAt | timestamptz          |                                                                             |

**SongEncryptionKey** (`songs/entities/song-encryption-key.entity.ts`)

| Field     | Type              | Notes                      |
| --------- | ----------------- | -------------------------- |
| id        | uuid PK           |                            |
| songId    | FK UNIQUE → songs |                            |
| aesKey    | varchar           | base64-encoded 32-byte key |
| iv        | varchar           | base64-encoded 16-byte IV  |
| createdAt | timestamptz       |                            |

**SongDailyStats** (`songs/entities/song-daily-stats.entity.ts`)

| Field   | Type       | Notes       |
| ------- | ---------- | ----------- |
| id      | uuid PK    |             |
| songId  | FK → songs |             |
| date    | date       | yyyy-MM-dd  |
| listens | int        | daily count |

#### Upload DTO (`dto/upload-song.dto.ts`)

```typescript
class UploadSongDto {
  title: string; // required, max 255
  bpm?: number; // 20–400 (multipart sends as string; @Type(() => Number))
  camelotKey?: string; // transformed .toUpperCase()
  genreIds?: string[]; // UUIDs; @Transform handles single value OR array
  albumId?: string; // UUID
  dropAt?: string; // ISO 8601; range validated in service
  suggestGenre?: string; // max 100; creates GenreSuggestion
}
```

#### Song Status Machine

```
PENDING
  → (admin approve, no dropAt)           → LIVE
  → (admin approve, with dropAt)         → SCHEDULED
  → (admin reject)                       → REJECTED
  → (admin reupload-required)            → REUPLOAD_REQUIRED

REUPLOAD_REQUIRED
  → (artist resubmit)                    → PENDING

SCHEDULED
  → (cron at dropAt)                     → LIVE
  → (artist cancel drop)                 → APPROVED
  → (artist reschedule, 1st time)        → SCHEDULED (new dropAt)
  → (artist reschedule, 2nd time)        → PENDING (re-approval required)

LIVE
  → (admin takedown)                     → TAKEN_DOWN

TAKEN_DOWN
  → (admin restore)                      → LIVE
```

---

### 11.3 Admin Module

**Path:** `src/modules/admin/`

All routes require `@Roles(Role.ADMIN)` + `RolesGuard`.

#### Routes — Songs

| Method | Path                                 | Description                                                              |
| ------ | ------------------------------------ | ------------------------------------------------------------------------ |
| GET    | `/admin/songs`                       | Paginated; filter by `status`, `search`; response includes `coverArtUrl` |
| PATCH  | `/admin/songs/:id/approve`           | PENDING → LIVE or SCHEDULED; enqueues BullMQ drop jobs if SCHEDULED      |
| PATCH  | `/admin/songs/:id/reject`            | Body: `{ reason: string }`                                               |
| PATCH  | `/admin/songs/:id/reupload-required` | Body: `{ notes: string }`                                                |
| PATCH  | `/admin/songs/:id/takedown`          | LIVE → TAKEN_DOWN                                                        |
| PATCH  | `/admin/songs/:id/restore`           | TAKEN_DOWN → LIVE                                                        |

**Approve logic:**

```typescript
if (song.status !== SongStatus.PENDING) throw ConflictException;
if (song.dropAt && song.dropAt > now) {
  song.status = SongStatus.SCHEDULED;
  // enqueue BullMQ delayed jobs
  const delay24h = song.dropAt.getTime() - Date.now() - 24 * 60 * 60 * 1000;
  const delay1h = song.dropAt.getTime() - Date.now() - 60 * 60 * 1000;
  song.dropJob24hId = (
    await dropNotificationQueue.add(
      "drop-notify-24h",
      { songId },
      { delay: delay24h },
    )
  ).id;
  song.dropJob1hId = (
    await dropNotificationQueue.add(
      "drop-notify-1h",
      { songId },
      { delay: delay1h },
    )
  ).id;
} else {
  song.status = SongStatus.LIVE;
}
// save song, write audit log, send email, create in-app notification
```

#### Routes — Users

| Method | Path                                       | Description                             |
| ------ | ------------------------------------------ | --------------------------------------- |
| GET    | `/admin/users`                             | Paginated; filter by `role`, `search`   |
| GET    | `/admin/users/:userId`                     | Single user detail                      |
| PATCH  | `/admin/users/:userId/roles`               | Body: `{ roles: string[] }`             |
| GET    | `/admin/users/:userId/sessions`            | Returns **plain array** (no pagination) |
| DELETE | `/admin/users/:userId/sessions/:sessionId` | Revoke one session                      |

#### Routes — Genres

| Method | Path                                    | Description                                 |
| ------ | --------------------------------------- | ------------------------------------------- |
| GET    | `/admin/genres/suggestions`             | Returns **plain array** (no pagination)     |
| PATCH  | `/admin/genres/suggestions/:id/approve` | Creates Genre record, enqueues bulk-tag job |
| PATCH  | `/admin/genres/suggestions/:id/reject`  | Body: `{ notes?: string }`                  |

#### Routes — Reports

| Method | Path                          | Description                                          |
| ------ | ----------------------------- | ---------------------------------------------------- |
| GET    | `/admin/reports`              | Paginated; filter by `status`, `targetType`          |
| PATCH  | `/admin/reports/:id/dismiss`  | Body: `{ notes?: string }`                           |
| PATCH  | `/admin/reports/:id/takedown` | Body: `{ notes?: string }` → song becomes TAKEN_DOWN |

#### Routes — Audit

| Method | Path           | Description                                            |
| ------ | -------------- | ------------------------------------------------------ |
| GET    | `/admin/audit` | Paginated; filter by `action`, `adminId`, `from`, `to` |

#### Routes — Payments

| Method | Path                            | Description                                             |
| ------ | ------------------------------- | ------------------------------------------------------- |
| GET    | `/admin/payments`               | Paginated; filter by `provider`, `status`, `from`, `to` |
| GET    | `/admin/payments/manual-grants` | Paginated; ADMIN_GRANTED only                           |
| POST   | `/admin/payments/grant`         | Body: `{ userId, durationDays, notes? }`                |
| POST   | `/admin/payments/revoke`        | Body: `{ userId, notes? }` ← **POST, not DELETE**       |

#### Admin Response DTOs (confirmed field names)

```typescript
// Song list
interface AdminSongDto {
  id: string;
  title: string;
  artistName: string | null;
  coverArtUrl: string | null; // presigned or public URL
  status: SongStatus;
  createdAt: string; // NOT uploadedAt
  dropAt: string | null;
  listenCount: number;
}

// User list + detail
interface AdminUserDto {
  id: string;
  email: string;
  name: string; // NOT displayName
  roles: string[];
  isPremium: boolean;
  premiumExpiresAt: string | null;
  createdAt: string;
}

// Session
interface AdminSessionDto {
  id: string;
  deviceName: string | null;
  deviceType: string;
  ip: string; // NOT ipAddress
  lastSeenAt: string; // NOT lastUsedAt
  createdAt: string;
}

// Payment
interface AdminPaymentDto {
  id: string;
  userId: string;
  userEmail: string | null;
  provider: string;
  status: string;
  premiumType: string | null;
  amountVnd: number | null; // NOT amount
  transactionId: string | null;
  expiresAt: string | null;
  createdAt: string;
}
```

---

### 11.4 Payments Module

**Path:** `src/modules/payments/`

#### Routes

| Method | Path                       | Guard   | Description                                       |
| ------ | -------------------------- | ------- | ------------------------------------------------- |
| GET    | `/payment/vn-pay`          | JWT     | `?premiumType=`; returns `{ paymentUrl }`         |
| GET    | `/payment/vn-pay/callback` | @Public | HMAC-SHA512 verify; idempotent                    |
| POST   | `/payment/momo`            | JWT     | Body: `{ premiumType }`; returns `{ paymentUrl }` |
| POST   | `/payment/momo/callback`   | @Public | HMAC-SHA256 verify; idempotent                    |

#### Entity — PaymentRecord

| Field         | Type                 | Notes                                             |
| ------------- | -------------------- | ------------------------------------------------- |
| id            | uuid PK              |                                                   |
| userId        | FK → users           |                                                   |
| provider      | enum                 | VNPAY, MOMO, ADMIN                                |
| amountVnd     | int                  | Vietnamese Dong amount                            |
| premiumType   | enum                 | ONE_MONTH, THREE_MONTH, SIX_MONTH, TWELVE_MONTH   |
| status        | enum                 | PENDING, SUCCESS, FAILED, REFUNDED, ADMIN_GRANTED |
| transactionId | varchar nullable     | Provider order ID                                 |
| expiresAt     | timestamptz nullable | When premium expires                              |
| createdAt     | timestamptz          |                                                   |

#### Business Logic

| BL    | Rule                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------- |
| BL-52 | VNPay: generate payment URL with HMAC-SHA512 signature                                                  |
| BL-53 | MoMo: internal POST to MoMo API, return redirect URL; callback verifies HMAC-SHA256                     |
| BL-54 | Hourly cron: check `premiumExpiresAt < now` → remove PREMIUM role from `user.roles`, send revoke email  |
| BL-55 | Download quota: PREMIUM users get quota (100 for USER+PREMIUM, 200 for ARTIST+PREMIUM, unlimited ADMIN) |
| BL-71 | Idempotent callbacks: verify `transactionId` uniqueness; skip if already SUCCESS                        |

---

### 11.5 Notifications Module

**Path:** `src/modules/notifications/`

#### Routes

| Method | Path                          | Guard | Description                                                |
| ------ | ----------------------------- | ----- | ---------------------------------------------------------- |
| GET    | `/notifications`              | JWT   | Paginated (`?page&size`)                                   |
| GET    | `/notifications/unread-count` | JWT   | Returns `{ count: number }`                                |
| PATCH  | `/notifications/read-all`     | JWT   | Mark all as read ← **must be declared before `/:id/read`** |
| PATCH  | `/notifications/:id/read`     | JWT   | Mark single as read                                        |

#### Entity — Notification

| Field     | Type                 | Notes                                                 |
| --------- | -------------------- | ----------------------------------------------------- |
| id        | uuid PK              |                                                       |
| userId    | FK → users           |                                                       |
| type      | enum                 | See below                                             |
| title     | varchar(255)         | Auto-generated by service from type + payload         |
| body      | text                 | Auto-generated                                        |
| payload   | jsonb                | Structured data (songId, artistName, dropAt, reason…) |
| isRead    | boolean              | default false                                         |
| readAt    | timestamptz nullable |                                                       |
| createdAt | timestamptz          |                                                       |

#### NotificationType Enum Values

```
SONG_APPROVED | SONG_REJECTED | SONG_REUPLOAD_REQUIRED | SONG_RESTORED
PREMIUM_ACTIVATED | PREMIUM_REVOKED
UPCOMING_DROP | NEW_RELEASE | DROP_CANCELLED | DROP_RESCHEDULED
SONG_TAKEN_DOWN
```

#### Notification Triggers

| Trigger                     | Type                   | Caller                    |
| --------------------------- | ---------------------- | ------------------------- |
| Admin approves song         | SONG_APPROVED          | AdminService              |
| Admin rejects song          | SONG_REJECTED          | AdminService              |
| Admin requests reupload     | SONG_REUPLOAD_REQUIRED | AdminService              |
| Admin restores song         | SONG_RESTORED          | AdminService              |
| Admin takes down song       | SONG_TAKEN_DOWN        | AdminService              |
| Payment success             | PREMIUM_ACTIVATED      | PaymentsService callback  |
| Premium expiry cron         | PREMIUM_REVOKED        | PaymentsService cron      |
| BullMQ drop-notify-24h      | UPCOMING_DROP          | DropNotificationWorker    |
| BullMQ drop-notify-1h       | UPCOMING_DROP          | DropNotificationWorker    |
| Drop fires SCHEDULED → LIVE | NEW_RELEASE            | DropsService.fireDueDrops |
| Drop cancelled              | DROP_CANCELLED         | DropsService              |
| Drop rescheduled            | DROP_RESCHEDULED       | DropsService              |

---

### 11.6 Drops Module

**Path:** `src/modules/drops/`

#### Routes

| Method | Path                | Guard         | Description                                 |
| ------ | ------------------- | ------------- | ------------------------------------------- |
| GET    | `/songs/:id/teaser` | @Public       | Returns teaser only if status=SCHEDULED     |
| POST   | `/songs/:id/notify` | JWT           | Opt-in drop notification                    |
| DELETE | `/songs/:id/notify` | JWT           | Opt-out                                     |
| GET    | `/drops`            | ARTIST\|ADMIN | ARTIST: own SCHEDULED; ADMIN: all SCHEDULED |
| DELETE | `/songs/:id/drop`   | ARTIST\|ADMIN | Cancel drop → APPROVED                      |
| PATCH  | `/songs/:id/drop`   | ARTIST\|ADMIN | Reschedule; body: `{ dropAt: ISO8601 }`     |

#### Entity — DropNotification

| Field  | Type                   | Notes |
| ------ | ---------------------- | ----- |
| userId | varchar (composite PK) |       |
| songId | varchar (composite PK) |       |

#### Business Logic

| BL     | Rule                                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BL-59  | `dropAt` range: `now + 1h ≤ dropAt ≤ now + 90d` (validated in service, not DTO)                                                                                            |
| BL-60  | Teaser: derived text `"{stageName} · drops in {relative}"` — never persisted                                                                                               |
| BL-61  | Drop jobs: 24h + 1h BullMQ delayed jobs enqueued by AdminService at approval time                                                                                          |
| BL-62  | Cron `* * * * *`: `UPDATE songs SET status='LIVE' WHERE status='SCHEDULED' AND dropAt<=now AND affected>0`; delete DropNotification records; emit NEW_RELEASE notification |
| BL-63  | Cancel: SCHEDULED → APPROVED (not PENDING); clear `dropAt`, `dropJob24hId`, `dropJob1hId`; remove BullMQ jobs; send cancel email                                           |
| BL-65  | Reschedule: `hasRescheduled=false` → update `dropAt`, re-enqueue BullMQ jobs, set `hasRescheduled=true`; `hasRescheduled=true` → 403 "Reschedule limit reached"            |
| BL-65A | Reschedule time constraint: `newDropAt > originalDropAt - 24h` AND `newDropAt ≥ now+1h` AND `newDropAt ≤ now+90d`                                                          |

---

### 11.7 Reports Module

**Path:** `src/modules/reports/` (or within admin module)

#### Routes

| Method | Path       | Guard | Description   |
| ------ | ---------- | ----- | ------------- |
| POST   | `/reports` | JWT   | Create report |

#### Entity — Report

| Field         | Type          | Notes                                 |
| ------------- | ------------- | ------------------------------------- |
| id            | uuid PK       |                                       |
| userId        | FK            | reporter                              |
| targetType    | enum          | SONG, PLAYLIST, ARTIST, USER, COMMENT |
| targetId      | varchar       | ID of reported entity                 |
| targetTitle   | varchar       | Name/title of target                  |
| reason        | enum          | EXPLICIT, COPYRIGHT, INAPPROPRIATE    |
| reporterEmail | varchar       | Snapshot of reporter email            |
| status        | enum          | PENDING, DISMISSED, RESOLVED          |
| notes         | text nullable | Admin note                            |
| createdAt     | timestamptz   |                                       |

---

### 11.8 Audit Module

**Path:** `src/modules/audit/`

#### Entity — AuditLog

| Field      | Type             | Notes                                               |
| ---------- | ---------------- | --------------------------------------------------- |
| id         | uuid PK          |                                                     |
| adminId    | varchar          | Admin UUID or `song.userId` if cron-fired drop      |
| adminEmail | varchar          |                                                     |
| action     | varchar          | e.g., SONG_APPROVED, SONG_REJECTED, PREMIUM_GRANTED |
| targetType | varchar nullable | e.g., 'SONG', 'USER'                                |
| targetId   | varchar nullable | UUID of target entity                               |
| notes      | text nullable    |                                                     |
| createdAt  | timestamptz      |                                                     |

#### `@AuditAction()` Decorator

Applied to controller methods. The `AuditLogInterceptor` fires after success and writes an AuditLog record with:

- `adminId` from JWT payload
- `action` from decorator argument
- `targetId` from route param or response

---

### 11.9 Genres Module

**Path:** `src/modules/genres/`

#### Routes

| Method | Path      | Guard   | Description                 |
| ------ | --------- | ------- | --------------------------- |
| GET    | `/genres` | @Public | Plain array (no pagination) |

#### Entities

**Genre**

| Field                 | Type           | Notes |
| --------------------- | -------------- | ----- |
| id                    | uuid PK        |       |
| name                  | varchar UNIQUE |       |
| description           | text nullable  |       |
| createdAt / updatedAt | timestamptz    |       |

**GenreSuggestion**

| Field      | Type                 | Notes                       |
| ---------- | -------------------- | --------------------------- |
| id         | uuid PK              |                             |
| userId     | FK → users           | suggester                   |
| songId     | FK → songs nullable  | context song                |
| name       | varchar              | suggested genre name        |
| status     | enum                 | PENDING, APPROVED, REJECTED |
| reviewedBy | varchar nullable     | admin UUID                  |
| reviewedAt | timestamptz nullable |                             |
| createdAt  | timestamptz          |                             |

#### Business Logic

| BL    | Rule                                                                                  |
| ----- | ------------------------------------------------------------------------------------- |
| BL-24 | Suggestion approval: creates Genre record + enqueues `bulk-tag-songs` BullMQ job      |
| BL-25 | Bulk tagging: worker scans all songs, finds genre keyword matches, updates `genreIds` |

---

### 11.10 Playback Module

**Path:** `src/modules/playback/`

#### Routes

| Method | Path                     | Guard | Description                                  |
| ------ | ------------------------ | ----- | -------------------------------------------- |
| GET    | `/songs/:id/stream`      | JWT   | Presigned URL, 15 min TTL; LIVE songs only   |
| POST   | `/playback/:songId/play` | JWT   | Record play, increment listenCount (at ≥30s) |

#### Entity — PlayHistory

| Field     | Type                      | Notes                                     |
| --------- | ------------------------- | ----------------------------------------- |
| id        | uuid PK                   |                                           |
| userId    | FK → users                |                                           |
| songId    | FK → songs                |                                           |
| duration  | int                       | seconds listened                          |
| skipped   | boolean                   | default false; Phase 10 skip-penalty flag |
| createdAt | timestamptz               |                                           |
| **Index** | (userId, songId, skipped) | composite                                 |

#### Business Logic

| BL     | Rule                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| BL-28  | Stream URL: 15-min presigned S3 URL; only LIVE songs; increment happens separately |
| BL-35  | Play recording: FE calls at ≥30 s mark; `song.listenCount++` + insert PlayHistory  |
| BL-35B | Skip penalty (Phase 10): `skipped=true` → reduces recommendation score             |

---

### 11.11 Search Module

**Path:** `src/modules/search/`

#### Routes

| Method | Path      | Guard | Description                                   |
| ------ | --------- | ----- | --------------------------------------------- |
| GET    | `/search` | JWT   | `?q=` full-text across songs, albums, artists |

Searches: song titles, artist stageName, album titles using PostgreSQL full-text or trigram index.

---

### 11.12 Playlists Module

**Path:** `src/modules/playlists/`

#### Routes

| Method | Path                           | Guard       | Description                      |
| ------ | ------------------------------ | ----------- | -------------------------------- |
| POST   | `/playlists`                   | JWT         | Create playlist                  |
| GET    | `/playlists`                   | JWT         | List user's playlists            |
| GET    | `/playlists/:id`               | OptionalJWT | Playlist detail + songs          |
| PATCH  | `/playlists/:id`               | JWT         | Update title/description (BL-50) |
| POST   | `/playlists/:id/songs`         | JWT         | Add song                         |
| DELETE | `/playlists/:id/songs/:songId` | JWT         | Remove song                      |
| POST   | `/playlists/:id/like`          | JWT         | Save playlist                    |
| DELETE | `/playlists/:id/like`          | JWT         | Unsave                           |

#### Entities

**Playlist** — id, userId, title, description, isPublic, songCount, likeCount

**PlaylistSong** — (playlistId, songId) composite PK, position int

**SavedPlaylist** — (userId, playlistId) composite PK

---

### 11.13 Recommendations Module

**Path:** `src/modules/recommendations/` (Phase 10)

#### Routes

| Method | Path                   | Guard | Description                                                 |
| ------ | ---------------------- | ----- | ----------------------------------------------------------- |
| GET    | `/recommendations`     | JWT   | `?mood=HAPPY\|SAD\|FOCUS\|CHILL\|WORKOUT&timeRange=7d\|30d` |
| POST   | `/users/me/onboarding` | JWT   | Set genre preferences + `onboardingCompleted=true`          |

#### Entities

**RecommendationCache**

| Field                | Type             | Notes                                     |
| -------------------- | ---------------- | ----------------------------------------- |
| userId               | FK               |                                           |
| mood                 | varchar nullable | null = general recs                       |
| songs                | jsonb            | `SongRecommendationDto[]` pre-serialized  |
| computedAt           | timestamptz      |                                           |
| expiresAt            | timestamptz      | `computedAt + 86400s`                     |
| UNIQUE(userId, mood) | —                | null-safety via findOne+save in app layer |

**UserGenrePreference**

| Field                   | Type | Notes |
| ----------------------- | ---- | ----- |
| userId                  | FK   |       |
| genreId                 | FK   |       |
| UNIQUE(userId, genreId) | —    |       |

#### Business Logic

| BL     | Rule                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| BL-35A | Cold-start fallback: no play history → use UserGenrePreference                                                  |
| BL-35B | Skip penalty: `skipped=true` in PlayHistory reduces song's score                                                |
| BL-35C | Score tuning: energy < 4 penalty for skip; duration normalization                                               |
| BL-37A | energy field: NEVER in any API response; internal DSP only; stripped in `toDto()`                               |
| BL-37B | Mood filter: HAPPY=high energy, SAD=melancholic, FOCUS=low BPM/instrumental, CHILL=low energy, WORKOUT=high BPM |
| BL-62A | Cache-aside: check Redis `rec:user:{userId}:general` / `rec:user:{userId}:mood:{MOOD}` before computing         |
| BL-62B | Batch cron (3am daily): recompute all user recs, store in DB + Redis (24h TTL)                                  |
| —      | `timeRange` values outside `7d`/`30d` → 422; values > 50 songs silently clamped to 50                           |
| —      | Only LIVE songs in candidates (`WHERE status='LIVE'` enforced in `fetchCandidateSongs()`)                       |

#### `SongRecommendationDto` (response shape — NOT an entity)

```typescript
interface SongRecommendationDto {
  id: string;
  title: string;
  artistName: string | null;
  coverArtUrl: string | null;
  listenCount: number;
  // energy: NEVER included
}
```

---

### 11.14 Queue & Workers

**Path:** `src/modules/queue/`

All queues registered in `QueueModule` (`@Global()`). Workers are in their feature module's `providers` array — NOT in QueueModule.

#### BullMQ Queues

| Constant                           | Queue Name             | Job Names                           | Worker Location                                                      |
| ---------------------------------- | ---------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `QUEUE_NAMES.EMAIL`                | `email`                | `send-email` (legacy: `send`)       | `modules/mail/workers/email.worker.ts`                               |
| `QUEUE_NAMES.AUDIO_EXTRACTION`     | `audio-extraction`     | `extract-metadata`                  | `modules/queue/workers/audio-extraction.worker.ts`                   |
| `QUEUE_NAMES.DROP_NOTIFICATION`    | `drop-notification`    | `drop-notify-24h`, `drop-notify-1h` | `modules/queue/workers/drop-notification.worker.ts` (in DropsModule) |
| `QUEUE_NAMES.GENRE_BULK_TAGGING`   | `genre-bulk-tagging`   | `bulk-tag-songs`                    | `modules/queue/workers/genre-bulk-tagging.worker.ts`                 |
| `QUEUE_NAMES.SESSION_CLEANUP`      | `session-cleanup`      | `cleanup-session`                   | `modules/queue/workers/session-cleanup.worker.ts`                    |
| `QUEUE_NAMES.RECOMMENDATION_BATCH` | `recommendation-batch` | `compute-batch`                     | `modules/recommendations/workers/recommendation-batch.worker.ts`     |

#### Cron Jobs

| Schedule    | Action                                   | Service                                      | Notes               |
| ----------- | ---------------------------------------- | -------------------------------------------- | ------------------- |
| `* * * * *` | Fire SCHEDULED drops → LIVE              | `DropsService.fireDueDrops()`                | Idempotent UPDATE   |
| `0 * * * *` | Premium expiry + revoke                  | `PaymentsService.handlePremiumExpiry()`      | Remove PREMIUM role |
| `0 3 * * *` | Recommendation batch compute             | `RecommendationBatchWorker.runBatch()`       | All users           |
| `0 3 * * *` | Hard-delete expired downloads            | `DownloadsService.cleanupExpiredDownloads()` |                     |
| `0 0 * * *` | JWT denylist + verification code cleanup | `AuthService.cleanupTokens()`                |                     |
| `0 3 * * *` | Inactive session cleanup                 | `SessionCleanupWorker`                       | 30-day window       |

#### AudioExtractionWorker Flow

```
1. Receive job: { songId }
2. Fetch Song from DB
3. Generate 1-hour presigned S3 URL for song.fileUrl (plain audio)
4. POST {DSP_URL}/extract with { audioUrl }
5. DSP returns { bpm, camelotKey, energy, duration }
6. UPDATE songs SET bpm, camelotKey, energy, duration WHERE id=songId
   (energy stored but never exposed)
```

#### DropNotificationWorker Flow

```
Job: drop-notify-24h OR drop-notify-1h
1. Receive job: { songId }
2. Fetch Song + ArtistProfile
3. Fetch all DropNotification records for songId (opted-in users)
4. For each user: create in-app Notification (type: UPCOMING_DROP)
5. Enqueue email job for artist: upcomingDropEmail(title, stageName, dropAt, is24h)
```

---

### 11.15 Storage Service

**Path:** `src/modules/storage/storage.service.ts`

Uses `@aws-sdk/client-s3` v3 + `@aws-sdk/lib-storage` + `@aws-sdk/s3-request-presigner`.

```typescript
StorageService.upload(bucket, key, buffer, contentType): Promise<void>
StorageService.getPublicUrl(bucket, key): string
  // returns: https://{bucket}.s3.{region}.amazonaws.com/{key}
  // only correct for mymusic-images (public-read bucket)
StorageService.presignedGetObject(bucket, key, expiresInSeconds): Promise<string>
StorageService.presignedPutObject(bucket, key, expiresInSeconds): Promise<string>
StorageService.deleteObject(bucket, key): Promise<void>
StorageService.getBuckets(): { audio: string, audioEnc: string, images: string }
```

#### Bucket Usage Matrix

| Bucket              | Access      | Used for                            | URL type                          |
| ------------------- | ----------- | ----------------------------------- | --------------------------------- |
| `mymusic-audio`     | Private     | Plain audio, encrypted .enc audio   | Presigned (15 min stream, 1h DSP) |
| `mymusic-audio-enc` | Private     | AES-256-CBC .enc files for download | Presigned (5 min)                 |
| `mymusic-images`    | Public-read | Cover art, user avatars             | Direct public URL                 |

---

### 11.16 Mail Service

**Path:** `src/modules/mail/mail.service.ts`

Transport: Gmail SMTP, `smtp.gmail.com:587`, STARTTLS (`secure: false`, `requireTLS: true`).
All templates are inline HTML (no `.hbs` files).

#### Email Templates

| Method                                            | Trigger                           | Queue call             |
| ------------------------------------------------- | --------------------------------- | ---------------------- |
| `verificationEmail(code)`                         | Registration                      | Registration handler   |
| `passwordResetEmail(code)`                        | Forgot password                   | Auth service           |
| `accountLockedEmail()`                            | Brute-force lockout (5th attempt) | Auth service           |
| `premiumActivatedEmail(expiresAt)`                | Payment success / admin grant     | PaymentsService        |
| `premiumRevokedEmail()`                           | Hourly expiry cron                | PaymentsService        |
| `songApprovedEmail(title)`                        | Admin approve                     | AdminService           |
| `songRejectedEmail(title, reason)`                | Admin reject                      | AdminService           |
| `songReuploadRequiredEmail(title, notes)`         | Admin reupload request            | AdminService           |
| `songRestoredEmail(title)`                        | Admin restore                     | AdminService           |
| `upcomingDropEmail(title, artist, dropAt, is24h)` | BullMQ drop-notify-24h / 1h       | DropNotificationWorker |
| `dropCancelledEmail(title, artist)`               | Drop cancel (BL-63)               | DropsService           |
| `dropRescheduledEmail(title, artist, newDropAt)`  | Drop reschedule (BL-65)           | DropsService           |

All are queued: `emailQueue.add('send-email', { to, subject, html })`.
**Never call `MailService` directly from a controller.**

---

## 12. Cross-Cutting Concerns

### Common Decorators

| Decorator                | Effect                                                    |
| ------------------------ | --------------------------------------------------------- |
| `@Public()`              | Bypasses JwtAuthGuard + EmailVerifiedGuard                |
| `@Roles(Role.X)`         | Activates RolesGuard; requires user.roles includes Role.X |
| `@SkipEmailVerified()`   | Bypasses EmailVerifiedGuard (password reset routes)       |
| `@CurrentUser()`         | Injects JWT payload as `req.user`                         |
| `@AuditAction('ACTION')` | After success, AuditLogInterceptor writes AuditLog record |

### Common Guards

| Guard                  | File                                       | Description                             |
| ---------------------- | ------------------------------------------ | --------------------------------------- |
| `JwtAuthGuard`         | `common/guards/jwt-auth.guard.ts`          | Global; validates `access_token` cookie |
| `EmailVerifiedGuard`   | `common/guards/email-verified.guard.ts`    | Global; checks `user.isEmailVerified`   |
| `RolesGuard`           | `common/guards/roles.guard.ts`             | Conditional; checks roles array         |
| `OptionalJwtAuthGuard` | `common/guards/optional-jwt-auth.guard.ts` | JWT if present, null if absent          |

### Common Interceptors

| Interceptor            | Effect                                                         |
| ---------------------- | -------------------------------------------------------------- |
| `TransformInterceptor` | Wraps all responses in `{ success, data }` envelope            |
| `AuditLogInterceptor`  | Reads `@AuditAction()` metadata, writes AuditLog after success |

### Enum Reference

```typescript
enum SongStatus {
  PENDING | APPROVED | SCHEDULED | LIVE | REJECTED | REUPLOAD_REQUIRED | TAKEN_DOWN
}
enum NotificationType {
  SONG_APPROVED | SONG_REJECTED | SONG_REUPLOAD_REQUIRED | SONG_RESTORED
  PREMIUM_ACTIVATED | PREMIUM_REVOKED
  UPCOMING_DROP | NEW_RELEASE | DROP_CANCELLED | DROP_RESCHEDULED | SONG_TAKEN_DOWN
}
enum FeedEventType {
  NEW_PLAYLIST | SONG_LIKED | ARTIST_FOLLOWED | NEW_RELEASE
  UPCOMING_DROP | DROP_CANCELLED | DROP_RESCHEDULED
}
enum Role       { USER | ARTIST | ADMIN | PREMIUM }
enum PaymentProvider { VNPAY | MOMO | ADMIN }
enum PaymentStatus   { PENDING | SUCCESS | FAILED | REFUNDED | ADMIN_GRANTED }
enum PremiumType     { ONE_MONTH | THREE_MONTH | SIX_MONTH | TWELVE_MONTH }
enum GenreSuggestionStatus { PENDING | APPROVED | REJECTED }
enum DeviceType      { MOBILE | DESKTOP | TABLET | OTHER }
enum MoodType        { HAPPY | SAD | FOCUS | CHILL | WORKOUT }
```

---

## 13. Critical Field Name Reference

These mismatches have caused bugs. Always use the left column.

| Context                    | Correct field                 | NOT this             |
| -------------------------- | ----------------------------- | -------------------- |
| User profile (admin list)  | `name`                        | `displayName`        |
| Session object             | `ip`                          | `ipAddress`          |
| Session object             | `lastSeenAt`                  | `lastUsedAt`         |
| Payment record             | `amountVnd`                   | `amount`             |
| Song (admin list)          | `createdAt`                   | `uploadedAt`         |
| Paginated response         | `totalItems`                  | `total`              |
| Recommendation response    | _(no energy field)_           | `energy` — **NEVER** |
| Query param (Phase 8+)     | `size`                        | `limit`              |
| Revoke premium endpoint    | `POST /admin/payments/revoke` | DELETE verb          |
| Genre suggestions endpoint | plain array                   | paginated object     |
| User sessions endpoint     | plain array                   | paginated object     |

---

## 14. Complete Admin → API Integration Flows

### Flow 1: Admin Approves a Song

```
Admin clicks "Approve" on Songs page
  │
  ▼
PATCH /api/v1/admin/songs/{id}/approve
  [ThrottlerGuard → JwtAuthGuard → EmailVerifiedGuard → RolesGuard(ADMIN)]
  │
  ▼
AdminService.approveSong(adminId, songId)
  1. Load song from DB
  2. Validate status === PENDING; else throw ConflictException
  3. if song.dropAt && song.dropAt > now:
       song.status = SCHEDULED
       enqueue 'drop-notify-24h' (BullMQ delayed, delay = dropAt - 24h)
       enqueue 'drop-notify-1h'  (BullMQ delayed, delay = dropAt - 1h)
       save job IDs to song.dropJob24hId / dropJob1hId
     else:
       song.status = LIVE
  4. Save song
  5. emailQueue.add('send-email', songApprovedEmail(song.title) → artist)
  6. NotificationsService.create(song.userId, SONG_APPROVED, payload)
  7. AuditLogInterceptor writes AuditLog(adminId, 'SONG_APPROVED', 'SONG', songId)
  │
  ▼
Response: { success: true, data: AdminSongDto }
  │
  ▼
Admin portal: React Query invalidates ['admin','songs'] cache
Songs table refreshes. Status badge changes to LIVE or SCHEDULED.
```

### Flow 2: Song Drop Fires (Cron)

```
Every minute: DropsService.fireDueDrops()
  │
  ▼
UPDATE songs SET status='LIVE'
  WHERE status='SCHEDULED' AND dropAt <= now
  RETURNING id, userId, title
  (idempotent — affected=0 means already fired or no drops due)
  │
  ▼ for each fired song:
  1. DELETE FROM drop_notifications WHERE song_id = songId
  2. NotificationsService.create(song.userId, NEW_RELEASE, payload)
  3. FeedService.createEvent(song.userId, FeedEventType.NEW_RELEASE, payload)
  4. AuditLog(adminId=song.userId, 'DROP_FIRED', 'SONG', songId)
     ↑ (no human admin; use song.userId to satisfy FK constraint)
```

### Flow 3: Admin Grants Premium

```
Admin opens Grant modal → searches user by email → sets durationDays
  │
  ▼
POST /api/v1/admin/payments/grant
  body: { userId, durationDays, notes? }
  │
  ▼
AdminService.grantPremium(adminId, dto)
  1. Load user from DB
  2. Compute expiresAt = now + durationDays * 86400s
  3. Add 'PREMIUM' to user.roles (if not present)
  4. user.premiumExpiresAt = expiresAt
  5. Create PaymentRecord { provider: ADMIN, status: ADMIN_GRANTED, premiumType: derived, expiresAt }
  6. emailQueue.add('send-email', premiumActivatedEmail(expiresAt) → user)
  7. NotificationsService.create(userId, PREMIUM_ACTIVATED, { expiresAt })
  8. AuditLog(adminId, 'PREMIUM_GRANTED', 'USER', userId, notes)
  │
  ▼
Admin portal: toast "Premium granted", invalidate payments cache
```

### Flow 4: Admin Revokes Premium

```
Admin clicks Revoke on manual grants tab
  │
  ▼
POST /api/v1/admin/payments/revoke  ← NOTE: POST, not DELETE
  body: { userId, notes? }
  │
  ▼
AdminService.revokePremium(adminId, dto)
  1. Load user
  2. Remove 'PREMIUM' from user.roles
  3. user.premiumExpiresAt = null
  4. Cascade: mark active DownloadRecords as revoked (BL-56)
  5. emailQueue.add('send-email', premiumRevokedEmail() → user)
  6. NotificationsService.create(userId, PREMIUM_REVOKED, {})
  7. AuditLog(adminId, 'PREMIUM_REVOKED', 'USER', userId, notes)
  │
  ▼
Admin portal: invalidate payments + grants cache
```

### Flow 5: Song Upload End-to-End

```
Artist submits upload form (title + audio file + optional cover art)
  │
  ▼
POST /api/v1/songs/upload  (multipart/form-data)
  [ThrottlerGuard(5/min) → JWT → EmailVerified → RolesGuard(ARTIST)]
  [Multer: buffer in memory, 50MB limit, MIME whitelist]
  │
  ▼
SongsService.upload(userId, dto, audioFile, coverArtFile?)
  1. BL-39: count songs WHERE userId AND status!=REJECTED → if >=50 → 403
  2. Magic-byte validation → 400 if invalid
  3. Strip ID3v2 tags (MP3 only)
  4. AES-256-CBC encrypt: generate key+IV, produce .enc buffer
  5. S3 upload (parallel):
       mymusic-audio  ← plain audio
       mymusic-audio  ← .enc audio
       mymusic-images ← cover art (non-fatal if fails)
  6. DB transaction:
       INSERT Song (status=PENDING, fileUrl, encryptedFileUrl, ...)
       INSERT SongEncryptionKey (aesKey, iv)
       INSERT AlbumSong (if albumId provided)
       INSERT GenreSuggestion (if suggestGenre provided)
       On failure → cleanup S3 objects
  7. audioExtractionQueue.add('extract', { songId }) → fire-and-forget
  │
  ▼
Response: { success: true, data: SongDto }
  │
  ▼ (async, BullMQ)
AudioExtractionWorker.process({ songId })
  1. Presign 1h S3 URL for plain audio
  2. POST {DSP_URL}/extract { audioUrl }
  3. DSP returns { bpm, camelotKey, energy, duration }
  4. UPDATE song SET bpm, camelotKey, energy, duration
  (song stays PENDING until admin approves)
```

### Flow 6: Admin Dismisses / Takes Down a Report

```
Admin opens Reports page (default: PENDING)
  │
  ▼ Dismiss flow:
PATCH /admin/reports/{id}/dismiss { notes? }
  → report.status = DISMISSED
  → AuditLog('REPORT_DISMISSED', 'REPORT', reportId, notes)

  ▼ Takedown flow:
PATCH /admin/reports/{id}/takedown { notes? }
  → report.status = RESOLVED
  → if targetType === 'SONG':
      song.status = TAKEN_DOWN
      NotificationsService.create(song.userId, SONG_TAKEN_DOWN, { songId, reason: notes })
      emailQueue.add('send-email', songTakenDownEmail → artist)
  → AuditLog('CONTENT_TAKEDOWN', 'SONG'|'USER'|..., targetId, notes)
```

### Flow 7: Genre Suggestion Approved

```
Admin clicks Approve on a pending suggestion
  │
  ▼
PATCH /admin/genres/suggestions/{id}/approve
  │
  ▼
AdminService.approveGenreSuggestion(adminId, suggestionId)
  1. Load suggestion
  2. INSERT Genre { name: suggestion.name }
  3. suggestion.status = APPROVED, reviewedBy = adminId, reviewedAt = now
  4. genreBulkTagQueue.add('bulk-tag-songs', { genreName: suggestion.name, genreId: newGenre.id })
  5. AuditLog(adminId, 'GENRE_APPROVED', 'GENRE_SUGGESTION', suggestionId)
  │
  ▼ (async BullMQ)
GenreBulkTaggingWorker.process({ genreName, genreId })
  → scan all LIVE songs
  → for each song: if title or metadata contains genreName → add genreId to song.genreIds
```

### Flow 8: Sidebar Badge Count Refresh

```
AdminSidebar mounts
  │
  ▼ React Query (staleTime 30s, refetchInterval 60s)
  ├── GET /admin/songs?status=PENDING&size=1  → totalItems → Songs badge
  ├── GET /admin/reports?status=PENDING&size=1 → totalItems → Reports badge
  └── GET /admin/genres/suggestions           → filter PENDING client-side → Genres badge

Each shows yellow number badge if count > 0
```

---

_End of document. Generated from full source scan of `apps/admin` and `apps/api/src/modules`._
