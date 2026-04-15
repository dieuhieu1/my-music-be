'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { artistApi, type ArtistProfile } from '@/lib/api/artist.api';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Edit3, Music2, Users, Headphones, Upload, BarChart2,
  ExternalLink, Loader2, ArrowUpRight, Eye,
} from 'lucide-react';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  spotify:    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>,
  soundcloud: <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M1.175 12.225c-.025.12-.04.245-.04.375s.015.255.04.375l.54.09-.54.09a1.35 1.35 0 0 0 0 .75l.705.12-.705.12a1.35 1.35 0 0 0 .135.54h1.755v-3h-1.755a1.35 1.35 0 0 0-.135.54zm2.67 1.65h.525v-1.875h-.525V13.875zm1.05 0h.525V12h-.525v1.875zm1.05 0h.525V11.25h-.525v2.625zm1.05 0h.525v-1.875h-.525V13.875zm1.05 0h.525V12h-.525v1.875zm6.255-2.1c-.36 0-.675.165-.885.42a1.5 1.5 0 0 0-1.44-1.095c-.315 0-.615.09-.855.24v2.535H14.25c.45 0 .81-.36.81-.81 0-.45-.36-.81-.81-.81-.045 0-.09.005-.135.015-.045-.345-.345-.495-.645-.495z"/></svg>,
  youtube:    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  instagram:  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>,
};

interface ActionCardProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
  accent?: boolean;
}

function ActionCard({ href, icon, label, desc, accent }: ActionCardProps) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 18px',
        background: hov ? (accent ? 'rgba(232,184,75,0.08)' : '#181818') : (accent ? 'rgba(232,184,75,0.04)' : '#111111'),
        border: `1px solid ${hov ? (accent ? 'rgba(232,184,75,0.3)' : '#2a2520') : (accent ? 'rgba(232,184,75,0.15)' : '#1a1a1a')}`,
        borderRadius: 7,
        textDecoration: 'none',
        transition: 'background 0.18s, border-color 0.18s',
        flex: 1, minWidth: 0,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
        background: accent ? 'rgba(232,184,75,0.1)' : 'rgba(232,184,75,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.83rem', fontWeight: 500, color: 'var(--ivory)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: '0.7rem', color: 'var(--muted-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</p>
      </div>
      <ArrowUpRight size={13} style={{ color: hov ? 'var(--gold)' : 'var(--muted-text)', flexShrink: 0, transition: 'color 0.18s' }} />
    </Link>
  );
}

export default function MyArtistProfilePage() {
  const { locale }  = useParams<{ locale: string }>();
  const { user }    = useAuthStore();

  const [artist, setArtist]   = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    artistApi.getArtistProfile(user.id)
      .then((r) => setArtist((r.data as any).data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 10, color: 'var(--muted-text)' }}>
        <Loader2 size={18} className="animate-spin" />
        <span style={{ fontSize: '0.85rem' }}>Loading…</span>
      </div>
    );
  }

  if (!artist) return null;

  const socialLinks = artist.socialLinks ?? [];
  const genres      = artist.suggestedGenres ?? [];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* ── Hero banner ───────────────────────────────────────────────────── */}
      <div
        className="anim-hero-reveal"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0a0804 0%, #0f0d0a 50%, #0a0a0a 100%)',
          borderBottom: '1px solid #1a1a1a',
        }}
      >
        {/* Blurred avatar as ambient background */}
        {artist.avatarUrl && (
          <div style={{
            position: 'absolute', inset: -20,
            backgroundImage: `url(${artist.avatarUrl})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'blur(60px) saturate(0.4)',
            transform: 'scale(1.2)',
            opacity: 0.18,
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(10,8,4,0.5) 0%, rgba(10,8,4,0.85) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Gold radial glow */}
        <div style={{
          position: 'absolute', top: -80, right: -60, width: 360, height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,184,75,0.06) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', padding: '40px 40px 32px', display: 'flex', gap: 28, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div
            className="anim-scale-reveal avatar-ring-pulse"
            style={{
              width: 96, height: 96, borderRadius: '50%', flexShrink: 0,
              border: '2px solid rgba(232,184,75,0.4)',
              overflow: 'hidden',
              boxShadow: '0 0 40px rgba(232,184,75,0.12), 0 6px 24px rgba(0,0,0,0.6)',
            }}
          >
            {artist.avatarUrl ? (
              <img src={artist.avatarUrl} alt={artist.stageName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: 'rgba(232,184,75,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500,
                color: 'var(--gold)',
              }}>
                {artist.stageName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6, opacity: 0.8 }}>
              Artist Profile
            </p>
            <h1
              className="anim-fade-up anim-fade-up-1"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                fontWeight: 400,
                color: 'var(--ivory)',
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
                marginBottom: 10,
              }}
            >
              {artist.stageName}
            </h1>

            {/* Genre pills */}
            {genres.length > 0 && (
              <div className="anim-fade-up anim-fade-up-2" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {genres.slice(0, 3).map((g) => (
                  <span key={g} style={{
                    padding: '2px 9px',
                    background: 'rgba(232,184,75,0.07)',
                    border: '1px solid rgba(232,184,75,0.15)',
                    borderRadius: 20,
                    fontSize: '0.65rem',
                    color: 'var(--gold)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    opacity: 0.85,
                  }}>
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div
          className="anim-fade-up anim-fade-up-3"
          style={{
            display: 'flex', gap: 40,
            padding: '20px 40px 28px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
          }}
        >
          {[
            { Icon: Users,      value: fmt(artist.followerCount ?? 0),  label: 'Followers' },
            { Icon: Headphones, value: fmt(artist.listenerCount ?? 0),  label: 'Listeners' },
            { Icon: Music2,     value: '—',                              label: 'Songs'     },
          ].map(({ Icon, value, label }) => (
            <div key={label}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.55rem', fontWeight: 400,
                  color: 'var(--gold)', lineHeight: 1,
                }}>
                  {value}
                </p>
              </div>
              <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', color: 'var(--muted-text)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <Icon size={10} /> {label}
              </p>
            </div>
          ))}

          {/* View public link */}
          <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            <Link
              href={`/${locale}/artists/${user?.id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 14px',
                background: 'rgba(232,184,75,0.06)',
                border: '1px solid rgba(232,184,75,0.15)',
                borderRadius: 20,
                fontSize: '0.7rem',
                color: 'var(--gold)',
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
                transition: 'background 0.2s',
              }}
            >
              <Eye size={11} /> Public View
            </Link>
          </div>
        </div>
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <div className="anim-fade-up anim-fade-up-4" style={{ padding: '24px 24px 0' }}>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>
          Manage
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ActionCard
            href={`/${locale}/artist/edit`}
            icon={<Edit3 size={16} style={{ color: 'var(--gold)' }} />}
            label="Edit Profile"
            desc="Stage name, bio & links"
            accent
          />
          <ActionCard
            href={`/${locale}/artist/upload`}
            icon={<Upload size={16} style={{ color: 'var(--gold)' }} />}
            label="Upload Song"
            desc="Publish new music"
          />
          <ActionCard
            href={`/${locale}/artist/analytics`}
            icon={<BarChart2 size={16} style={{ color: 'var(--gold)' }} />}
            label="Analytics"
            desc="Plays, follows & reach"
          />
        </div>
      </div>

      {/* ── Bio ──────────────────────────────────────────────────────────── */}
      {artist.bio && (
        <div
          className="anim-fade-up anim-fade-up-5"
          style={{ margin: '20px 24px 0', padding: '20px 24px', background: '#111111', border: '1px solid #1a1a1a', borderRadius: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              Bio
            </p>
            <Link
              href={`/${locale}/artist/edit`}
              style={{ fontSize: '0.7rem', color: 'var(--muted-text)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Edit3 size={10} /> Edit
            </Link>
          </div>
          <p style={{
            fontSize: '0.88rem',
            color: 'rgba(245,238,216,0.65)',
            lineHeight: 1.75,
            fontStyle: 'italic',
            fontFamily: 'var(--font-body)',
          }}>
            {artist.bio}
          </p>
        </div>
      )}

      {/* ── Social links ─────────────────────────────────────────────────── */}
      {socialLinks.length > 0 && (
        <div
          className="anim-fade-up anim-fade-up-6"
          style={{ margin: '16px 24px 32px', padding: '20px 24px', background: '#111111', border: '1px solid #1a1a1a', borderRadius: 8 }}
        >
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>
            Social Links
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {socialLinks.map((link) => {
              const icon = PLATFORM_ICONS[link.platform.toLowerCase()];
              return (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 13px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid #222',
                    borderRadius: 20,
                    color: 'var(--muted-text)',
                    fontSize: '0.72rem',
                    textDecoration: 'none',
                    textTransform: 'capitalize',
                    fontFamily: 'var(--font-body)',
                    transition: 'color 0.2s, border-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--ivory)';
                    (e.currentTarget as HTMLElement).style.borderColor = '#333';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--muted-text)';
                    (e.currentTarget as HTMLElement).style.borderColor = '#222';
                  }}
                >
                  {icon ?? <ExternalLink size={11} />}
                  {link.platform}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Songs placeholder ────────────────────────────────────────────── */}
      <div
        className="anim-fade-up anim-fade-up-7"
        style={{ margin: '0 24px 40px', padding: '20px 24px', background: '#111111', border: '1px solid #1a1a1a', borderRadius: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            My Songs
          </p>
          <Link
            href={`/${locale}/artist/upload`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 12px',
              background: 'rgba(232,184,75,0.06)',
              border: '1px solid rgba(232,184,75,0.15)',
              borderRadius: 3,
              fontSize: '0.7rem',
              color: 'var(--gold)',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <Upload size={10} /> Upload
          </Link>
        </div>
        <div style={{
          padding: '28px 16px', textAlign: 'center',
          border: '1px dashed #1e1e1e', borderRadius: 6,
        }}>
          <Music2 size={26} style={{ color: 'rgba(232,184,75,0.18)', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '0.82rem', color: 'var(--muted-text)' }}>Song management available in Phase 5</p>
        </div>
      </div>
    </div>
  );
}
