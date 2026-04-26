# My Music — UI Test Case Tracker

**App URL**: `http://localhost:3000`  
**Last updated**: 2026-04-26  
**Total cases**: ~150  
**Legend**: ✅ Pass · ❌ Fail · 🔲 Not tested · ⏭ Skipped

---

## Priority Order for Bug Hunting
X (cross-cutting) → A (auth) → F (playback) → D (song management) → E (browse) → J (drops/notifications) → K (admin) → G/H/I/N (playlists/payments/downloads/albums)

---

## Area A — Authentication

### A1 · User Registration (`/register`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| A1-1 | Submit form with all valid fields (name, email, password, confirm) | Redirects to `/verify-email`; verification email sent | 🔲 | |
| A1-2 | Submit with mismatched passwords | Inline validation error shown, no submit | 🔲 | |
| A1-3 | Submit with already-registered email | Error: "Email already in use" | 🔲 | |
| A1-4 | Submit with weak password (< 8 chars) | Validation error before submit | 🔲 | |
| A1-5 | Already logged-in user visits `/register` | Redirected to browse/home | 🔲 | |

### A2 · Artist Registration (`/register?role=artist`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| A2-1 | Submit with all fields (name, email, stageName, bio, ≥ 1 genre) | Account created, redirected to verify-email | 🔲 | |
| A2-2 | Submit without stageName | Validation error | 🔲 | |
| A2-3 | Submit without selecting any genre | Validation error | 🔲 | |

### A3 · Email Verification (`/verify-email`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| A3-1 | Enter correct 6-digit OTP | Email verified; restricted features unlocked | 🔲 | |
| A3-2 | Enter wrong OTP | Error message shown | 🔲 | |
| A3-3 | Enter expired OTP | Error: "Code expired" | 🔲 | |
| A3-4 | Click "Resend code" | New code sent; old code invalidated | 🔲 | |
| A3-5 | Unverified user tries to access `/browse` | Redirected to `/verify-email` | 🔲 | |

### A4 · Login (`/login`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| A4-1 | Valid credentials → USER account | Redirected to `/browse` | 🔲 | |
| A4-2 | Valid credentials → ARTIST account | Redirected to artist home | 🔲 | |
| A4-3 | Valid credentials → ADMIN account | Redirected to `/admin` | 🔲 | |
| A4-4 | Wrong password 5× in a row | Account locked 15 min; alert email sent | 🔲 | |
| A4-5 | Wrong email | Error: "Invalid credentials" (no email enumeration) | 🔲 | |
| A4-6 | Locked account login attempt | Error: "Account temporarily locked" | 🔲 | |
| A4-7 | Already logged-in user visits `/login` | Redirected away | 🔲 | |

### A5–A7 · Forgot / Reset Password

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| A5-1 | Submit valid email on `/forgot-password` | Success message shown; OTP email sent | 🔲 | |
| A5-2 | Submit non-existent email | Same success message (no enumeration) | 🔲 | |
| A6-1 | Enter correct OTP on `/verify-reset` | Redirected to `/reset-password` | 🔲 | |
| A6-2 | Enter wrong/expired OTP | Error message | 🔲 | |
| A7-1 | Set new password with valid reset JWT | Password updated; redirected to login | 🔲 | |
| A7-2 | Mismatched new passwords | Validation error | 🔲 | |
| A7-3 | Access `/reset-password` without valid reset token | Redirected to `/forgot-password` | 🔲 | |

### A8 · Genre Onboarding (`/onboarding`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| A8-1 | Shown automatically after first login (`onboardingCompleted=false`) | Full-screen overlay (z-200) appears, bypasses app shell | 🔲 | |
| A8-2 | Select 1–10 genre chips and click Submit | Genres saved; redirect to `/browse` | 🔲 | |
| A8-3 | Try to select 11th genre | 11th chip stays unselectable (disabled) | 🔲 | |
| A8-4 | Click "Skip for now" | Skipped; redirect to `/browse` | 🔲 | |
| A8-5 | Submit with 0 genres selected | Validation error (min 1) | 🔲 | |

---

## Area B — Account & Settings

### B1 · My Profile (`/profile`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| B1-1 | View profile page | Name, avatar, follower/following counts shown | 🔲 | |
| B1-2 | Click "Logout" | JWT invalidated; session deleted; queue cleared; redirected to login | 🔲 | |
| B1-3 | ARTIST sees link to "My Artist Profile" | Link present and navigates to `/artist/profile` | 🔲 | |

### B2 · Edit Profile (`/profile/edit`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| B2-1 | Update display name and save | Name updated on profile | 🔲 | |
| B2-2 | Submit empty name | Validation error | 🔲 | |
| B2-3 | Upload new avatar image | Avatar updated and preview shown | 🔲 | |

### B3 · Change Password (`/profile/password`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| B3-1 | Enter correct current password + valid new password | Success toast; password changed | 🔲 | |
| B3-2 | Enter wrong current password | Error message | 🔲 | |
| B3-3 | New password ≠ confirm | Validation error | 🔲 | |

### B4 · Active Sessions (`/profile/sessions`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| B4-1 | Page loads list of active sessions | Device name, IP, last seen, login date shown | 🔲 | |
| B4-2 | Revoke a specific session | Session removed from list; that device logged out | 🔲 | |

### B5 · Premium Status (`/profile/premium`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| B5-1 | PREMIUM USER views page | Plan tier, expiry date, downloads used/quota shown | 🔲 | |
| B5-2 | ADMIN views page | Shows "Unlimited" downloads | 🔲 | |
| B5-3 | Click "Renew" button | Navigates to `/payment` | 🔲 | |
| B5-4 | Non-premium USER views page | Upgrade prompt shown | 🔲 | |

---

## Area C — Artist Profile

### C1 · Public Artist Profile (`/artists/[id]`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| C1-1 | Visit as unauthenticated user | Page loads; stageName, bio, avatarUrl, followerCount visible | 🔲 | |
| C1-2 | Only LIVE songs shown in song list | No PENDING/REJECTED/TAKEN_DOWN songs | 🔲 | |
| C1-3 | `listenerCount` increments on each page visit | Counter increments on reload (BL-11) | 🔲 | |
| C1-4 | Authenticated user clicks "Follow" | FollowerCount increments; button changes to "Unfollow" | 🔲 | |
| C1-5 | Artist tries to follow their own profile | Self-follow button absent or disabled | 🔲 | |
| C1-6 | Click "Unfollow" | FollowerCount decrements; button reverts | 🔲 | |
| C1-7 | Report button triggers report modal | Opens E5 report modal | 🔲 | |

### C2 · My Artist Profile (`/artist/profile`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| C2-1 | ARTIST sees Edit button | Edit button present | 🔲 | |
| C2-2 | Links to My Songs and Analytics visible | Both links work | 🔲 | |
| C2-3 | Pending genre suggestions shown with review status | List with status (pending/approved/rejected) | 🔲 | |

### C3 · Edit Artist Profile (`/artist/edit`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| C3-1 | Update stageName, bio, avatar | All fields saved; success toast | 🔲 | |
| C3-2 | Clear stageName and save | Validation error (non-empty required) | 🔲 | |
| C3-3 | Add/remove social links | Saved correctly | 🔲 | |

---

## Area D — Song Management

### D1 · Upload Song (`/artist/upload`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| D1-1 | Upload valid audio file (MP3/FLAC/WAV, < 20 min) | Upload succeeds; jobId returned; extraction polling starts | 🔲 | |
| D1-2 | Upload file with invalid extension (e.g. `.txt`) | Error: unsupported file type | 🔲 | |
| D1-3 | Upload audio > 20 min duration | Error: max duration exceeded | 🔲 | |
| D1-4 | DSP extraction success | BPM + Key auto-filled; fields unlocked | 🔲 | |
| D1-5 | DSP extraction failure/timeout | "Auto-extraction failed"; fields unlocked for manual entry | 🔲 | |
| D1-6 | Set optional `dropAt` (min 1h from now) | Accepted; song enters SCHEDULED status after approval | 🔲 | |
| D1-7 | Set `dropAt` < 1h from now | Validation error | 🔲 | |
| D1-8 | Set `dropAt` > 90 days from now | Validation error | 🔲 | |
| D1-9 | Non-ARTIST user visits `/artist/upload` | Redirected or 403 | 🔲 | |
| D1-10 | Song created with status PENDING | Confirmed in My Songs list | 🔲 | |

### D2 · My Songs (`/artist/songs`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| D2-1 | Songs grouped by status | PENDING, LIVE, REJECTED, etc. groups visible | 🔲 | |
| D2-2 | PENDING song — only "view" action available | No edit/delete buttons | 🔲 | |
| D2-3 | LIVE song — edit and delete actions present | Both actions work | 🔲 | |
| D2-4 | REUPLOAD_REQUIRED — shows reason + resubmit button | Reason visible; resubmit navigates correctly | 🔲 | |
| D2-5 | SCHEDULED song — cancel/reschedule options | Both modals open correctly | 🔲 | |
| D2-6 | REJECTED song — shows reason only, no resubmit | No resubmit option visible | 🔲 | |
| D2-7 | ADMIN views all artists' songs | Full list, all statuses | 🔲 | |

### D3 · Song Analytics (`/artist/analytics`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| D3-1 | Page loads with all chart sections | All-time plays, 30-day plays, top 5 songs, like counts, follower count shown | 🔲 | |
| D3-2 | Play a song for ≥ 30 s then check analytics | Play count increments | 🔲 | |
| D3-3 | Play a song for < 30 s | Play count does NOT increment | 🔲 | |

### D3a · Edit Song Metadata (`/artist/songs/[id]/edit`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| D3a-1 | Edit title, cover art, genres on LIVE song | Saved; success toast | 🔲 | |
| D3a-2 | Try to replace audio on LIVE song | Option absent or blocked | 🔲 | |
| D3a-3 | Another artist tries to edit someone else's song | 403 forbidden | 🔲 | |

### D4 · Resubmit Song (`/artist/songs/[id]/resubmit`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| D4-1 | View admin reupload reason notes | Notes clearly displayed | 🔲 | |
| D4-2 | Replace audio file + update metadata, submit | Song → PENDING; extraction polling restarts | 🔲 | |
| D4-3 | Submit without replacing audio (metadata only) | Allowed | 🔲 | |

### D5 · Song Approval Queue (`/admin/songs`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| D5-1 | ADMIN views all PENDING songs | List loads | 🔲 | |
| D5-2 | Approve a song (no dropAt) | Song → LIVE; artist notified | 🔲 | |
| D5-3 | Approve a song (with future dropAt) | Song → SCHEDULED | 🔲 | |
| D5-4 | Reject song with reason | Song → REJECTED; artist gets email + in-app notification | 🔲 | |
| D5-5 | Reject without providing reason | Form blocked (reason required) | 🔲 | |
| D5-6 | Request reupload with notes | Song → REUPLOAD_REQUIRED; notes sent to artist | 🔲 | |
| D5-7 | Approve a genre suggestion | Genre created; bulk-tagging job enqueued | 🔲 | |
| D5-8 | Non-ADMIN visits `/admin/songs` | 403 / redirect | 🔲 | |

---

## Area E — Browse & Discovery

### E1 · Home / Landing (`/` or `/browse`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| E1-1 | Unauthenticated visit | Marketing/landing content shown; SCHEDULED song teasers in carousel | 🔲 | |
| E1-2 | Authenticated + verified visit | Personalized recommendations section visible | 🔲 | |
| E1-3 | Trending songs sorted by `total_plays DESC` | Most-played songs appear first | 🔲 | |
| E1-4 | SCHEDULED song teaser links to `/songs/[id]/teaser` | Correct teaser page opens | 🔲 | |

### E2 · Browse / Discover (`/browse`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| E2-1 | All songs shown are LIVE only | No PENDING/REJECTED/TAKEN_DOWN songs | 🔲 | |
| E2-2 | Filter by genre | Results filtered correctly | 🔲 | |
| E2-3 | Sort by `totalPlays` | Results sorted descending | 🔲 | |
| E2-4 | Sort by `createdAt` | Newest first | 🔲 | |
| E2-5 | Sort by `likeCount` | Most liked first | 🔲 | |
| E2-6 | Like a song | Like count increments; button toggles | 🔲 | |
| E2-7 | Unlike a song | Like count decrements | 🔲 | |
| E2-8 | PREMIUM user sees download option | Download button visible | 🔲 | |
| E2-9 | Non-PREMIUM user download attempt | Upgrade modal shown | 🔲 | |
| E2-10 | Report song via context menu | Report modal opens | 🔲 | |
| E2-11 | Unverified user visits `/browse` | Redirected to verify-email | 🔲 | |

### E3 · Search (`/browse/search`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| E3-1 | Search song by name | LIVE songs matching query returned | 🔲 | |
| E3-2 | Search artist by name | Matching artists returned | 🔲 | |
| E3-3 | Search album by name | Matching albums returned | 🔲 | |
| E3-4 | Search playlist by name | Matching playlists returned | 🔲 | |
| E3-5 | Filter with `name~Rock` operator | Returns items with "Rock" in name | 🔲 | |
| E3-6 | Filter with `totalPlays>1000` operator | Only songs with >1000 plays returned | 🔲 | |
| E3-7 | SCHEDULED/PENDING songs absent from search | Not shown in results | 🔲 | |

### E4 · Genre Browsing (`/genres`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| E4-1 | Page lists all confirmed (non-deleted) genres | All genres shown | 🔲 | |
| E4-2 | Click a genre → filtered browse results | E2/E3 filtered by that genre | 🔲 | |

### E5 · Report Content (inline modal)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| E5-1 | Report a song from browse page | Modal opens; type selector + optional notes; submit creates report | 🔲 | |
| E5-2 | Report an artist from their profile | Same modal, `targetType=ARTIST` | 🔲 | |
| E5-3 | Report a playlist | Same modal, `targetType=PLAYLIST` | 🔲 | |
| E5-4 | Submit without selecting report type | Validation error | 🔲 | |

---

## Area F — Playback

### F1 · Player Bar (persistent shell)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| F1-1 | Click play on a song | Song loads in PlayerBar; playback starts | 🔲 | |
| F1-2 | Play/Pause toggle | Playback stops/resumes correctly | 🔲 | |
| F1-3 | Seek bar — drag to new position | Playback jumps to that position | 🔲 | |
| F1-4 | Next track button | Next song in queue plays | 🔲 | |
| F1-5 | Previous track button | Previous song in queue plays | 🔲 | |
| F1-6 | Volume control | Volume changes | 🔲 | |
| F1-7 | Like song from player | Like toggled; count updates | 🔲 | |
| F1-8 | PREMIUM user — 320 kbps quality | Higher quality stream served | 🔲 | |
| F1-9 | Non-PREMIUM user — 128 kbps quality | Standard quality stream served | 🔲 | |
| F1-10 | Attempt to stream a SCHEDULED song | HTTP 423 Locked returned; error shown | 🔲 | |
| F1-11 | Smart Order toggle ON | Queue reordered by BPM/Key/Energy; icon highlighted | 🔲 | |
| F1-12 | Smart Order toggle OFF | Queue reverts to original order; icon muted | 🔲 | |
| F1-13 | Reload app mid-session | `GET /playback/state` restores last position | 🔲 | |
| F1-14 | Play event fires at ≥ 30 s | `POST /songs/:id/play` called; play count increments | 🔲 | |
| F1-15 | Play event does NOT fire at < 30 s | Play count unchanged | 🔲 | |

---

## Area G — Playlists & Social

### Playlists

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| G-1 | Create playlist (`/playlists/create`) | Playlist created; navigates to playlist detail | 🔲 | |
| G-2 | View playlist detail (`/playlists/[id]`) | Tracklist, cover, title shown | 🔲 | |
| G-3 | Edit playlist (`/playlists/[id]/edit`) | Name, description, cover updated | 🔲 | |
| G-4 | Delete playlist | Playlist removed from list | 🔲 | |
| G-5 | Add song to playlist via context menu | Song appears in tracklist | 🔲 | |
| G-6 | Remove song from playlist | Song removed from tracklist | 🔲 | |
| G-7 | Save another user's public playlist | Appears in `/playlists/saved` | 🔲 | |
| G-8 | Unsave a saved playlist | Removed from saved list | 🔲 | |
| G-9 | Liked songs page (`/playlists/liked`) | All liked songs shown | 🔲 | |
| G-10 | Drag to reorder songs in playlist | New order persisted on save | 🔲 | |
| G-11 | Mood playlist (`/playlists/mood`) | Mood selector shown; songs filtered by mood | 🔲 | |

### Social Feed (`/feed`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| G-F1 | View feed | Activity from followed users/artists shown | 🔲 | |
| G-F2 | Follow a user | Their activity appears in feed | 🔲 | |
| G-F3 | Unfollow a user | Their activity removed from feed | 🔲 | |
| G-F4 | View another user's profile (`/users/[id]`) | Name, avatar, follow button shown | 🔲 | |

---

## Area H — Payments & Premium

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| H-1 | Visit `/payment` | Plan cards shown with price/features | 🔲 | |
| H-2 | Select VNPay gateway + submit | Redirected to VNPay payment page | 🔲 | |
| H-3 | Select MoMo gateway + submit | Redirected to MoMo payment page | 🔲 | |
| H-4 | Successful VNPay return (`/payment/vnpay`) | Success card shown; PREMIUM activated | 🔲 | |
| H-5 | Failed payment return | Failure card shown with clear error | 🔲 | |
| H-6 | PREMIUM activated → premium features unlocked | Downloads, 320kbps, quota all accessible | 🔲 | |
| H-7 | PREMIUM expiry (simulated) | PREMIUM role removed; features re-locked on next session | 🔲 | |

---

## Area I — Downloads (Premium)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| I-1 | PREMIUM USER downloads a song | DownloadModal opens; song downloaded successfully | 🔲 | |
| I-2 | Download quota shown in modal | Used / max quota displayed correctly | 🔲 | |
| I-3 | USER+PREMIUM exceeds 100 song quota | Error: quota exceeded | 🔲 | |
| I-4 | ARTIST+PREMIUM — quota = 200 | Higher quota applied | 🔲 | |
| I-5 | ADMIN downloads — no quota limit | Unlimited downloads succeed | 🔲 | |
| I-6 | View downloads list (`/downloads`) | All downloaded songs shown with expiry dates | 🔲 | |
| I-7 | Re-download from downloads page | Download starts again | 🔲 | |

---

## Area J — Drops & Notifications (Phase 8)

### Drops

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| J-1 | Drop teaser page (`/songs/[id]/teaser`) | Cover art, countdown timer, "Notify Me" CTA shown; accessible without login | 🔲 | |
| J-2 | Countdown timer counts down live | D/H/M/S cells update every second | 🔲 | |
| J-3 | "Notify Me" button (unauthenticated) | Prompt to log in | 🔲 | |
| J-4 | "Notify Me" button (authenticated) | Subscription saved; button changes to "Unsubscribe" | 🔲 | |
| J-5 | Artist drops dashboard (`/artist/drops`) | List of scheduled drops with countdown shown | 🔲 | |
| J-6 | Cancel drop modal | Confirmation dialog; cancel removes dropAt; song → APPROVED | 🔲 | |
| J-7 | Reschedule drop modal | datetime-local input; min = now+1h; success saves new date | 🔲 | |
| J-8 | Second reschedule attempt | Warning banner shown ("final reschedule") | 🔲 | |
| J-9 | Reschedule → `requiresReApproval=true` response | Song returns to PENDING review; artist notified | 🔲 | |

### Notifications

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| J-N1 | NotificationBell shows unread badge count | Badge count matches unread notifications | 🔲 | |
| J-N2 | Badge auto-updates every 30s | Count refreshes without page reload | 🔲 | |
| J-N3 | Click bell → dropdown shows last 10 notifications | List loads correctly | 🔲 | |
| J-N4 | Click a notification → marks as read | Badge count decrements | 🔲 | |
| J-N5 | "Mark all read" button | All marked read; badge clears | 🔲 | |
| J-N6 | "View all notifications" → `/notifications` | Full paginated inbox opens | 🔲 | |
| J-N7 | Artist receives SONG_REJECTED notification | In-app notification + email both delivered | 🔲 | |
| J-N8 | Artist receives SONG_REUPLOAD_REQUIRED notification | In-app notification + email both delivered | 🔲 | |

---

## Area K — Admin Panel

### K1 · Dashboard (`/admin`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| K1-1 | Admin dashboard loads | Overview stats shown | 🔲 | |
| K1-2 | Non-ADMIN visits `/admin` | 403 / redirect to home | 🔲 | |

### K2 · User Management (`/admin/users`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| K2-1 | List all users | Paginated user list shown | 🔲 | |
| K2-2 | Grant PREMIUM to user manually (BL-74) | PREMIUM role added; expiry date set | 🔲 | |
| K2-3 | Change user role | Role updated; reflected immediately | 🔲 | |
| K2-4 | ADMIN restores a TAKEN_DOWN song | Song → LIVE | 🔲 | |

### K3 · Genre Management (`/admin/genres`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| K3-1 | List all genres | All confirmed genres shown | 🔲 | |
| K3-2 | Create new genre | Genre added to list | 🔲 | |
| K3-3 | Soft-delete a genre | Genre removed from public `/genres` page | 🔲 | |

### K4 · Payment Records (`/admin/payments`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| K4-1 | List all payment records | VNPay + MoMo transactions shown | 🔲 | |

### K5 · Audit Log (`/admin/audit`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| K5-1 | Audit log shows admin actions | Approve/reject/takedown events with timestamp + actor | 🔲 | |
| K5-2 | Log is immutable | No edit/delete options shown | 🔲 | |

### K6 · Reports (`/admin/reports`)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| K6-1 | List all content reports | SONG/ARTIST/PLAYLIST reports shown | 🔲 | |
| K6-2 | Resolve a report | Status updated; removed from active queue | 🔲 | |

---

## Area L — Layout & Shell

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| L-1 | Sidebar shows correct links per role | Artist/Admin links visible only for those roles | 🔲 | |
| L-2 | PlayerBar always visible on `(app)` routes | Persists across all authenticated pages | 🔲 | |
| L-3 | TopBar avatar dropdown — correct options per role | Home, Profile, Artist Studio (ARTIST only), Admin Panel (ADMIN only), Change Password, Sign out | 🔲 | |
| L-4 | Language switcher EN → VI | UI switches; locale prefix in URL updates | 🔲 | |
| L-5 | Navigate back/forward via TopBar arrows | Browser history respected | 🔲 | |
| L-6 | Unauthenticated access to any `(app)` route | Redirected to `/login` | 🔲 | |
| L-7 | Content not hidden behind PlayerBar | `pb-24` clearance working; last item visible | 🔲 | |
| L-8 | PremiumBadge shown next to premium users | Gold badge visible on eligible users | 🔲 | |

---

## Area M — Albums

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| N-1 | Create album (`/albums/create`) | Album created; navigates to album detail | 🔲 | |
| N-2 | View album detail (`/albums/[id]`) | Tracklist shown | 🔲 | |
| N-3 | Edit album (`/albums/[id]/edit`) | Metadata updated | 🔲 | |
| N-4 | Delete album | Album removed from list | 🔲 | |
| N-5 | Add song to album during upload | Song appears in album tracklist | 🔲 | |
| N-6 | Artist albums list (`/artist/albums`) | All own albums listed | 🔲 | |

---

## Area M — Recommendations (Phase 10)

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| M-1 | Personalized recommendations on Home | Recommendations section visible for verified users | 🔲 | |
| M-2 | Mood playlist (`/playlists/mood`) | Mood selector works; songs filtered accordingly | 🔲 | |
| M-3 | Onboarding genres influence recommendations | Genres selected at A8 reflected in recs | 🔲 | |

---

## Area X — Critical Cross-Cutting Tests

| # | Test Case | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| X-1 | Access token expiry (15 min) — continue using app | Silent refresh fires; no visible logout or error | 🔲 | |
| X-2 | Refresh token expiry (30 days) | Redirected to login | 🔲 | |
| X-3 | API returns 401 | Interceptor retries with refresh; if refresh fails → logout | 🔲 | |
| X-4 | 5 failed logins trigger brute-force lock | Account locked 15 min + email alert | 🔲 | |
| X-5 | Ownership guard: artist accesses another artist's song edit | 403 error shown | 🔲 | |
| X-6 | SCHEDULED song audio stream attempt | HTTP 423 returned; error displayed (no exceptions, even ADMIN) | 🔲 | |
| X-7 | ADMIN bypasses download quota | Downloads succeed regardless of count | 🔲 | |
| X-8 | Email not verified → all restricted features blocked | Consistent redirect to verify-email across all protected pages | 🔲 | |
| X-9 | Switch locale to Vietnamese, navigate all main routes | All strings in Vietnamese; no missing translation keys | 🔲 | |
| X-10 | `isPremium()` returns true for ADMIN regardless of tier | Admin has access to all premium features | 🔲 | |

---

## Bug Log

Use this section to record bugs found during testing.

| # | Test Case ID | Description | Severity | Status |
|---|-------------|-------------|----------|--------|
| BUG-01 | | | | |
| BUG-02 | | | | |

**Severity**: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low
