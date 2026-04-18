'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Tags, Music2 } from 'lucide-react';
import { genresApi, type Genre } from '@/lib/api/genres.api';

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
    <main style={{ padding: '48px 40px', minHeight: '100vh', background: 'var(--charcoal)' }}>

      {/* Aurora orbs */}
      {[
        { top: '-10%', left: '-8%',  size: 500, color: 'rgba(232,184,75,0.05)',  anim: 'auroraShift1 20s ease-in-out infinite' },
        { bottom: '-15%', right: '10%', size: 380, color: 'rgba(232,184,75,0.03)', anim: 'auroraShift3 15s ease-in-out infinite' },
      ].map((orb, i) => (
        <div key={i} style={{
          position: 'fixed',
          ...(orb.top ? { top: orb.top } : { bottom: (orb as any).bottom }),
          ...(orb.left ? { left: orb.left } : { right: (orb as any).right }),
          width: orb.size, height: orb.size, borderRadius: '50%',
          background: orb.color, filter: 'blur(90px)',
          animation: orb.anim, pointerEvents: 'none', zIndex: 0,
          mixBlendMode: 'screen' as const,
        }} />
      ))}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Tags size={14} color="var(--gold)" />
            <p style={{
              fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--gold)',
            }}>
              Explore
            </p>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.025em', marginBottom: 10,
          }}>
            Browse by Genre
          </h1>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.9rem', maxWidth: 460 }}>
            Discover music across every sound. Pick a genre to explore.
          </p>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div className="vinyl-spin" style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
              border: '2px solid rgba(232,184,75,0.2)',
            }} />
          </div>
        )}

        {/* ── Genre grid ───────────────────────────────────────────────── */}
        {!loading && genres.length === 0 && (
          <div style={{
            padding: '64px 32px', textAlign: 'center',
            border: '1px dashed rgba(232,184,75,0.1)', borderRadius: 12,
            maxWidth: 420,
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

        {!loading && genres.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 14,
          }}>
            {genres.map((genre, idx) => (
              <Link
                key={genre.id}
                href={`/${locale}/browse?genre=${genre.id}`}
                className={`anim-fade-up anim-fade-up-${Math.min(idx + 1, 8)}`}
                style={{
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  padding: '22px 20px',
                  background: 'rgba(17,17,17,0.7)',
                  border: '1px solid rgba(232,184,75,0.07)',
                  borderRadius: 10,
                  textDecoration: 'none',
                  minHeight: 100,
                  position: 'relative', overflow: 'hidden',
                  transition: 'border-color 0.2s, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.28)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.07)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Subtle gradient corner accent */}
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  width: 80, height: 80,
                  background: 'radial-gradient(circle at top right, rgba(232,184,75,0.06), transparent)',
                  pointerEvents: 'none',
                }} />

                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.15rem', fontWeight: 400,
                  color: 'var(--ivory)', letterSpacing: '-0.01em',
                  lineHeight: 1.3,
                }}>
                  {genre.name}
                </p>

                {genre.description && (
                  <p style={{
                    color: 'var(--muted-text)', fontSize: '0.72rem', marginTop: 10,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                    lineHeight: 1.5,
                  }}>
                    {genre.description}
                  </p>
                )}

                {/* Browse caret */}
                <div style={{
                  marginTop: 14, display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'rgba(232,184,75,0.4)',
                }}>
                  <span>Browse</span>
                  <span style={{ fontSize: '0.8rem' }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
