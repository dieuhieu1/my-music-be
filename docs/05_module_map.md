# NestJS Module Map
**Music Streaming App · Backend Structure**

---

Each module owns its controllers, services, and TypeORM repositories. Cross-module communication goes through service injection (not direct DB access).

```
src/modules/
  auth/              ← BL-01–08, BL-41–43, BL-78–79
  users/             ← BL-66, BL-72–73, BL-32
  artist-profile/    ← BL-46–47, BL-67, BL-11
  songs/             ← BL-09, BL-37, BL-44, BL-48–49, BL-83–85
  albums/            ← BL-10, BL-14, BL-18
  playlists/         ← BL-12–13, BL-15–17, BL-22
  playback/          ← BL-28, BL-30–31, BL-37C
  genres/            ← BL-36, BL-68–71
  recommendations/   ← BL-35, BL-35A, BL-36A–B, BL-38A–C
  notifications/     ← BL-80–82
  feed/              ← BL-33
  drops/             ← BL-59–65
  downloads/         ← BL-52–58
  payments/          ← BL-20–21, BL-74–77
  reports/           ← BL-38
  analytics/         ← BL-51
  admin/             ← BL-37, BL-40, BL-68–71, BL-74–75, BL-83–84
  audit/             ← BL-40
  mail/              ← Email templates (Section 14 of requirements)
  storage/           ← MinIO abstraction: upload, presigned URL, delete
  queue/             ← BullMQ queue/worker definitions

src/common/
  guards/            ← JwtAuthGuard, RolesGuard, EmailVerifiedGuard
  decorators/        ← @Roles(), @CurrentUser(), @Public(), @SkipEmailVerified()
  interceptors/      ← TransformInterceptor, AuditLogInterceptor
  filters/           ← GlobalExceptionFilter
  pipes/             ← Global ValidationPipe
```

---

## Guard Execution Order

```
Incoming request
  → JwtAuthGuard         (validate access token JWT; skip if @Public())
  → EmailVerifiedGuard   (block if is_email_verified=false; skip if @Public() or @SkipEmailVerified())
  → RolesGuard           (check @Roles() decorator against user.roles)
  → Controller handler
  → Service-level ownership check (ARTIST: verify resource.creatorId === currentUser.id — BL-50)
     Throws ForbiddenException if mismatch — NOT a NestJS Guard, done inside the service method
```

---

## Interceptors

- `TransformInterceptor` — wraps all successful responses in `{ statusCode, data }` envelope for consistent API shape
- `AuditLogInterceptor` — writes to `AuditLog` table after any **admin-only** mutating endpoint succeeds (BL-40); reads `@CurrentUser()` + route metadata to populate `adminId`, `action`, `targetType`, `targetId`

---

## Refresh Token Rotation

On `POST /auth/refresh`: server issues **both** a new access token AND a new refresh token (rotation). Old refresh token is invalidated. This prevents refresh token replay attacks.
