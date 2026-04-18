# Phase 5 — Flow Case Test Document

**Feature:** Browse, Search & Streaming  
**Phase:** 5  
**Author:** BA Skill (generated)  
**Date:** 2026-04-18  
**Status:** Ready for QA

---

## 📌 Product Overview

Phase 5 delivers the public-facing music discovery and playback layer of **My Music**.  
Authenticated users can browse LIVE songs by genre, search across songs/albums/artists,  
stream audio via presigned URLs, manage a personal play queue, and track listening history.  
The persistent PlayerBar enables continuous playback across all routes.

---

## 👥 Target Users

| Segment   | Description |
|-----------|-------------|
| Listener  | Authenticated user who browses, searches, and streams music |
| Artist    | Authenticated user who also consumes music (inherits Listener role) |
| Guest     | Unauthenticated visitor — can browse/search but **cannot** stream |
| Admin     | Can access all features; not the primary audience for Phase 5 |

---

## 🎯 Business Goals

- Allow users to discover LIVE songs without knowing exact titles
- Enable seamless, uninterrupted playback across route navigation
- Give users control over what plays next via a personal queue
- Surface artist discoverability through search
- Track listen counts to power future analytics and recommendations

---

## 🧩 Features In Scope

| ID     | Feature          | Description                                                        | Priority |
|--------|------------------|--------------------------------------------------------------------|----------|
| E2     | Browse / Discover | Grid of LIVE songs with genre filter + pagination                  | High     |
| E3     | Search           | Debounced full-text search across songs, albums, artists           | High     |
| E4     | Genre Browser    | Public grid of all confirmed genres linking to filtered browse     | Medium   |
| F1     | PlayerBar        | Persistent bottom bar with playback controls and progress          | Critical |
| F2     | Play Queue       | Personal queue with smart Camelot ordering and per-item removal    | High     |
| BL-28  | Stream URL       | Presigned 15-min MinIO URL; authenticated only                     | Critical |
| BL-09  | Listen Count     | Increment + daily stats upsert on each unique stream event         | Medium   |
| BL-30  | Play History     | Append-only record per play event                                  | Medium   |
| BL-37C | Smart Order      | Nearest-neighbour Camelot Wheel queue reordering                   | Low–Med  |

---

## 👤 User Stories

### Browsing
- As a **Listener**, I want to browse all LIVE songs in a grid so that I can discover new music without searching.
- As a **Listener**, I want to filter songs by genre so that I can narrow results to my preferred sound.
- As a **Listener**, I want paginated results so that the page doesn't become slow with hundreds of songs.
- As a **Guest**, I want to see the browse grid without logging in so that I can explore before registering.

### Search
- As a **Listener**, I want to search songs by title so that I can find a specific track quickly.
- As a **Listener**, I want search to also return albums and artists so that I can navigate to full discographies.
- As a **Listener**, I want results to appear as I type (debounced) so that I don't need to press Enter.

### Streaming
- As a **Listener**, I want to click a song and have it start playing immediately so that playback feels instant.
- As a **Listener**, I want playback to continue when I navigate to another page so that I'm not interrupted.
- As a **Listener**, I want to seek within a track by clicking the progress bar so that I can skip to any point.
- As a **Listener**, I want OS media session controls (lock screen) so that I can control playback without the browser.
- As a **Guest**, I want to be redirected to login when I try to stream so that access control is enforced.

### Queue
- As a **Listener**, I want to add songs to a personal queue so that I can line up what plays next.
- As a **Listener**, I want to remove individual songs from the queue so that I can change my mind.
- As a **Listener**, I want to trigger Smart Order so that songs transition harmonically by Camelot key.
- As a **Listener**, I want to clear the entire queue in one click so that I can start fresh.

### PlayerBar
- As a **Listener**, I want to see the currently playing song's art, title, and artist in the bar so that I always know what's on.
- As a **Listener**, I want the album art to spin while a track plays so that playback state is visually obvious.
- As a **Listener**, I want a waveBar visualizer in the PlayerBar when playing so that the UI feels alive.
- As a **Listener**, I want to control volume from the PlayerBar so that I don't need system controls.

---

## 🔄 User Flows

### Flow 1 — Browse & Stream a Song

```
1.  User navigates to /browse
2.  System fetches LIVE songs (page 1, limit 24)
3.  System fetches genre list for filter pills
4.  User sees song grid + genre pills
5.  [Optional] User clicks a genre pill
      → System re-fetches songs filtered by genre ID
      → Selected pill is highlighted; grid refreshes
6.  User clicks a SongCard (art area or play overlay)
7.  System calls GET /songs/:id/stream (auth required)
      → If unauthenticated: redirect to /login
      → If authenticated: returns presigned URL (15-min TTL)
8.  Browser Audio element loads presigned URL and begins playback
9.  PlayerBar appears with song info + spinning vinyl art + waveBar
10. System fires POST /playback/history (fire-and-forget)
11. Backend increments listenCount + upserts SongDailyStats
12. User navigates to another page; playback continues uninterrupted
```

---

### Flow 2 — Search

```
1.  User navigates to /browse/search
      (or clicks the search bar on the /browse page)
2.  Input auto-focuses
3.  User types a query (e.g. "midnight")
4.  After 320 ms debounce: GET /search?q=midnight&limit=8
5.  System returns { songs[], albums[], artists[] }
6.  Results render in three labelled sections
      (only sections with ≥ 1 result are shown)
7.  User clicks a song row → playback starts (Flow 1 from step 7)
8.  User clicks an album card → navigates to /albums/:id
9.  User clicks an artist card → navigates to /artists/:id
10. User clears input → results sections disappear; prompt shown
```

---

### Flow 3 — Queue Management

```
1.  User hovers a SongCard on /browse (or a SongRow on /browse/search)
      → "+" button appears
2.  User clicks "+" → POST /queue { songId }
3.  System appends song at max(position) + 1
4.  User navigates to /queue (via sidebar or PlayerBar ListMusic icon)
5.  System calls GET /queue → ordered list renders
6.  [Optional] User clicks "Smart Order"
      → PATCH /queue/smart-order
      → Queue reorders by Camelot key + BPM proximity
      → Toast: "Queue reordered by Camelot key"
7.  User clicks a queue row → playback starts for that song
8.  User clicks ✕ on a row → DELETE /queue/:itemId → row removed
9.  User clicks "Clear all" → DELETE /queue → empty state shown
```

---

### Flow 4 — PlayerBar Interactions

```
1.  Song is playing; PlayerBar is visible at bottom of every page
2.  User clicks Play/Pause (gold button) → toggles audio play/pause
3.  User clicks the progress bar at any point → seeks to that position
4.  User adjusts volume slider → audio.volume updated; Zustand synced
5.  User clicks mute icon (VolumeX) → volume = 0; icon changes
6.  User clicks VolumeX again → volume restored to 0.8
7.  User clicks ListMusic icon → navigates to /queue
8.  OS media session: user presses pause on keyboard / lock screen
      → Browser fires mediaSession 'pause' → same effect as step 2
```

---

### Flow 5 — Genre Browser (Public)

```
1.  Guest or Listener navigates to /genres
2.  System calls GET /genres (public — no auth required)
3.  Genre cards render in a responsive grid
4.  User clicks a genre card
5.  Navigates to /browse?genre=:id
6.  Browse page reads ?genre param → pre-selects that genre pill
      → Filtered song grid loads automatically
```

---

## ⚠️ Edge Cases

### Streaming

| Case | Expected Behaviour |
|------|--------------------|
| Presigned URL expires mid-playback (> 15 min) | Audio `error` event fires → `isPlaying = false`; user must re-click |
| Song deleted while user is playing it | 404 on stream URL fetch → playback does not start |
| Unauthenticated user clicks play | 401 from `/songs/:id/stream` → redirect to /login |
| Network drops during playback | Audio `error` event → `isPlaying = false`; PlayerBar shows paused |
| Stream URL fetch takes > 5 s | Loading state shown on play button; user may navigate away |

### Search

| Case | Expected Behaviour |
|------|--------------------|
| Query returns 0 results across all sections | "Nothing found" empty state; no error toast |
| Query is blank / whitespace only | API call skipped; results cleared; prompt shown |
| Query contains special characters | Passed URL-encoded to `GET /search?q=` |
| New query typed before previous request returns | Debounce cancels old timeout; only latest result shown |
| Network error during search | Loading spinner stops; results cleared; no crash |

### Queue

| Case | Expected Behaviour |
|------|--------------------|
| Same song added twice | Backend appends twice at next positions (duplicates allowed) |
| Smart Order with < 2 songs | Button is disabled; no API call made |
| Remove item that no longer exists server-side | 404 from API; queue refresh still triggered |
| Clear queue while a song is playing | Queue cleared; PlayerBar keeps current song playing |
| Queue fetch fails on /queue page load | Empty state shown (graceful fallback) |

### PlayerBar

| Case | Expected Behaviour |
|------|--------------------|
| No song loaded | Footer shows: "Browse songs to start listening" |
| Song with no cover art | Spinning vinyl-disc fallback (CSS radial-gradient) shown |
| Song duration = 0 or null | Progress bar at 0%; time displays `0:00` |
| Two browser tabs open | Each tab has its own Audio singleton; playback is independent |

### Browse

| Case | Expected Behaviour |
|------|--------------------|
| No LIVE songs exist | Empty state with descriptive message |
| Genre filter returns 0 songs | Empty state (not a generic error) |
| Genre filter API fails | Filter row hidden; browse still works without filter |
| Page beyond total pages | Backend returns last valid page; frontend paginates correctly |

---

## ✅ Acceptance Criteria

### AC-E2 — Browse Page

**Scenario 1: Initial load**
> **Given** any user (guest or authenticated) navigates to `/browse`  
> **When** the page loads  
> **Then** up to 24 LIVE songs are displayed in a responsive grid, genre filter pills are visible, and the search bar navigates to `/browse/search`

**Scenario 2: Genre filter**
> **Given** the user is on `/browse`  
> **When** they click a genre pill  
> **Then** the grid reloads showing only songs tagged with that genre and the selected pill is visually highlighted (gold border + background)

**Scenario 3: Pagination — next page**
> **Given** more than 24 LIVE songs exist  
> **When** the user clicks "Next"  
> **Then** the next 24 songs load, the page counter increments, and the viewport scrolls to top

**Scenario 4: Pagination — boundary**
> **Given** the user is on the last page  
> **When** they look at the "Next" button  
> **Then** the button is disabled (opacity 0.4, `cursor: not-allowed`)

---

### AC-E3 — Search

**Scenario 1: Live search with results**
> **Given** the user is on `/browse/search`  
> **When** they type at least 1 non-blank character  
> **Then** within 400 ms, result sections for Songs, Albums, and/or Artists appear (empty sections are hidden)

**Scenario 2: Empty input**
> **Given** the user clears the search input  
> **When** the input becomes empty  
> **Then** all result sections disappear and the "Start typing to search" prompt is shown

**Scenario 3: Click song result → playback**
> **Given** search results are visible  
> **When** the user clicks a song row  
> **Then** playback starts and PlayerBar updates with the song's title, artist name, and cover art

**Scenario 4: Click album result → navigation**
> **Given** search results include albums  
> **When** the user clicks an album card  
> **Then** the user is navigated to `/albums/:id` without triggering playback

**Scenario 5: Zero results**
> **Given** the user types a query that matches nothing  
> **When** the API returns empty arrays  
> **Then** a "Nothing found" message is shown; no error state

---

### AC-F1 — PlayerBar

**Scenario 1: Now playing visual state**
> **Given** a song is playing  
> **When** the user views the PlayerBar  
> **Then** album art is visible and has the `vinyl-spin vinyl-glow` CSS classes, song title + artist name are displayed, and the gold progress bar advances in real time

**Scenario 2: Play/Pause toggle**
> **Given** a song is playing  
> **When** the user clicks the gold Play/Pause button  
> **Then** `audio.pause()` is called, spinning stops, and the button switches to the Play icon

**Scenario 3: Seek via progress bar**
> **Given** a song is playing with duration > 0  
> **When** the user clicks at the 50% position on the progress bar  
> **Then** `audio.currentTime` is set to 50% of the song's duration and playback continues from that position

**Scenario 4: Volume mute / restore**
> **Given** volume is at 80%  
> **When** the user clicks the mute icon  
> **Then** volume is set to 0 and VolumeX icon is shown; clicking again restores volume to 0.8

**Scenario 5: Empty state**
> **Given** no song has been loaded  
> **When** the user views the PlayerBar  
> **Then** the bar shows "Browse songs to start listening" with no playback controls visible

---

### AC-F2 — Queue

**Scenario 1: Add to queue**
> **Given** the user hovers a SongCard on the Browse page  
> **When** they click the "+" icon  
> **Then** `POST /queue` is called and the song appears at the bottom of `/queue`

**Scenario 2: Smart Order**
> **Given** the queue has ≥ 2 songs with Camelot keys assigned  
> **When** the user clicks "Smart Order"  
> **Then** `PATCH /queue/smart-order` is called, the queue reorders by harmonic compatibility, and a toast "Queue reordered by Camelot key" appears for 2.5 seconds

**Scenario 3: Smart Order disabled**
> **Given** the queue has fewer than 2 songs  
> **When** the user views the queue  
> **Then** the "Smart Order" button is visually disabled (`opacity: 0.5`, `cursor: not-allowed`) and no API call is made on click

**Scenario 4: Remove item**
> **Given** the queue has at least one item  
> **When** the user clicks ✕ on a row  
> **Then** `DELETE /queue/:itemId` is called, the row is removed, and the queue refreshes from server

**Scenario 5: Clear queue**
> **Given** the queue has items  
> **When** the user clicks "Clear all"  
> **Then** `DELETE /queue` is called, all items are removed, and the empty state is displayed

**Scenario 6: Play item from queue**
> **Given** the queue list is visible  
> **When** the user clicks a queue row  
> **Then** playback starts for that song and the PlayerBar updates

---

### AC-BL-28 — Stream URL

**Scenario 1: Authenticated stream**
> **Given** an authenticated user clicks Play on a LIVE song  
> **When** `GET /songs/:id/stream` is called  
> **Then** a presigned URL with 15-minute TTL is returned and audio begins immediately

**Scenario 2: Unauthenticated stream attempt**
> **Given** an unauthenticated visitor  
> **When** they attempt to play any song  
> **Then** the API returns HTTP 401 and the user is redirected to `/login`

---

### AC-BL-30 — Play History

**Scenario 1: History recorded on play**
> **Given** an authenticated user starts playing a song  
> **When** playback begins  
> **Then** `POST /playback/history` is fired with `{ songId }` and a `PlayHistory` row is inserted in the database

**Scenario 2: Fire-and-forget — failure does not block playback**
> **Given** `POST /playback/history` fails due to a network error  
> **When** the error occurs  
> **Then** playback is **not** interrupted; the error is silently swallowed

---

### AC-E4 — Genres Page

**Scenario 1: Public access**
> **Given** an unauthenticated visitor navigates to `/genres`  
> **When** the page loads  
> **Then** all confirmed genres are displayed as cards (no login required)

**Scenario 2: Genre card click**
> **Given** the user clicks a genre card  
> **When** navigation occurs  
> **Then** the user lands on `/browse?genre=:id` with that genre pre-selected in the filter row

---

### AC-BL-09 — Listen Count

**Scenario 1: Count incremented on stream**
> **Given** an authenticated user streams a LIVE song  
> **When** `findById` is called internally on the LIVE song by a non-owner  
> **Then** `listenCount` is incremented by 1 and a `SongDailyStats` row is upserted for today's date

**Scenario 2: Owner does not increment own count**
> **Given** the song owner views their own song  
> **When** `GET /songs/:id` is called  
> **Then** `listenCount` is **not** incremented (owner excluded from count logic)

---

## 🗂️ Test File Map

| Flow / AC | Test File | Type |
|-----------|-----------|------|
| AC-E2, AC-E3, AC-F1, AC-F2 | `tests/phase5/e2e/phase5.spec.ts` | E2E (Playwright) |
| AC-BL-28, AC-BL-09, AC-BL-30, AC-E3 | `tests/phase5/api/browse-stream.spec.ts` | API (Jest/Supertest) |
| AC-E4 | `tests/phase5/e2e/phase5.spec.ts` | E2E (Playwright) |
| AC-BL-37C (Smart Order) | `tests/phase5/api/browse-stream.spec.ts` | API (Jest/Supertest) |
