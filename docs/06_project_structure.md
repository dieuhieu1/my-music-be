# Project Folder Structure
**Music Streaming App · Monorepo**

---

## Monorepo Root

```
my-music/
  apps/
    api/               ← NestJS backend
    web/               ← Next.js frontend
    dsp/               ← Python DSP sidecar
  packages/
    types/             ← Shared TypeScript DTOs / enums (used by both api + web)
  docker-compose.yml
  package.json         ← npm workspaces config
  .env.example
```

---

## Backend — `apps/api/`

```
apps/api/
  src/
    modules/
      auth/
        auth.module.ts
        auth.controller.ts
        auth.service.ts
        strategies/
          jwt.strategy.ts
          jwt-refresh.strategy.ts
        dto/
          login.dto.ts
          register-user.dto.ts
          register-artist.dto.ts
          refresh-token.dto.ts
          forgot-password.dto.ts
          reset-password.dto.ts
          verify-email.dto.ts
        entities/
          session.entity.ts
          password-reset.entity.ts

      users/
        users.module.ts
        users.controller.ts
        users.service.ts
        dto/
          update-profile.dto.ts
          change-password.dto.ts
          onboarding.dto.ts
          update-genres.dto.ts
        entities/
          user.entity.ts
          user-genre-preference.entity.ts
        ← POST /users/me/avatar handled directly in users.controller.ts (multer interceptor)

      artist-profile/
        artist-profile.module.ts
        artist-profile.controller.ts
        artist-profile.service.ts
        dto/
          update-artist-profile.dto.ts
        entities/
          artist-profile.entity.ts
        ← POST /artists/me/avatar handled directly in artist-profile.controller.ts (multer interceptor)

      songs/
        songs.module.ts
        songs.controller.ts
        songs.service.ts
        dto/
          upload-song.dto.ts
          update-song-metadata.dto.ts
          play-event.dto.ts
          approve-song.dto.ts
        entities/
          song.entity.ts            ← includes dropJob24hId, dropJob1hId (BullMQ job IDs for BL-64/BL-65 cancellation)
          song-encryption-key.entity.ts

      albums/
        albums.module.ts
        albums.controller.ts
        albums.service.ts
        dto/
          create-album.dto.ts
          update-album.dto.ts
        entities/
          album.entity.ts
          album-song.entity.ts

      playlists/
        playlists.module.ts
        playlists.controller.ts
        playlists.service.ts
        dto/
          create-playlist.dto.ts
          update-playlist.dto.ts
          add-song.dto.ts
        entities/
          playlist.entity.ts
          playlist-song.entity.ts
          saved-playlist.entity.ts
          liked-song.entity.ts

      playback/
        playback.module.ts
        playback.controller.ts
        playback.service.ts
        dto/
          reorder-queue.dto.ts
        entities/
          queue-item.entity.ts
          play-history.entity.ts

      genres/
        genres.module.ts
        genres.controller.ts
        genres.service.ts
        dto/
          suggest-genre.dto.ts
          approve-genre-suggestion.dto.ts
        entities/
          genre.entity.ts
          genre-suggestion.entity.ts

      recommendations/
        recommendations.module.ts
        recommendations.controller.ts
        recommendations.service.ts
        entities/
          recommendation-cache.entity.ts

      notifications/
        notifications.module.ts
        notifications.controller.ts
        notifications.service.ts
        entities/
          notification.entity.ts

      feed/
        feed.module.ts
        feed.controller.ts
        feed.service.ts
        entities/
          feed-event.entity.ts
          follow.entity.ts

      drops/
        drops.module.ts
        drops.controller.ts
        drops.service.ts
        dto/
          schedule-drop.dto.ts
          reschedule-drop.dto.ts
        entities/
          (uses song.entity.ts — drop fields are on Song)

      downloads/
        downloads.module.ts
        downloads.controller.ts
        downloads.service.ts
        entities/
          download-record.entity.ts

      payments/
        payments.module.ts
        payments.controller.ts
        payments.service.ts
        entities/
          payment-record.entity.ts

      reports/
        reports.module.ts
        reports.controller.ts
        reports.service.ts
        dto/
          create-report.dto.ts
          resolve-report.dto.ts
        entities/
          report.entity.ts

      analytics/
        analytics.module.ts
        analytics.controller.ts
        analytics.service.ts

      admin/
        admin.module.ts
        admin.controller.ts
        admin.service.ts

      audit/
        audit.module.ts
        audit.service.ts
        entities/
          audit-log.entity.ts

      mail/
        mail.module.ts
        mail.service.ts
        templates/
          verify-email.hbs
          password-reset.hbs
          premium-activated.hbs
          upcoming-drop.hbs
          drop-cancelled.hbs
          song-approved.hbs
          song-rejected.hbs
          song-reupload-required.hbs    ← BL-84
          song-restored.hbs             ← BL-83
          premium-revoked.hbs           ← BL-75
          account-locked.hbs            ← BL-43
          drop-rescheduled.hbs          ← BL-65

      ai/
        ai.module.ts
        ai.controller.ts          ← POST /ai/chat (BL-35C)
        ai-chat.service.ts        ← Anthropic SDK, 10-turn rolling window (Redis), skills dispatcher
        skills.dispatcher.ts      ← maps tool_use block → internal NestJS services
        dto/
          chat.dto.ts             ← { message: string, sessionId?: string }
        ← conversation history stored in Redis (no DB entity); key: ai:session:{userId}:{sessionId}

      storage/
        storage.module.ts
        storage.service.ts        ← MinIO: upload, presignedGetObject, delete

      queue/
        queue.module.ts
        workers/
          email.worker.ts
          audio-extraction.worker.ts
          drop-notification.worker.ts
          genre-bulk-tagging.worker.ts
          recommendation-batch.worker.ts
          session-cleanup.worker.ts

    common/
      guards/
        jwt-auth.guard.ts
        email-verified.guard.ts
        roles.guard.ts
      decorators/
        current-user.decorator.ts
        public.decorator.ts
        roles.decorator.ts
        skip-email-verified.decorator.ts
      interceptors/
        transform.interceptor.ts
        audit-log.interceptor.ts
      filters/
        global-exception.filter.ts
      pipes/
        validation.pipe.ts
      types/
        enums.ts                  ← Role, SongStatus, NotificationType, etc.

    config/
      database.config.ts
      redis.config.ts
      minio.config.ts
      jwt.config.ts
      throttler.config.ts

    database/
      migrations/               ← TypeORM migration files (typeorm migration:generate)
      data-source.ts            ← TypeORM DataSource for CLI

    app.module.ts
    main.ts

  test/
    auth.e2e-spec.ts
    songs.e2e-spec.ts

  .env.example
  nest-cli.json
  package.json
  tsconfig.json
  tsconfig.build.json
```

---

## Frontend — `apps/web/`

```
apps/web/
  app/
    layout.tsx                              ← Root layout: QueryClientProvider, ZustandHydration
    [locale]/
      layout.tsx                            ← Locale layout: next-intl, IntlProvider
      (public)/
        page.tsx                            ← E1  Home / Landing
        artists/
          [id]/page.tsx                     ← C1  Public Artist Profile
        songs/
          [id]/teaser/page.tsx              ← I1  Drop Teaser Page
        genres/
          page.tsx                          ← E4  Genre Browsing

      (auth)/
        login/page.tsx                      ← A4
        register/page.tsx                   ← A1 + A2
        forgot-password/page.tsx            ← A5
        verify-reset/page.tsx               ← A6
        reset-password/page.tsx             ← A7

      (app)/
        layout.tsx                          ← PlayerBar + Sidebar + NotificationBell
        verify-email/page.tsx               ← A3
        onboarding/page.tsx                 ← A8

        profile/
          page.tsx                          ← B1
          edit/page.tsx                     ← B2
          password/page.tsx                 ← B3
          sessions/page.tsx                 ← B4
          premium/page.tsx                  ← B5

        artist/
          profile/page.tsx                  ← C2
          edit/page.tsx                     ← C3
          songs/
            page.tsx                        ← D2
            [id]/
              edit/page.tsx                 ← D3a
              resubmit/page.tsx             ← D4
          analytics/page.tsx                ← D3
          upload/page.tsx                   ← D1 (+ D6 inline extraction status)
          drops/page.tsx                    ← I2

        browse/
          page.tsx                          ← E2
          search/page.tsx                   ← E3

        playlists/
          page.tsx                          ← G1
          [id]/page.tsx                     ← G2
          create/page.tsx                   ← G3
          saved/page.tsx                    ← G6
          liked/page.tsx                    ← G5
          mood/page.tsx                     ← G7

        albums/
          [id]/page.tsx                     ← G8
          [id]/edit/page.tsx                ← G10
          create/page.tsx                   ← G9

        queue/page.tsx                      ← F2
        feed/page.tsx                       ← H1
        users/[id]/page.tsx                 ← H4

        payment/
          page.tsx                          ← J1
          vnpay/page.tsx                    ← J2
          momo/page.tsx                     ← J3

        downloads/page.tsx                  ← K2

        admin/
          layout.tsx                        ← Admin role guard
          page.tsx                          ← L1
          genres/page.tsx                   ← L2
          users/page.tsx                    ← L3
          songs/page.tsx                    ← D5
          reports/page.tsx                  ← L4
          audit/page.tsx                    ← L5
          payments/page.tsx                 ← L6

  middleware.ts                             ← next-intl + auth cookie check

  components/
    ui/                                     ← shadcn/ui primitives (Button, Input, Dialog…)
    layout/
      Sidebar.tsx
      PlayerBar.tsx
      NotificationBell.tsx                  ← H3 dropdown
      LanguageSwitcher.tsx
    player/
      HowlerPlayer.tsx                      ← howler.js instance + stream URL refresh
      QueueDrawer.tsx
      SmartOrderToggle.tsx
      VolumeControl.tsx
      ProgressBar.tsx
    song/
      SongCard.tsx
      SongRow.tsx
      SongContextMenu.tsx                   ← like, add to playlist, report, download
    album/
      AlbumCard.tsx
      AlbumGrid.tsx
    playlist/
      PlaylistCard.tsx
      PlaylistGrid.tsx
    artist/
      ArtistCard.tsx
      ArtistHeader.tsx
    upload/
      UploadForm.tsx
      ExtractionStatus.tsx                  ← D6 polling UI
    drop/
      DropCountdown.tsx
      DropCard.tsx
      ScheduleDropModal.tsx
      RescheduleDropModal.tsx               ← I4
      CancelDropModal.tsx                   ← I3
    modals/
      ReportModal.tsx                       ← E5
      DownloadModal.tsx                     ← K1
      ConfirmModal.tsx
    admin/
      ApprovalQueue.tsx
      AuditTable.tsx
      UserTable.tsx

  lib/
    api/
      axios.ts                              ← axios instance, interceptor (401 → refresh → retry)
      auth.api.ts
      songs.api.ts
      albums.api.ts
      playlists.api.ts
      users.api.ts
      artist.api.ts
      playback.api.ts
      recommendations.api.ts
      notifications.api.ts
      feed.api.ts
      drops.api.ts
      downloads.api.ts
      payments.api.ts
      genres.api.ts
      reports.api.ts
      admin.api.ts
    utils/
      format.ts                             ← duration, date, filesize formatters
      camelot.ts                            ← Camelot key display helpers
      crypto.ts                             ← client-side AES-256-CBC decrypt (offline playback)

  store/
    auth.store.ts                           ← useAuthStore: user, isLoggedIn, logout
    player.store.ts                         ← usePlayerStore: currentSong, isPlaying, volume
    queue.store.ts                          ← useQueueStore: tracks, smartOrder, history
    locale.store.ts                         ← useLocaleStore: locale, setLocale

  hooks/
    useStreamUrl.ts                         ← fetches + refreshes presigned stream URL (5-min pre-expiry)
    usePlayer.ts                            ← howler.js play/pause/seek actions
    useQueue.ts                             ← queue manipulation helpers
    useNotifications.ts                     ← polling GET /notifications/unread-count

  types/
    api.types.ts                            ← API response shapes, shared DTOs
    player.types.ts
    enums.ts                                ← SongStatus, Role, NotificationType, etc.

  messages/
    en.json
    vi.json

  public/
    icons/
    images/

  .env.local.example
  next.config.ts
  tailwind.config.ts
  components.json                           ← shadcn/ui config
  package.json
  tsconfig.json
```

---

## Python DSP Sidecar — `apps/dsp/`

```
apps/dsp/
  main.py                 ← FastAPI app entry point
  extract.py              ← librosa BPM + Camelot Key + energy extraction
  requirements.txt
  Dockerfile
```

---

## Shared Types — `packages/types/`

```
packages/types/
  src/
    song.types.ts         ← SongDto, UploadSongDto, SongStatus enum
    user.types.ts         ← UserDto, RegisterDto
    artist.types.ts
    playlist.types.ts
    payment.types.ts
    notification.types.ts
    common.types.ts       ← PaginatedResponse<T>, ApiResponse<T>
  package.json
  tsconfig.json
  index.ts
```
