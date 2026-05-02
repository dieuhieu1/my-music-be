'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Music2, Disc3, Mic2 } from 'lucide-react';
import apiClient from '@/lib/api/axios';
import { SongRow } from '@/components/music/SongRow';
import { AlbumCard } from '@/components/music/AlbumCard';
import { usePlayer } from '@/hooks/usePlayer';
import { useQueue } from '@/hooks/useQueue';
import type { Song } from '@/lib/api/songs.api';
import type { Album } from '@/lib/api/albums.api';
import type { PlayerSong } from '@/store/usePlayerStore';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface ArtistResult {
  id: string;
  stageName: string;
  avatarUrl: string | null;
  followerCount: number;
}

interface SearchResults {
  songs: Song[];
  albums: Album[];
  artists: ArtistResult[];
}

function EmptySection({ label }: { label: string }) {
  return (
    <p style={{ color: 'var(--muted-text)', fontSize: '0.8rem', padding: '16px 0' }}>
      No {label} found.
    </p>
  );
}

export default function SearchPage() {
  const { locale } = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const { playWithContext } = usePlayer();
  const { addToQueue } = useQueue();

  const [query, setQuery]     = useState(searchParams.get('q') ?? '');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await apiClient.get('/search', { params: { q: q.trim(), limit: 8 } });
      const d = (res.data as any).data ?? res.data;
      setResults({
        songs:   d.songs   ?? [],
        albums:  d.albums  ?? [],
        artists: d.artists ?? [],
      });
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setQuery(q); doSearch(q); }
  }, [searchParams, doSearch]);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 320);
  };

  const handlePlay = (song: PlayerSong) => {
    if (!results) return;
    const items = results.songs.map(s => ({
      id: s.id,
      title: s.title,
      artistName: s.artistName ?? 'Unknown',
      coverArtUrl: s.coverArtUrl,
      fileUrl: '',
      durationSeconds: s.duration ?? 0,
    }));
    const idx = items.findIndex(i => i.id === song.id);
    playWithContext(items, idx >= 0 ? idx : 0, 'SEARCH');
  };

  const hasResults = results && (
    results.songs.length > 0 || results.albums.length > 0 || results.artists.length > 0
  );

  return (
    <div style={{ padding: '32px 32px 40px' }}>

      {/* ── Header + search input ─────────────────────────────────────────── */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 32 }}>
        <p style={{
          fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase',
          color: 'var(--gold)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Search size={12} /> Search
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.6rem,3.5vw,2.4rem)',
          fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em', marginBottom: 20,
        }}>
          Find anything
        </h1>

        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 18px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(232,184,75,0.15)',
          borderRadius: 8, maxWidth: 520,
          transition: 'border-color 0.18s',
        }}
        onFocus={(e: any) => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.4)')}
        onBlur={(e: any) => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.15)')}
        >
          <Search size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
          <input
            autoFocus
            type="text"
            placeholder="Songs, albums, artists…"
            value={query}
            onChange={e => handleInput(e.target.value)}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--ivory)', fontSize: '0.95rem', fontFamily: 'var(--font-body)',
            }}
          />
          {loading && (
            <div className="vinyl-spin" style={{
              width: 16, height: 16, borderRadius: '50%',
              border: '2px solid rgba(232,184,75,0.2)',
              borderTopColor: 'var(--gold)', flexShrink: 0,
            }} />
          )}
        </div>
      </div>

      {/* ── Empty prompt ─────────────────────────────────────────────────── */}
      {!query && (
        <div className="anim-fade-up anim-fade-up-2" style={{
          padding: '48px 32px', textAlign: 'center',
          border: '1px dashed rgba(232,184,75,0.1)', borderRadius: 10,
          maxWidth: 480,
        }}>
          <Search size={28} color="rgba(232,184,75,0.2)" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--ivory)', marginBottom: 8 }}>
            Start typing to search
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.8rem' }}>
            Search across songs, albums, and artists.
          </p>
        </div>
      )}

      {/* ── No results ───────────────────────────────────────────────────── */}
      {query && !loading && results && !hasResults && (
        <div className="anim-fade-up anim-fade-up-2" style={{
          padding: '48px 32px', textAlign: 'center',
          border: '1px dashed rgba(232,184,75,0.1)', borderRadius: 10,
          maxWidth: 480,
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--ivory)', marginBottom: 8 }}>
            Nothing found
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.8rem' }}>
            Try a different search term.
          </p>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {results && hasResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          {/* Songs */}
          {results.songs.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Music2 size={14} color="var(--gold)" />
                <p style={{
                  fontSize: '0.6rem', letterSpacing: '0.13em', textTransform: 'uppercase',
                  color: 'rgba(232,184,75,0.5)',
                }}>
                  Songs
                </p>
              </div>
              <div style={{
                background: 'rgba(17,17,17,0.5)',
                border: '1px solid rgba(232,184,75,0.06)',
                borderRadius: 8, overflow: 'hidden', padding: '4px 0',
              }}>
                {results.songs.map((song, idx) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    index={idx}
                    onPlay={handlePlay}
                    onAddToQueue={addToQueue}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Albums */}
          {results.albums.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Disc3 size={14} color="var(--gold)" />
                <p style={{
                  fontSize: '0.6rem', letterSpacing: '0.13em', textTransform: 'uppercase',
                  color: 'rgba(232,184,75,0.5)',
                }}>
                  Albums
                </p>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 12,
              }}>
                {results.albums.map((album, idx) => (
                  <AlbumCard key={album.id} album={album} index={idx} />
                ))}
              </div>
            </section>
          )}

          {/* Artists */}
          {results.artists.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Mic2 size={14} color="var(--gold)" />
                <p style={{
                  fontSize: '0.6rem', letterSpacing: '0.13em', textTransform: 'uppercase',
                  color: 'rgba(232,184,75,0.5)',
                }}>
                  Artists
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {results.artists.map((artist, idx) => (
                  <Link
                    key={artist.id}
                    href={`/${locale}/artists/${artist.id}`}
                    className={`anim-fade-up anim-fade-up-${Math.min(idx + 1, 8)}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px',
                      background: 'rgba(17,17,17,0.6)',
                      border: '1px solid rgba(232,184,75,0.07)',
                      borderRadius: 8, textDecoration: 'none', minWidth: 200,
                      transition: 'border-color 0.18s, transform 0.2s cubic-bezier(0.16,1,0.3,1)',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.22)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.07)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    }}
                  >
                    {artist.avatarUrl ? (
                      <img
                        src={artist.avatarUrl} alt={artist.stageName}
                        className="avatar-ring-pulse"
                        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(232,184,75,0.1)', border: '1px solid rgba(232,184,75,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Mic2 size={16} color="var(--gold)" />
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        color: 'var(--ivory)', fontSize: '0.87rem', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {artist.stageName}
                      </p>
                      <p style={{ color: 'var(--muted-text)', fontSize: '0.69rem', marginTop: 2 }}>
                        <span style={{ fontFamily: 'var(--font-display)' }}>{artist.followerCount}</span> followers
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
