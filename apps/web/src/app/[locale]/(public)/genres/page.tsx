'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Music2 } from 'lucide-react';
import { genresApi, type Genre } from '@/lib/api/genres.api';
import PublicHeader from '@/components/layout/PublicHeader';

// Vivid genre card palettes — each is [gradientFrom, gradientTo, textAccent]
const PALETTES = [
  ['#7c3aed', '#4c1d95', '#c4b5fd'],  // violet
  ['#0e7490', '#164e63', '#67e8f9'],  // cyan
  ['#b45309', '#78350f', '#fcd34d'],  // amber
  ['#be123c', '#881337', '#fda4af'],  // rose
  ['#047857', '#064e3b', '#6ee7b7'],  // emerald
  ['#1d4ed8', '#1e3a8a', '#93c5fd'],  // blue
  ['#c2410c', '#7c2d12', '#fdba74'],  // orange
  ['#7e22ce', '#4a044e', '#e879f9'],  // purple
  ['#0f766e', '#134e4a', '#5eead4'],  // teal
  ['#9d174d', '#500724', '#f9a8d4'],  // pink
  ['#15803d', '#14532d', '#86efac'],  // green
  ['#b91c1c', '#7f1d1d', '#fca5a5'],  // red
  ['#4338ca', '#312e81', '#a5b4fc'],  // indigo
  ['#a16207', '#713f12', '#fde047'],  // yellow
  ['#0369a1', '#0c4a6e', '#7dd3fc'],  // sky
  ['#9333ea', '#581c87', '#d8b4fe'],  // fuchsia
];

function palette(idx: number) {
  return PALETTES[idx % PALETTES.length];
}

function GenreCard({ genre, locale, index }: { genre: Genre; locale: string; index: number }) {
  const [hovered, setHovered] = useState(false);
  const [from, to, accent] = palette(index);

  return (
    <Link
      href={`/${locale}/browse?genre=${genre.id}`}
      className={`anim-fade-up anim-fade-up-${Math.min(index + 1, 8)}`}
      style={{ textDecoration: 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        minHeight: 130,
        padding: '22px 20px 18px',
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        cursor: 'pointer',
        transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s',
        transform: hovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hovered
          ? `0 16px 40px ${from}55, 0 4px 12px rgba(0,0,0,0.4)`
          : '0 4px 16px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>

        {/* Noise overlay */}
        <div className="noise" style={{ borderRadius: 12, opacity: 0.35 }} />

        {/* Diagonal shine on hover */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(135deg, rgba(255,255,255,${hovered ? '0.12' : '0'}) 0%, transparent 60%)`,
          transition: 'background 0.25s',
          pointerEvents: 'none',
          borderRadius: 12,
        }} />

        {/* Big decorative music note */}
        <div style={{
          position: 'absolute', bottom: -10, right: -8,
          fontSize: '5.5rem', lineHeight: 1,
          color: 'rgba(255,255,255,0.1)',
          fontFamily: 'var(--font-display)',
          pointerEvents: 'none',
          userSelect: 'none',
          transform: hovered ? 'rotate(-8deg) scale(1.08)' : 'rotate(-12deg) scale(1)',
          transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          ♪
        </div>

        {/* Genre name */}
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1rem, 2vw, 1.25rem)',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
          position: 'relative', zIndex: 1,
          textShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}>
          {genre.name}
        </p>

        {/* Description */}
        {genre.description && (
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '0.68rem',
            marginTop: 6,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            lineHeight: 1.5,
            position: 'relative', zIndex: 1,
          }}>
            {genre.description}
          </p>
        )}

        {/* Browse pill */}
        <div style={{
          marginTop: 14,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 20,
          width: 'fit-content',
          position: 'relative', zIndex: 1,
          transition: 'background 0.2s',
        }}>
          <span style={{
            fontSize: '0.6rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', color: accent,
            fontWeight: 600,
          }}>
            Browse
          </span>
          <span style={{ color: accent, fontSize: '0.75rem' }}>→</span>
        </div>
      </div>
    </Link>
  );
}

export default function GenresPage() {
  const { locale } = useParams<{ locale: string }>();
  const [genres, setGenres]   = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    genresApi.getGenres()
      .then(r => setGenres((r.data as any).data ?? r.data ?? []))
      .catch(() => setGenres([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--charcoal)',
      color: 'var(--ivory)',
      fontFamily: 'var(--font-body)',
    }}>
      <PublicHeader locale={locale} />

      {/* Ambient orbs — more vivid this time */}
      {[
        { top: '-5%',  left: '-8%',  size: 520, color: 'rgba(124,58,237,0.08)'  },
        { top: '30%',  right: '-5%', size: 400, color: 'rgba(14,116,144,0.07)'  },
        { bottom: '5%', left: '20%', size: 360, color: 'rgba(190,18,60,0.06)'   },
      ].map((orb, i) => (
        <div key={i} style={{
          position: 'fixed',
          ...(orb.top    ? { top: orb.top }       : { bottom: (orb as any).bottom }),
          ...(orb.left   ? { left: orb.left }     : { right: (orb as any).right  }),
          width: orb.size, height: orb.size, borderRadius: '50%',
          background: orb.color, filter: 'blur(100px)',
          pointerEvents: 'none', zIndex: 0,
        }} />
      ))}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '68px 32px 80px' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="anim-fade-up anim-fade-up-1" style={{ padding: '48px 0 36px' }}>
          <p style={{
            fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--gold)', marginBottom: 8,
          }}>
            Explore
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem, 5vw, 3.4rem)',
            fontWeight: 300, color: 'var(--ivory)',
            letterSpacing: '-0.03em', marginBottom: 10,
          }}>
            Browse by Genre
          </h1>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.88rem', maxWidth: 440 }}>
            Discover music across every sound. Pick a genre to dive in.
          </p>
          {genres.length > 0 && (
            <p style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--muted-text)' }}>
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>
                {genres.length}
              </span> genres available
            </p>
          )}
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div className="vinyl-spin" style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
              border: '2px solid rgba(232,184,75,0.2)',
            }} />
          </div>
        )}

        {/* ── Empty ───────────────────────────────────────────────────────── */}
        {!loading && genres.length === 0 && (
          <div style={{
            padding: '64px 32px', textAlign: 'center',
            border: '1px dashed rgba(232,184,75,0.1)', borderRadius: 12, maxWidth: 420,
          }}>
            <Music2 size={32} color="rgba(232,184,75,0.15)" style={{ margin: '0 auto 16px' }} />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--ivory)', marginBottom: 8 }}>
              No genres yet
            </p>
            <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem' }}>
              Check back once artists have uploaded and classified their music.
            </p>
          </div>
        )}

        {/* ── Genre grid ──────────────────────────────────────────────────── */}
        {!loading && genres.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: 16,
          }}>
            {genres.map((genre, idx) => (
              <GenreCard key={genre.id} genre={genre} locale={locale} index={idx} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
