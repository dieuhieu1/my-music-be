<div align="center">

# 🎵 MyMusic

**A self-hosted Spotify alternative — built for music lovers, run by you.**

[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![AWS S3](https://img.shields.io/badge/AWS_S3-Storage-FF9900?style=flat-square&logo=amazons3&logoColor=white)](https://aws.amazon.com/s3)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

*Stream, discover, and share music — on your own infrastructure.*

</div>

---

## ✨ What is MyMusic?

MyMusic is a **full-stack, self-hosted music streaming platform** designed for small communities of 20–200 users. It brings together everything you love about modern streaming services — personalized recommendations, social feeds, artist tools, premium downloads, and live drops — while keeping your data completely under your control.

> Built as a real-world monorepo project covering auth, payments, AI, DSP audio analysis, and more.

---

## 🖼️ Feature Highlights

| | Feature | Description |
|---|---------|-------------|
| 🎧 | **HD Streaming** | Presigned S3 URLs, 15-min expiry, AES-256 encrypted downloads |
| 🎤 | **Artist Studio** | Upload songs, manage albums, schedule drops, view analytics |
| 👑 | **Premium Membership** | VNPay & MoMo payment gateways, monthly/quarterly/yearly plans |
| 📥 | **Offline Downloads** | AES-256-CBC encrypted files, license JWT, quota per role |
| 📡 | **Live Drops** | Schedule song releases with countdown teasers & fan notifications |
| 🔔 | **Real-time Notifications** | In-app bell, BullMQ email jobs, drop reminders (24h & 1h) |
| 🤖 | **AI Recommendations** | Mood engine, cold-start onboarding, play-history scoring |
| 🌐 | **Social Feed** | Follow artists/users, activity feed, liked songs, saved playlists |
| 🛡️ | **Admin Portal** | Song moderation queue, user management, audit log, reports |
| 📊 | **Analytics** | Artist play/download stats, admin revenue dashboard |
| 🌍 | **i18n** | English & Vietnamese (next-intl) |

---

## 🏗️ Architecture

```
my-music/
├── apps/
│   ├── api/          ← NestJS 10  · REST API · port 3001
│   ├── web/          ← Next.js 14 · App Router · port 3000
│   └── dsp/          ← Python FastAPI · Audio analysis · port 5000
└── packages/
    └── types/        ← Shared TypeScript enums & DTOs
```

### Data Flow

```
Browser ──► Next.js (SSR/CSR)
               │
               ▼
           NestJS API ──► PostgreSQL  (TypeORM)
               │       ──► Redis      (BullMQ · Cache · JWT denylist)
               │       ──► AWS S3     (audio · images)
               │
               ▼
           Python DSP ──► librosa    (BPM · key · energy)
```

---

## 🛠️ Tech Stack

### Backend — `apps/api`

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 10 + Express |
| ORM | TypeORM 0.3 + PostgreSQL 16 |
| Queue / Cache | BullMQ + Redis 7 |
| Storage | AWS S3 (`@aws-sdk/client-s3` v3) |
| Auth | Passport JWT · httpOnly cookies |
| Email | Nodemailer + Gmail SMTP |
| Payments | VNPay (HMAC-SHA512) · MoMo (HMAC-SHA256) |
| AI | Anthropic Claude API |
| Cron | `@nestjs/schedule` |

### Frontend — `apps/web`

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router |
| State | Zustand + React Query v5 |
| Audio | Howler.js (streaming) · Web Audio API |
| UI | Radix UI primitives · Lucide icons |
| Forms | react-hook-form + Zod |
| i18n | next-intl |

### DSP Sidecar — `apps/dsp`

| Layer | Technology |
|-------|-----------|
| Framework | Python FastAPI |
| Audio Analysis | librosa · numpy |
| Output | BPM · Camelot key · Energy score |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- AWS account with S3 access
- Gmail account with App Password

### 1. Clone & Install

```bash
git clone https://github.com/dieuhieu1/my-music-be.git
cd my-music
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Key variables to fill in:

```env
# Database
DB_HOST=postgres
DB_USER=mymusic
DB_PASSWORD=your_password
DB_NAME=mymusic_db

# Redis
REDIS_HOST=redis

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET_AUDIO=mymusic-audio
AWS_S3_BUCKET_IMAGES=mymusic-images

# Auth
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Payments
VNPAY_HASH_SECRET=your_vnpay_secret
MOMO_SECRET_KEY=your_momo_secret

# Email
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your_16char_app_password

# AI (Phase 10)
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start with Docker

```bash
docker compose up -d
```

| Service | Port |
|---------|------|
| Next.js Web | `3000` |
| NestJS API | `3001` |
| Python DSP | `5000` |
| PostgreSQL | `5432` |
| Redis | `6379` |

### 4. Open the App

```
http://localhost:3000
```

---

## 🗄️ S3 Bucket Setup

Create **2 buckets** in AWS S3 (`us-east-1` or your preferred region):

| Bucket | Access | Purpose |
|--------|--------|---------|
| `mymusic-audio` | 🔒 Private | Audio files + encrypted downloads |
| `mymusic-images` | 🌐 Public-read | Cover art + user avatars |

Apply this bucket policy to `mymusic-images`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::mymusic-images/*"
  }]
}
```

---

## 🔐 Roles & Permissions

| Role | Capabilities |
|------|-------------|
| `USER` | Browse · Stream · Playlists · Social feed |
| `ARTIST` | + Upload songs · Album management · Analytics · Live drops |
| `PREMIUM` | + HD downloads (100/month quota) · Early drop access |
| `ARTIST + PREMIUM` | + 200 download quota |
| `ADMIN` | Full access · Unlimited downloads · Bypass all gates |

---

## 🔄 Song Status Machine

```
              ┌─► LIVE ◄────────────────── TAKEN_DOWN
              │     ▲                           │
PENDING ──────┤     └── SCHEDULED (cron) ──────►│
              │              ▲                  ▼
              ├─► REJECTED   └── (with dropAt) LIVE
              │
              └─► REUPLOAD_REQUIRED ──► PENDING (resubmit)
```

---

## 📋 API Reference

**Base URL:** `http://localhost:3001/api/v1`

**Response envelope (all endpoints):**
```json
{ "success": true,  "data": { ... } }
{ "success": false, "data": null, "error": { "code": "ERR_CODE", "message": "..." } }
```

**Authentication:** httpOnly cookies
- `access_token` — 15 minutes
- `refresh_token` — 30 days

| Group | Key Endpoints |
|-------|--------------|
| 🔑 Auth | `POST /auth/login` · `/register` · `/logout` · `/refresh` |
| 👤 Users | `GET /users/me` · `PATCH /users/me` · `POST /users/me/onboarding` |
| 🎵 Songs | `POST /songs/upload` · `GET /songs/:id/stream` · `PATCH /songs/:id` |
| 💳 Payments | `GET /payment/vn-pay?premiumType=` · `POST /payment/momo` |
| 📥 Downloads | `POST /songs/:id/download` · `GET /songs/downloads` |
| 📡 Drops | `GET /drops` · `DELETE /songs/:id/drop` · `PATCH /songs/:id/drop` |
| 🤖 Recs | `GET /recommendations` · `GET /recommendations/mood?mood=HAPPY` |
| 🛡️ Admin | `PATCH /admin/songs/:id/approve` · `GET /admin/users` · `GET /admin/audit` |

---

## 📁 Project Structure

```
apps/api/src/
├── modules/
│   ├── auth/             # JWT auth, sessions, email verification
│   ├── users/            # Profile, avatar, genre onboarding
│   ├── artist-profile/   # Stage name, bio, social links
│   ├── songs/            # Upload, stream, DSP pipeline, like
│   ├── albums/           # Album CRUD + track management
│   ├── playlists/        # Playlists, liked songs, saved
│   ├── payments/         # VNPay + MoMo + premium lifecycle
│   ├── downloads/        # Encrypted download records + quota
│   ├── drops/            # Scheduled releases + fan notify
│   ├── notifications/    # In-app + BullMQ email notifications
│   ├── recommendations/  # AI scoring + mood engine + cache
│   ├── reports/          # Content reports + admin resolution
│   ├── admin/            # Moderation + user management
│   ├── storage/          # AWS S3 abstraction layer
│   └── mail/             # Nodemailer inline HTML templates
└── config/               # DB · Redis · S3 · mail · payment

apps/web/src/
├── app/[locale]/
│   ├── (app)/            # Auth-required shell (Sidebar + PlayerBar)
│   │   ├── browse/       # Song grid + search
│   │   ├── artist/       # Studio: upload · songs · albums · drops
│   │   ├── admin/        # Moderation · users · audit · reports
│   │   ├── payment/      # Premium upgrade + gateway result pages
│   │   └── downloads/    # Premium download list
│   ├── (auth)/           # Login · register · password reset
│   └── (public)/         # Landing · artist pages · drop teasers
├── components/
│   ├── layout/           # Sidebar · TopBar · PlayerBar · NotificationBell
│   ├── music/            # SongCard · SongRow · AlbumCard · PlaylistCard
│   └── payment/          # PlanCard · GatewaySelector · PremiumUpgradeModal
├── hooks/                # usePlayer · useQueue · useNotifications
└── store/                # Zustand: auth · player · queue
```

---

## 🗺️ Roadmap

| Phase | Feature | Status |
|-------|---------|:------:|
| 1 | Infrastructure + App Shell | ✅ |
| 2 | Auth & Sessions | ✅ |
| 3 | User & Artist Profiles | ✅ |
| 4A | Content Upload & DSP Processing | ✅ |
| 4B | Admin Approval & Moderation | ✅ |
| 5 | Browse, Search & Streaming | ✅ |
| 6 | Playlists & Social Feed | ✅ |
| 7 | Payments & Premium Downloads | ✅ |
| 8 | Drops & Notifications | ✅ |
| 9 | Reports, Analytics & Admin Tools | ✅ |
| 10 | Recommendations, Mood Engine & AI Chat | 🚧 |

---

## 🤝 Contributing

This is a personal full-stack learning project. Feel free to fork, explore, and build on top of it.

---

<div align="center">

Made with ❤️ by [**humbledieu**](https://github.com/dieuhieu1)

*Self-hosted · Your music, your rules*

</div>
