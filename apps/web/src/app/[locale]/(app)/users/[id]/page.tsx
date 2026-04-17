'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usersApi, type PublicUser } from '@/lib/api/users.api';
import { useAuthStore } from '@/store/useAuthStore';
import FollowButton from '@/components/profile/FollowButton';
import { Users, UserCheck, Music2 } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    PREMIUM: { bg: 'rgba(232,184,75,0.12)',   color: 'var(--gold)',    label: '✦ Premium' },
    ARTIST:  { bg: 'rgba(160,120,200,0.12)',  color: '#c8a0e8',       label: '♪ Artist'  },
    ADMIN:   { bg: 'rgba(100,180,255,0.12)',  color: '#90c8ff',       label: '⬡ Admin'   },
    USER:    { bg: 'rgba(255,255,255,0.05)',  color: 'var(--muted-text)', label: 'Listener' },
  };
  const s = styles[role] ?? styles.USER;
  return (
    <span style={{
      padding: '3px 9px',
      background: s.bg,
      border: `1px solid ${s.color}22`,
      borderRadius: 20,
      fontSize: '0.68rem',
      color: s.color,
      fontWeight: 500,
      letterSpacing: '0.04em',
      fontFamily: 'var(--font-body)',
    }}>
      {s.label}
    </span>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface FollowingItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  type: 'ARTIST' | 'USER';
  followedAt: string;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PublicUserProfilePage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const { user }       = useAuthStore();

  const [profile, setProfile]               = useState<PublicUser | null>(null);
  const [following, setFollowing]           = useState<FollowingItem[]>([]);
  const [followingTotal, setFollowingTotal] = useState(0);
  const [followingPage, setFollowingPage]   = useState(1);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [followerCount, setFollowerCount]   = useState(0);

  // ── Initial parallel fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoadingProfile(true);

    Promise.all([
      usersApi.getUser(id),
      usersApi.getFollowing(id, 1, 20),
    ])
      .then(([userRes, followingRes]) => {
        const u = (userRes.data as any).data   ?? userRes.data;
        const f = (followingRes.data as any).data ?? followingRes.data;
        setProfile(u);
        setFollowerCount(u.followerCount ?? 0);
        setFollowing(f.items ?? []);
        setFollowingTotal(f.total ?? 0);
        setFollowingPage(1);
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [id]);

  // ── Load more ───────────────────────────────────────────────────────────────
  const handleLoadMore = async () => {
    if (loadingMore || !id) return;
    const nextPage = followingPage + 1;
    setLoadingMore(true);
    try {
      const res  = await usersApi.getFollowing(id, nextPage, 20);
      const body = (res.data as any).data ?? res.data;
      setFollowing((prev) => [...prev, ...(body.items ?? [])]);
      setFollowingTotal(body.total ?? 0);
      setFollowingPage(nextPage);
    } catch {
      // silent — user can retry
    } finally {
      setLoadingMore(false);
    }
  };

  const isOwnProfile = !!user && user.id === profile?.id;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loadingProfile) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', flexDirection: 'column', gap: 16,
      }}>
        {/* Vinyl disc spinner — matches the design system loading pattern */}
        <svg
          className="vinyl-spin"
          width="64" height="64" viewBox="0 0 64 64"
          style={{ display: 'block' }}
        >
          <circle cx="32" cy="32" r="30" fill="#1a1a1a" stroke="#2a2520" strokeWidth="1"/>
          <circle cx="32" cy="32" r="22" fill="none" stroke="#222" strokeWidth="0.8"/>
          <circle cx="32" cy="32" r="19" fill="none" stroke="#222" strokeWidth="0.8"/>
          <circle cx="32" cy="32" r="16" fill="none" stroke="#222" strokeWidth="0.8"/>
          <circle cx="32" cy="32" r="14" fill="#111111"/>
          <circle cx="32" cy="32" r="3"  fill="var(--gold)" opacity="0.7"/>
        </svg>
        <p style={{
          fontSize: '0.78rem', color: 'var(--muted-text)',
          fontFamily: 'var(--font-body)', letterSpacing: '0.08em',
        }}>
          Loading profile…
        </p>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', flexDirection: 'column', gap: 12,
      }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.8rem', fontWeight: 400,
          color: 'var(--ivory)',
        }}>
          User not found
        </p>
        <Link
          href={`/${locale}`}
          style={{ fontSize: '0.82rem', color: 'var(--gold)', textDecoration: 'none' }}
        >
          ← Go home
        </Link>
      </div>
    );
  }

  const roles      = profile.roles ?? ['USER'];
  const joinYear   = new Date(profile.createdAt).getFullYear();
  const joinLong   = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const avatarUrl  = profile.avatarUrl;
  const hasMore    = following.length < followingTotal;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div
        className="anim-hero-reveal"
        style={{ position: 'relative', minHeight: 400, overflow: 'hidden' }}
      >
        {/* Blurred avatar ambient background */}
        {avatarUrl ? (
          <div style={{
            position: 'absolute', inset: -20,
            backgroundImage: `url(${avatarUrl})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'blur(55px) saturate(0.6)',
            transform: 'scale(1.15)',
            opacity: 0.25,
            pointerEvents: 'none',
          }} />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 30% 40%, rgba(232,184,75,0.07) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />
        )}

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(13,13,13,0.4) 0%, rgba(13,13,13,0.7) 55%, var(--charcoal) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 64, paddingBottom: 48, paddingLeft: 24, paddingRight: 24,
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
              <img
                src={avatarUrl}
                alt={profile.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: 'rgba(232,184,75,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '2.6rem', fontWeight: 500,
                color: 'var(--gold)',
              }}>
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* Display name */}
          <h1
            className="anim-fade-up anim-fade-up-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 4vw, 3.2rem)',
              fontWeight: 400,
              color: 'var(--ivory)',
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              marginBottom: 12,
            }}
          >
            {profile.name}
          </h1>

          {/* Role badges */}
          <div
            className="anim-fade-up anim-fade-up-2"
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}
          >
            {roles
              .filter((r) => r !== 'USER' || roles.length === 1)
              .map((r) => <RoleBadge key={r} role={r} />)
            }
          </div>

          {/* Stats row */}
          <div
            className="anim-fade-up anim-fade-up-3"
            style={{ display: 'flex', gap: 32, marginBottom: 28, justifyContent: 'center' }}
          >
            {[
              { label: 'Followers',  value: fmt(followerCount) },
              { label: 'Following',  value: fmt(profile.followingCount) },
              { label: 'Joined',     value: joinYear.toString() },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6rem', fontWeight: 400,
                  color: 'var(--ivory)', lineHeight: 1,
                }}>
                  {value}
                </p>
                <p style={{
                  fontSize: '0.65rem', color: 'var(--muted-text)',
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4,
                }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="anim-fade-up anim-fade-up-4">
            {!isOwnProfile && user && (
              <FollowButton
                targetId={profile.id}
                targetType="user"
                initialIsFollowing={false}
                size="lg"
                onFollowChange={(f) => setFollowerCount((c) => c + (f ? 1 : -1))}
              />
            )}
            {isOwnProfile && (
              <Link
                href={`/${locale}/profile/edit`}
                style={{
                  display: 'inline-block',
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
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(232,184,75,0.08)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                Edit Profile
              </Link>
            )}
            {!user && (
              <Link
                href={`/${locale}/login`}
                style={{
                  display: 'inline-block',
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
        </div>
      </div>

      {/* ── Details card ─────────────────────────────────────────────────────── */}
      <div
        className="anim-fade-up anim-fade-up-5"
        style={{
          margin: '20px 24px 0',
          padding: '20px 24px',
          background: 'var(--surface)',
          border: '1px solid #1a1a1a',
          borderRadius: 8,
        }}
      >
        <p style={{
          fontSize: '0.63rem', letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16,
        }}>
          Details
        </p>
        {[
          { label: 'Member since', value: joinLong },
          { label: 'Followers',    value: fmt(followerCount) },
          { label: 'Following',    value: fmt(profile.followingCount) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0',
              borderBottom: '1px solid #161616',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>{label}</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--ivory)', fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Following section ────────────────────────────────────────────────── */}
      <div
        className="anim-fade-up anim-fade-up-6"
        style={{ margin: '20px 24px 40px' }}
      >
        {/* Section header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
        }}>
          <Users size={14} style={{ color: 'var(--gold)' }} />
          <p style={{
            fontSize: '0.63rem', letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--gold)',
          }}>
            Following
            {followingTotal > 0 && (
              <span style={{ color: 'var(--muted-text)', marginLeft: 6 }}>
                ({followingTotal})
              </span>
            )}
          </p>
        </div>

        {/* Empty state */}
        {following.length === 0 && (
          <div style={{
            padding: '32px 24px', textAlign: 'center',
            background: '#0e0e0e',
            border: '1px dashed #1a1a1a',
            borderRadius: 8,
          }}>
            <Users size={28} style={{ color: 'rgba(232,184,75,0.2)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
              Not following anyone yet
            </p>
          </div>
        )}

        {/* List */}
        {following.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {following.map((item, i) => {
              const href = item.type === 'ARTIST'
                ? `/${locale}/artists/${item.id}`
                : `/${locale}/users/${item.id}`;
              const initials = (item.name ?? '??').slice(0, 2).toUpperCase();

              return (
                <Link
                  key={item.id}
                  href={href}
                  className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    background: 'var(--surface)',
                    border: '1px solid #1a1a1a',
                    borderRadius: 6,
                    textDecoration: 'none',
                    transition: 'background 0.18s, border-color 0.18s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                    (e.currentTarget as HTMLElement).style.borderColor = '#2a2520';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                    (e.currentTarget as HTMLElement).style.borderColor = '#1a1a1a';
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '1px solid rgba(232,184,75,0.2)',
                    overflow: 'hidden', flexShrink: 0,
                  }}>
                    {item.avatarUrl ? (
                      <img
                        src={item.avatarUrl}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: 'rgba(232,184,75,0.07)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontSize: '0.8rem',
                        fontWeight: 500, color: 'var(--gold)',
                      }}>
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <span style={{
                    flex: 1, fontSize: '0.88rem',
                    color: 'var(--ivory)', fontFamily: 'var(--font-body)',
                    fontWeight: 500, minWidth: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {item.name}
                  </span>

                  {/* Type badge */}
                  <span style={{
                    padding: '2px 8px',
                    background: item.type === 'ARTIST'
                      ? 'rgba(160,120,200,0.12)'
                      : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${item.type === 'ARTIST' ? 'rgba(160,120,200,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 20,
                    fontSize: '0.62rem',
                    color: item.type === 'ARTIST' ? '#c8a0e8' : 'var(--muted-text)',
                    letterSpacing: '0.06em',
                    fontFamily: 'var(--font-body)',
                    flexShrink: 0,
                  }}>
                    {item.type === 'ARTIST' ? (
                      <><Music2 size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />ARTIST</>
                    ) : (
                      <><UserCheck size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />USER</>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              display: 'block', width: '100%', marginTop: 10,
              padding: '10px', background: 'transparent',
              border: '1px solid #2a2520', borderRadius: 4,
              color: loadingMore ? 'var(--muted-text)' : 'var(--muted-text)',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-body)',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!loadingMore) {
                (e.currentTarget as HTMLElement).style.borderColor = '#3a3530';
                (e.currentTarget as HTMLElement).style.color = 'var(--ivory)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#2a2520';
              (e.currentTarget as HTMLElement).style.color = 'var(--muted-text)';
            }}
          >
            {loadingMore
              ? 'Loading…'
              : `Load more · ${following.length} / ${followingTotal}`
            }
          </button>
        )}
      </div>
    </div>
  );
}
