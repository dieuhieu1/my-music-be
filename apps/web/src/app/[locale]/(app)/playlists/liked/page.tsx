'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Heart, Music2, Clock3 } from 'lucide-react';
import { playlistsApi, type Playlist, type PlaylistSongItem } from '@/lib/api/playlists.api';
import { songsApi } from '@/lib/api/songs.api';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePlayer } from '@/hooks/usePlayer';

const fmtDuration = (s: number | null) => {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const fmtHours = (h: number) => {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} hr`;
};

export default function LikedSongsPage() {
  const { locale } = useParams<{ locale: string }>();
  const { currentSong, isPlaying } = usePlayerStore();
  const { playWithContext } = usePlayer();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [unliking, setUnliking] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    playlistsApi.getLikedSongs()
      .then(r => setPlaylist(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePlay = (song: PlaylistSongItem, startIndex: number) => {
    if (song.isTakenDown || song.status !== 'LIVE') return;
    const items = (playlist?.songs ?? [])
      .filter(s => !s.isTakenDown && s.status === 'LIVE')
      .map(s => ({
        id: s.id,
        title: s.title,
        artistName: s.artistName ?? 'Unknown',
        coverArtUrl: s.coverArtUrl,
        fileUrl: '',
        durationSeconds: s.duration ?? 0,
      }));
    const actualIdx = items.findIndex(i => i.id === song.id);
    playWithContext(items, actualIdx >= 0 ? actualIdx : startIndex, 'PLAYLIST');
  };

  const handleUnlike = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    setUnliking(songId);
    try {
      await songsApi.unlikeSong(songId);
      setPlaylist(p => p ? {
        ...p,
        songs: p.songs?.filter(s => s.id !== songId),
        totalTracks: (p.totalTracks || 1) - 1,
      } : p);
    } finally {
      setUnliking(null);
    }
  };

  const songs = playlist?.songs ?? [];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--charcoal)' }}>
        <div className="vinyl-spin" style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
          border: '2px solid rgba(232,184,75,0.2)',
        }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--charcoal)' }}>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(232,50,80,0.12) 0%, rgba(13,13,13,0.95) 60%)',
        }} />
        {/* Aurora */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(232,50,80,0.06)', filter: 'blur(80px)', animation: 'auroraShift1 18s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '-10%', right: '5%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(232,184,75,0.04)', filter: 'blur(70px)', animation: 'auroraShift2 22s ease-in-out infinite' }} />
        </div>

        <div className="anim-hero-reveal" style={{ position: 'relative', zIndex: 1, padding: '48px 32px 40px', display: 'flex', gap: 28, alignItems: 'flex-end' }}>
          {/* Heart icon cover */}
          <div className="anim-scale-reveal" style={{
            width: 180, height: 180, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(232,50,80,0.25) 0%, rgba(180,20,60,0.4) 100%)',
            border: '1px solid rgba(232,50,80,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          }}>
            <Heart size={72} color="rgba(255,80,100,0.7)" fill="rgba(255,80,100,0.25)" />
          </div>

          <div>
            <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.45)', marginBottom: 8 }}>
              Your Playlist
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 400, color: 'var(--ivory)', lineHeight: 1.1 }}>
              Liked Songs
            </h1>
            <div style={{ display: 'flex', gap: 24, marginTop: 14, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Music2 size={13} color="rgba(232,184,75,0.5)" />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--gold)' }}>{playlist?.totalTracks ?? 0}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted-text)' }}>tracks</span>
              </span>
              {playlist && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock3 size={13} color="rgba(232,184,75,0.5)" />
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted-text)' }}>{fmtHours(playlist.totalHours)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #2a2520, transparent)', margin: '0 28px' }} />

      {/* Track list */}
      <div style={{ padding: '24px 20px 120px' }}>
        {songs.length === 0 && !loading && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <Heart size={44} color="rgba(255,80,100,0.15)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--muted-text)', fontSize: '0.85rem' }}>No liked songs yet</p>
            <p style={{ color: 'rgba(90,85,80,0.7)', fontSize: '0.75rem', marginTop: 6 }}>Songs you like will appear here</p>
          </div>
        )}

        {songs.map((song, i) => {
          const isActive = currentSong?.id === song.id;
          const unavailable = song.isTakenDown || song.status !== 'LIVE';

          return (
            <div
              key={song.playlistSongId}
              onClick={() => !unavailable && handlePlay(song, i)}
              className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '9px 14px', borderRadius: 6,
                cursor: unavailable ? 'default' : 'pointer',
                opacity: unavailable ? 0.38 : 1,
                background: isActive ? 'rgba(232,184,75,0.05)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                if (!unavailable) (e.currentTarget as HTMLElement).style.background =
                  isActive ? 'rgba(232,184,75,0.08)' : 'rgba(255,255,255,0.03)';
                const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-unlike-btn]');
                if (btn) btn.style.opacity = '1';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background =
                  isActive ? 'rgba(232,184,75,0.05)' : 'transparent';
                const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-unlike-btn]');
                if (btn) btn.style.opacity = '0';
              }}
            >
              {/* Number/waveBar */}
              <div style={{ width: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isActive && isPlaying ? (
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 14 }}>
                    {[0, 0.1, 0.2, 0.15, 0.05].map((delay, j) => (
                      <div key={j} style={{
                        width: 3, height: 14, borderRadius: 2,
                        background: 'var(--gold)',
                        animation: 'waveBar 0.8s ease-in-out infinite',
                        animationDelay: `${delay}s`,
                        transformOrigin: 'bottom',
                      }} />
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-display)', color: isActive ? 'var(--gold)' : 'var(--muted-text)' }}>
                    {i + 1}
                  </span>
                )}
              </div>

              {/* Cover */}
              <div style={{ width: 38, height: 38, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {song.coverArtUrl
                  ? <img src={song.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Music2 size={14} color="rgba(232,184,75,0.3)" />
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: isActive ? 'var(--gold)' : 'var(--ivory)', fontSize: '0.87rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
                  {song.title}
                </p>
                {song.artistName && (
                  <p style={{ color: 'var(--muted-text)', fontSize: '0.71rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {song.artistName}
                  </p>
                )}
              </div>

              {/* Duration */}
              <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-display)', color: 'var(--muted-text)', flexShrink: 0 }}>
                {fmtDuration(song.duration)}
              </span>

              {/* Unlike */}
              <button
                data-unlike-btn
                type="button"
                onClick={e => handleUnlike(e, song.id)}
                disabled={unliking === song.id}
                title="Unlike"
                style={{
                  opacity: 0, flexShrink: 0, background: 'none', border: 'none',
                  cursor: 'pointer', padding: 4, display: 'flex',
                  color: 'rgba(255,80,100,0.7)',
                  transition: 'opacity 0.15s',
                }}
              >
                <Heart size={14} fill="rgba(255,80,100,0.6)" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
