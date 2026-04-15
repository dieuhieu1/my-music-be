'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { artistApi, type ArtistProfile } from '@/lib/api/artist.api';
import { useAuthStore } from '@/store/useAuthStore';
import FollowButton from '@/components/profile/FollowButton';
import { ArrowLeft, Music2, Users, Headphones, ExternalLink, Loader2 } from 'lucide-react';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  spotify:    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>,
  soundcloud: <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M1.175 12.225c-.015.07-.023.14-.023.215s.008.145.023.215l.585.49-.585.49c-.015.07-.023.14-.023.215s.008.145.023.215c.025.12.135.195.26.195h.855v-2.23H1.435c-.125 0-.235.075-.26.195zm2.895 1.75h.575v-2.24h-.575v2.24zm1.15 0h.575v-2.24h-.575v2.24zm1.15 0h.575v-2.24h-.575v2.24zm1.15 0h.575v-2.24h-.575v2.24zm1.15 0h.575v-2.24h-.575v2.24zm6.65-2.24c-.415 0-.76.195-.985.49a1.615 1.615 0 0 0-1.59-1.365c-.35 0-.675.11-.935.29v2.825h4.69c.445 0 .805-.36.805-.805 0-.445-.36-.805-.805-.805-.045 0-.09.005-.135.01-.04-.34-.32-.64-.675-.64zm-2.34.555c-.01-.065-.015-.135-.015-.205 0-.605.49-1.095 1.095-1.095.49 0 .91.325 1.05.775a1.84 1.84 0 0 0-.11.64c0 .085.005.17.015.25h-2.035z"/></svg>,
  youtube:    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  instagram:  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>,
};

export default function PublicArtistProfilePage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const { user }       = useAuthStore();

  const [artist, setArtist]   = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    artistApi.getArtistProfile(id)
      .then((r) => {
        const data: ArtistProfile = (r.data as any).data ?? r.data;
        setArtist(data);
        setFollowerCount(data.followerCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const isOwnProfile = user?.id === artist?.userId;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: 'var(--charcoal)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, color: 'var(--muted-text)',
      }}>
        <Loader2 size={20} className="animate-spin" />
        <span style={{ fontSize: '0.85rem' }}>Loading artist…</span>
      </div>
    );
  }

  if (!artist) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--charcoal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--ivory)', marginBottom: 8 }}>Artist not found</p>
          <Link href={`/${locale}`} style={{ fontSize: '0.82rem', color: 'var(--gold)', textDecoration: 'none' }}>← Go home</Link>
        </div>
      </div>
    );
  }

  const avatarUrl    = artist.avatarUrl;
  const socialLinks  = artist.socialLinks ?? [];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--charcoal)' }}>

      {/* ── Minimal top bar ───────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '14px 24px',
        background: 'linear-gradient(to bottom, rgba(13,13,13,0.9) 0%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '6px 14px',
            color: 'var(--ivory)', fontSize: '0.75rem',
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'background 0.2s',
          }}
        >
          <ArrowLeft size={13} /> Back
        </button>

        <Link href={`/${locale}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
              <path d="M7 3.5V14.5M7 3.5L13 6M7 3.5L13 6V11.5L7 14.5V3.5Z" stroke="#0d0d0d" strokeWidth="1.6" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--ivory)' }}>
            My Music
          </span>
        </Link>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', minHeight: 480, overflow: 'hidden' }}>

        {/* Blurred avatar background */}
        {avatarUrl ? (
          <div style={{
            position: 'absolute', inset: -20,
            backgroundImage: `url(${avatarUrl})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'blur(55px) saturate(0.6)',
            transform: 'scale(1.15)',
            opacity: 0.25,
          }} />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 30% 40%, rgba(232,184,75,0.07) 0%, transparent 60%)',
          }} />
        )}

        {/* Dark gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(13,13,13,0.4) 0%, rgba(13,13,13,0.7) 60%, var(--charcoal) 100%)',
        }} />

        {/* Content */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 100, paddingBottom: 48, paddingLeft: 24, paddingRight: 24,
          textAlign: 'center',
        }}>

          {/* Avatar */}
          <div
            className="anim-scale-reveal avatar-ring-pulse"
            style={{
              width: 120, height: 120, borderRadius: '50%',
              border: '3px solid rgba(232,184,75,0.5)',
              overflow: 'hidden',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 60px rgba(232,184,75,0.1)',
              marginBottom: 24, flexShrink: 0,
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={artist.stageName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: 'rgba(232,184,75,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 500,
                color: 'var(--gold)',
              }}>
                {artist.stageName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* Stage name */}
          <h1
            className="anim-fade-up anim-fade-up-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.4rem, 5vw, 4rem)',
              fontWeight: 500,
              color: 'var(--ivory)',
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              marginBottom: 12,
            }}
          >
            {artist.stageName}
          </h1>

          {/* Genres */}
          {artist.suggestedGenres?.length > 0 && (
            <div className="anim-fade-up anim-fade-up-2" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
              {artist.suggestedGenres.slice(0, 4).map((g) => (
                <span key={g} style={{
                  padding: '3px 10px',
                  background: 'rgba(232,184,75,0.08)',
                  border: '1px solid rgba(232,184,75,0.18)',
                  borderRadius: 20,
                  fontSize: '0.7rem',
                  color: 'var(--gold)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div
            className="anim-fade-up anim-fade-up-3"
            style={{ display: 'flex', gap: 32, marginBottom: 28, justifyContent: 'center' }}
          >
            {[
              { Icon: Users,      value: fmt(followerCount),        label: 'Followers'  },
              { Icon: Headphones, value: fmt(artist.listenerCount), label: 'Listeners'  },
            ].map(({ Icon, value, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginBottom: 2 }}>
                  <Icon size={13} style={{ color: 'var(--gold)', opacity: 0.8 }} />
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.6rem', fontWeight: 400,
                    color: 'var(--ivory)', lineHeight: 1,
                  }}>
                    {value}
                  </span>
                </div>
                <p style={{ fontSize: '0.65rem', color: 'var(--muted-text)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Follow + Edit buttons */}
          <div className="anim-fade-up anim-fade-up-4" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {!isOwnProfile && user && (
              <FollowButton
                targetId={artist.userId}
                targetType="artist"
                initialIsFollowing={false}
                size="lg"
                onFollowChange={(f) => setFollowerCount(c => c + (f ? 1 : -1))}
              />
            )}
            {isOwnProfile && (
              <Link
                href={`/${locale}/artist/edit`}
                style={{
                  padding: '12px 28px',
                  border: '1px solid var(--gold)',
                  borderRadius: 3,
                  color: 'var(--gold)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  letterSpacing: '0.07em',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-body)',
                  textTransform: 'uppercase',
                  transition: 'background 0.2s',
                }}
              >
                Edit Profile
              </Link>
            )}
            {!user && (
              <Link
                href={`/${locale}/login`}
                style={{
                  padding: '12px 28px',
                  border: '1px solid var(--gold)',
                  borderRadius: 3,
                  color: 'var(--gold)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  letterSpacing: '0.07em',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-body)',
                  textTransform: 'uppercase',
                }}
              >
                Follow
              </Link>
            )}
          </div>

          {/* Social links */}
          {socialLinks.length > 0 && (
            <div
              className="anim-fade-up anim-fade-up-5"
              style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}
            >
              {socialLinks.map((link) => {
                const key = link.platform.toLowerCase();
                const icon = PLATFORM_ICONS[key];
                return (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 20,
                      color: 'var(--muted-text)',
                      fontSize: '0.72rem',
                      textDecoration: 'none',
                      fontFamily: 'var(--font-body)',
                      backdropFilter: 'blur(4px)',
                      transition: 'color 0.2s, border-color 0.2s',
                      textTransform: 'capitalize',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--ivory)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--muted-text)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    }}
                  >
                    {icon ?? <ExternalLink size={11} />}
                    {link.platform}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bio ───────────────────────────────────────────────────────────── */}
      {artist.bio && (
        <div
          className="anim-fade-up anim-fade-up-6"
          style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 40px' }}
        >
          <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #2a2520, transparent)', marginBottom: 32 }} />
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>
            About
          </p>
          <p style={{
            fontSize: '0.95rem',
            color: 'rgba(245,238,216,0.7)',
            lineHeight: 1.8,
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
          }}>
            {artist.bio}
          </p>
        </div>
      )}

      {/* ── Songs placeholder ─────────────────────────────────────────────── */}
      <div
        className="anim-fade-up anim-fade-up-7"
        style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 80px' }}
      >
        <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #1a1a1a, transparent)', marginBottom: 32 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Music2 size={16} style={{ color: 'var(--gold)' }} />
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            Songs
          </p>
        </div>
        <div style={{
          padding: '32px 24px', textAlign: 'center',
          background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 8,
          borderStyle: 'dashed',
        }}>
          <Music2 size={28} style={{ color: 'rgba(232,184,75,0.2)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
            Songs available in Phase 5
          </p>
        </div>
      </div>
    </div>
  );
}
