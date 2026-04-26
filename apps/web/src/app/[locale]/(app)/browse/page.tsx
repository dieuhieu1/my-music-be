'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Search, Compass } from 'lucide-react';
import { songsApi, type Song } from '@/lib/api/songs.api';
import { genresApi, type Genre } from '@/lib/api/genres.api';
import { SongCard } from '@/components/music/SongCard';
import { usePlayer } from '@/hooks/usePlayer';
import { useQueue } from '@/hooks/useQueue';
import type { PlayerSong } from '@/store/usePlayerStore';

const PAGE_SIZE = 24;

export default function BrowsePage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { playSong } = usePlayer();
  const { addToQueue } = useQueue();

  const [songs, setSongs]       = useState<Song[]>([]);
  const [genres, setGenres]     = useState<Genre[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [genre, setGenre]       = useState<string | null>(searchParams.get('genre'));
  const [loading, setLoading]   = useState(true);

  const fetchSongs = useCallback(async (p: number, g: string | null) => {
    setLoading(true);
    try {
      const res = await songsApi.browseSongs({ page: p, limit: PAGE_SIZE, ...(g ? { genre: g } : {}) });
      const d = (res.data as any).data ?? res.data;
      setSongs(d.items ?? d);
      setTotal(d.total ?? 0);
    } catch {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialGenre = searchParams.get('genre');
    genresApi.getGenres()
      .then(r => setGenres((r.data as any).data ?? r.data ?? []))
      .catch(() => {});
    fetchSongs(1, initialGenre);
  }, [fetchSongs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenre = (id: string | null) => {
    setGenre(id);
    setPage(1);
    fetchSongs(1, id);
  };

  const handlePage = (p: number) => {
    setPage(p);
    fetchSongs(p, genre);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlay = (song: PlayerSong) => playSong(song);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: '32px 32px 40px', position: 'relative', minHeight: '100%' }}>

      {/* Aurora background */}
      {[
        { top: '-15%', left: '-5%',  size: 480, color: 'rgba(232,184,75,0.055)', anim: 'auroraShift1 18s ease-in-out infinite' },
        { bottom: '-10%', right: '5%', size: 360, color: 'rgba(232,184,75,0.03)', anim: 'auroraShift2 22s ease-in-out infinite' },
      ].map((orb, i) => (
        <div key={i} style={{
          position: 'fixed',
          ...(orb.top ? { top: orb.top } : { bottom: (orb as any).bottom }),
          ...(orb.left ? { left: orb.left } : { right: (orb as any).right }),
          width: orb.size, height: orb.size, borderRadius: '50%',
          background: orb.color, filter: 'blur(80px)',
          animation: orb.anim, pointerEvents: 'none', zIndex: -1,
          mixBlendMode: 'screen' as const,
        }} />
      ))}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Compass size={14} color="var(--gold)" />
          <p style={{
            fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase',
            color: 'var(--gold)',
          }}>
            Discover
          </p>
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.8rem,4vw,2.6rem)',
          fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em', marginBottom: 8,
        }}>
          Explore
        </h1>

        {/* Search bar */}
        <div
          onClick={() => router.push(`/${locale}/browse/search`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(232,184,75,0.1)',
            borderRadius: 8, cursor: 'pointer', maxWidth: 400,
            transition: 'border-color 0.18s, background 0.18s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.25)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.1)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
          }}
        >
          <Search size={15} color="var(--muted-text)" />
          <span style={{ color: 'var(--muted-text)', fontSize: '0.84rem' }}>
            Search songs, albums, artists…
          </span>
        </div>
      </div>

      {/* ── Genre pills ────────────────────────────────────────────────────── */}
      {genres.length > 0 && (
        <div className="anim-fade-up anim-fade-up-2" style={{ marginBottom: 28 }}>
          <p style={{
            fontSize: '0.6rem', letterSpacing: '0.13em', textTransform: 'uppercase',
            color: 'rgba(232,184,75,0.4)', marginBottom: 10,
          }}>
            Filter by genre
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleGenre(null)}
              style={{
                padding: '5px 14px', borderRadius: 20,
                background: genre === null ? 'rgba(232,184,75,0.15)' : 'rgba(232,184,75,0.05)',
                border: `1px solid ${genre === null ? 'rgba(232,184,75,0.4)' : 'rgba(232,184,75,0.12)'}`,
                color: genre === null ? 'var(--gold)' : 'var(--muted-text)',
                fontSize: '0.72rem', cursor: 'pointer', letterSpacing: '0.04em',
                fontFamily: 'var(--font-body)',
                transition: 'all 0.15s',
              }}
            >
              All
            </button>
            {genres.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => handleGenre(g.id)}
                style={{
                  padding: '5px 14px', borderRadius: 20,
                  background: genre === g.id ? 'rgba(232,184,75,0.15)' : 'rgba(232,184,75,0.04)',
                  border: `1px solid ${genre === g.id ? 'rgba(232,184,75,0.4)' : 'rgba(232,184,75,0.1)'}`,
                  color: genre === g.id ? 'var(--gold)' : 'var(--muted-text)',
                  fontSize: '0.72rem', cursor: 'pointer', letterSpacing: '0.04em',
                  fontFamily: 'var(--font-body)', textTransform: 'uppercase' as const,
                  transition: 'all 0.15s',
                }}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Song grid ──────────────────────────────────────────────────────── */}
      <div className="anim-fade-up anim-fade-up-3" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{
            fontSize: '0.6rem', letterSpacing: '0.13em', textTransform: 'uppercase',
            color: 'rgba(232,184,75,0.4)',
          }}>
            {total > 0 ? (
              <><span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--gold)' }}>{total}</span> songs</>
            ) : 'Songs'}
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="vinyl-spin" style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
              border: '2px solid rgba(232,184,75,0.2)',
            }} />
          </div>
        ) : songs.length === 0 ? (
          <div style={{
            padding: '64px 32px', textAlign: 'center',
            border: '1px dashed rgba(232,184,75,0.1)', borderRadius: 10,
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--ivory)', marginBottom: 8 }}>
              No songs found
            </p>
            <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem' }}>
              Try a different genre or check back later.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
            gap: 14,
          }}>
            {songs.map((song, idx) => (
              <SongCard
                key={song.id}
                song={song}
                index={idx}
                onPlay={handlePlay}
                onAddToQueue={addToQueue}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, marginTop: 32,
        }}>
          <button
            type="button"
            onClick={() => handlePage(page - 1)}
            disabled={page === 1}
            style={{
              padding: '7px 16px', borderRadius: 4,
              background: 'transparent',
              border: '1px solid rgba(232,184,75,0.15)',
              color: page === 1 ? 'var(--muted-text)' : 'var(--ivory)',
              fontSize: '0.78rem', cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? 0.4 : 1, fontFamily: 'var(--font-body)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { if (page > 1) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.35)'; }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.15)'}
          >
            Previous
          </button>
          <span style={{
            fontSize: '0.75rem', color: 'var(--muted-text)', fontFamily: 'var(--font-display)',
            padding: '0 8px',
          }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => handlePage(page + 1)}
            disabled={page === totalPages}
            style={{
              padding: '7px 16px', borderRadius: 4,
              background: 'transparent',
              border: '1px solid rgba(232,184,75,0.15)',
              color: page === totalPages ? 'var(--muted-text)' : 'var(--ivory)',
              fontSize: '0.78rem', cursor: page === totalPages ? 'not-allowed' : 'pointer',
              opacity: page === totalPages ? 0.4 : 1, fontFamily: 'var(--font-body)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { if (page < totalPages) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.35)'; }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.15)'}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
