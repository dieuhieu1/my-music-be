'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Disc3, Play, Music2, Clock3, Calendar } from 'lucide-react';
import { albumsApi, type Album } from '@/lib/api/albums.api';
import { usePlayer } from '@/hooks/usePlayer';
import { useQueue } from '@/hooks/useQueue';
import { usePlayerStore } from '@/store/usePlayerStore';
import { SongRow } from '@/components/music/SongRow';
import type { Song } from '@/lib/api/songs.api';

function fmtDuration(s: number | null) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function fmtHours(h: number) {
  if (h < 1 / 60) return '< 1 min';
  if (h < 1) return `${Math.round(h * 60)} min`;
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export default function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { playWithContext } = usePlayer();
  const { addToQueue } = useQueue();
  const { currentSong } = usePlayerStore();

  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    albumsApi.getAlbum(id)
      .then(r => {
        const d = (r.data as any).data ?? r.data;
        setAlbum(d);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePlayTrack = (track: NonNullable<Album['tracks']>[number], startIndex: number) => {
    if (track.status !== 'LIVE') return;
    const items = (album?.tracks ?? [])
      .filter(t => t.status === 'LIVE')
      .map(t => ({
        id: t.songId,
        title: t.title ?? 'Untitled',
        artistName: album?.artistName ?? '',
        coverArtUrl: album?.coverArtUrl ?? null,
        fileUrl: '',
        durationSeconds: t.duration ?? 0,
      }));
    const actualIdx = items.findIndex(i => i.id === track.songId);
    playWithContext(items, actualIdx >= 0 ? actualIdx : startIndex, 'ALBUM');
  };

  const handlePlayAll = () => {
    const validTracks = album?.tracks?.filter(t => t.status === 'LIVE') ?? [];
    if (validTracks.length > 0) {
      handlePlayTrack(validTracks[0], 0);
    }
  };

  const tracks = album?.tracks ?? [];
  const liveTracks = tracks.filter(t => t.status === 'LIVE');

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="vinyl-spin" style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
          border: '2px solid rgba(232,184,75,0.2)',
        }} />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div style={{ padding: '64px 32px', textAlign: 'center' }}>
        <Disc3 size={40} color="rgba(232,184,75,0.2)" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--ivory)', marginBottom: 8 }}>
          Album not found
        </p>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem' }}>
          This album may have been removed or is unavailable.
        </p>
      </div>
    );
  }

  const releaseYear = album.releasedAt ? new Date(album.releasedAt).getFullYear() : null;

  return (
    <div style={{ position: 'relative' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>

        {/* Blurred background art */}
        {album.coverArtUrl && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: `url(${album.coverArtUrl})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'blur(60px)',
            transform: 'scale(1.2)',
            opacity: 0.18,
          }} />
        )}

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(to bottom, rgba(13,13,13,0.5) 0%, rgba(13,13,13,0.92) 70%, #0d0d0d 100%)',
        }} />

        {/* Aurora orbs */}
        {[
          { top: '-20%', left: '-5%',  size: 400, color: 'rgba(232,184,75,0.06)',  anim: 'auroraShift1 18s ease-in-out infinite' },
          { bottom: '-10%', right: '5%', size: 300, color: 'rgba(232,184,75,0.04)', anim: 'auroraShift2 22s ease-in-out infinite' },
        ].map((orb, i) => (
          <div key={i} style={{
            position: 'absolute', zIndex: 0,
            ...(orb.top ? { top: orb.top } : { bottom: (orb as any).bottom }),
            ...(orb.left ? { left: orb.left } : { right: (orb as any).right }),
            width: orb.size, height: orb.size, borderRadius: '50%',
            background: orb.color, filter: 'blur(80px)',
            animation: orb.anim, pointerEvents: 'none',
            mixBlendMode: 'screen' as const,
          }} />
        ))}

        {/* Hero content */}
        <div className="anim-hero-reveal" style={{
          position: 'relative', zIndex: 2,
          padding: '48px 40px 40px',
          display: 'flex', alignItems: 'flex-end', gap: 32,
        }}>
          {/* Album art */}
          <div className="anim-scale-reveal" style={{ flexShrink: 0 }}>
            <div style={{
              width: 200, height: 200, borderRadius: 10, overflow: 'hidden',
              border: '1px solid rgba(232,184,75,0.2)',
              background: 'rgba(232,184,75,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}>
              {album.coverArtUrl
                ? <img src={album.coverArtUrl} alt={album.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Disc3 size={64} color="rgba(232,184,75,0.2)" />
              }
            </div>
          </div>

          {/* Album metadata */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--gold)', marginBottom: 10,
            }}>
              Album
            </p>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.8rem, 5vw, 3rem)',
              fontWeight: 400, color: 'var(--ivory)', letterSpacing: '-0.02em',
              lineHeight: 1.1, marginBottom: 12,
            }}>
              {album.title}
            </h1>

            {album.description && (
              <p style={{
                color: 'var(--muted-text)', fontSize: '0.83rem', maxWidth: 500,
                lineHeight: 1.6, marginBottom: 14,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
              }}>
                {album.description}
              </p>
            )}

            {/* Stats row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Music2 size={12} color="rgba(232,184,75,0.5)" />
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--gold)',
                }}>
                  {album.totalTracks}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted-text)' }}>
                  {album.totalTracks === 1 ? 'track' : 'tracks'}
                </span>
              </div>

              {album.totalHours > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock3 size={12} color="rgba(232,184,75,0.5)" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted-text)' }}>
                    {fmtHours(album.totalHours)}
                  </span>
                </div>
              )}

              {releaseYear && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={12} color="rgba(232,184,75,0.5)" />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.92rem', color: 'var(--muted-text)' }}>
                    {releaseYear}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 40px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        {liveTracks.length > 0 && (
          <button
            type="button"
            onClick={handlePlayAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '10px 22px', borderRadius: 24,
              background: 'var(--gold)', border: 'none', cursor: 'pointer',
              color: '#0d0d0d', fontSize: '0.82rem', fontWeight: 600,
              fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
              boxShadow: '0 0 20px rgba(232,184,75,0.3)',
              transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.04)';
              e.currentTarget.style.boxShadow = '0 0 32px rgba(232,184,75,0.5)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(232,184,75,0.3)';
            }}
          >
            <Play size={15} fill="#0d0d0d" />
            Play All
          </button>
        )}
      </div>

      {/* ── Track list ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 40px 60px' }}>
        {tracks.length === 0 ? (
          <div className="anim-fade-up anim-fade-up-1" style={{
            padding: '48px 24px', textAlign: 'center',
            border: '1px dashed rgba(232,184,75,0.1)', borderRadius: 10,
          }}>
            <Music2 size={28} color="rgba(232,184,75,0.15)" style={{ margin: '0 auto 14px' }} />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--ivory)', marginBottom: 6 }}>
              No tracks yet
            </p>
            <p style={{ color: 'var(--muted-text)', fontSize: '0.8rem' }}>
              This album has no published tracks.
            </p>
          </div>
        ) : (
          <>
            {/* Column header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '28px 1fr 80px',
              gap: 12, padding: '0 14px 8px',
              fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'rgba(90,85,80,0.5)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              marginBottom: 4,
            }}>
              <div>#</div>
              <div>Title</div>
              <div style={{ textAlign: 'right' }}>Duration</div>
            </div>

            <div style={{
              background: 'rgba(17,17,17,0.4)',
              border: '1px solid rgba(232,184,75,0.06)',
              borderRadius: 10, overflow: 'hidden', padding: '4px 0',
            }}>
              {tracks.map((track, idx) => {
                const isActive = currentSong?.id === track.songId;
                const isLive = track.status === 'LIVE';
                return (
                  <div
                    key={track.songId}
                    className={`anim-fade-up anim-fade-up-${Math.min(idx + 1, 8)}`}
                    onClick={() => isLive && handlePlayTrack(track, idx)}
                    style={{
                      display: 'grid', gridTemplateColumns: '28px 1fr 80px',
                      gap: 12, padding: '10px 14px', alignItems: 'center',
                      background: isActive ? 'rgba(232,184,75,0.05)' : 'transparent',
                      cursor: isLive ? 'pointer' : 'default',
                      opacity: isLive ? 1 : 0.4,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (isLive) (e.currentTarget as HTMLElement).style.background =
                        isActive ? 'rgba(232,184,75,0.08)' : 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background =
                        isActive ? 'rgba(232,184,75,0.05)' : 'transparent';
                    }}
                  >
                    {/* Position / waveBar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isActive ? (
                        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 12 }}>
                          {[0, 0.1, 0.2, 0.15, 0.05].map((delay, i) => (
                            <div key={i} style={{
                              width: 3, height: 12, borderRadius: 2,
                              background: 'var(--gold)',
                              animation: 'waveBar 0.8s ease-in-out infinite',
                              animationDelay: `${delay}s`,
                              transformOrigin: 'bottom',
                            }} />
                          ))}
                        </div>
                      ) : (
                        <span style={{
                          fontSize: '0.73rem', fontFamily: 'var(--font-display)',
                          color: isActive ? 'var(--gold)' : 'var(--muted-text)',
                        }}>
                          {track.position}
                        </span>
                      )}
                    </div>

                    {/* Title + metadata */}
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        color: isActive ? 'var(--gold)' : 'var(--ivory)',
                        fontSize: '0.87rem', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        transition: 'color 0.15s',
                      }}>
                        {track.title ?? 'Untitled'}
                      </p>
                      {(track.bpm || track.camelotKey) && (
                        <p style={{ color: 'var(--muted-text)', fontSize: '0.68rem', marginTop: 2 }}>
                          {[track.bpm && `${track.bpm} BPM`, track.camelotKey].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>

                    {/* Duration */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '0.74rem', fontFamily: 'var(--font-display)',
                        color: 'var(--muted-text)',
                      }}>
                        {fmtDuration(track.duration)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
