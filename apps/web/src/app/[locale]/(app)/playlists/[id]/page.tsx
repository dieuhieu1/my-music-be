'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ListMusic, Play, Clock3, Music2, Pencil, Trash2,
  BookmarkPlus, BookmarkCheck, Heart, Plus, Search, Check, X,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { playlistsApi, type Playlist, type PlaylistSongItem } from '@/lib/api/playlists.api';
import { songsApi, type Song } from '@/lib/api/songs.api';
import { usePlayerStore, type PlayerSong } from '@/store/usePlayerStore';
import { usePlayer } from '@/hooks/usePlayer';
import { useAuthStore } from '@/store/useAuthStore';

const fmtDuration = (s: number | null) => {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const fmtHours = (h: number) => {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} hr`;
};

// ── Add Songs Modal ───────────────────────────────────────────────────────────

interface AddSongsModalProps {
  open: boolean;
  onClose: () => void;
  playlistId: string;
  existingSongIds: Set<string>;
  onSongAdded: () => void;
}

function AddSongsModal({ open, onClose, playlistId, existingSongIds, onSongAdded }: AddSongsModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setAddedIds(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await songsApi.browseSongs({ q: query, limit: 20 });
        const body = (res.data as any)?.data ?? res.data;
        setResults(body?.items ?? body ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleAdd = async (song: Song) => {
    if (addedIds.has(song.id) || existingSongIds.has(song.id) || adding === song.id) return;
    setAdding(song.id);
    try {
      await playlistsApi.addSong(playlistId, song.id);
      setAddedIds(prev => new Set(prev).add(song.id));
      onSongAdded();
    } catch { /* silent — button stays enabled for retry */ }
    finally { setAdding(null); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(6px)',
        }} />
        <Dialog.Content style={{
          position: 'fixed', top: '50%', left: '50%', zIndex: 101,
          transform: 'translate(-50%, -50%)',
          width: 'min(540px, 92vw)',
          background: 'var(--surface)',
          border: '1px solid rgba(232,184,75,0.12)',
          borderRadius: 10,
          backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '85vh',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px 14px',
            borderBottom: '1px solid rgba(232,184,75,0.08)',
            flexShrink: 0,
          }}>
            <Dialog.Title style={{
              fontFamily: 'var(--font-display)', fontSize: '1.1rem',
              fontWeight: 400, color: 'var(--ivory)', margin: 0,
            }}>
              Add Songs
            </Dialog.Title>
            <Dialog.Close asChild>
              <button style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted-text)', padding: 4, display: 'flex',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--ivory)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; }}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Search input */}
          <div style={{ padding: '14px 20px 10px', position: 'relative', flexShrink: 0 }}>
            <Search
              size={14}
              style={{
                position: 'absolute', left: 32, top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted-text)', pointerEvents: 'none',
              }}
            />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search songs…"
              autoFocus
              style={{
                width: '100%', paddingLeft: 36, paddingRight: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(232,184,75,0.12)',
                borderRadius: 6,
                color: 'var(--ivory)',
                fontSize: '0.88rem',
                height: 40,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'var(--font-body)',
                transition: 'border-color 0.18s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.35)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.12)'; }}
            />
          </div>

          {/* Results */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0 16px' }}>
            {searching && (
              <div style={{ textAlign: 'center', padding: 28, color: 'var(--muted-text)', fontSize: '0.8rem' }}>
                Searching…
              </div>
            )}
            {!searching && query.trim() && results.length === 0 && (
              <div style={{ textAlign: 'center', padding: 28, color: 'var(--muted-text)', fontSize: '0.8rem' }}>
                No songs found
              </div>
            )}
            {!searching && !query.trim() && (
              <div style={{ textAlign: 'center', padding: 28, color: 'rgba(90,85,80,0.7)', fontSize: '0.78rem' }}>
                Type to search songs
              </div>
            )}
            {results.map(song => {
              const alreadyIn = existingSongIds.has(song.id) || addedIds.has(song.id);
              const isAdding = adding === song.id;
              return (
                <div
                  key={song.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 20px',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 4, flexShrink: 0,
                    overflow: 'hidden', background: 'rgba(232,184,75,0.05)',
                    border: '1px solid rgba(232,184,75,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {song.coverArtUrl
                      ? <img src={song.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Music2 size={14} color="rgba(232,184,75,0.3)" />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--ivory)', fontSize: '0.86rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {song.title}
                    </p>
                    {song.artistName && (
                      <p style={{ color: 'var(--muted-text)', fontSize: '0.7rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {song.artistName}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAdd(song)}
                    disabled={alreadyIn || isAdding}
                    style={{
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 4,
                      border: alreadyIn ? '1px solid rgba(232,184,75,0.2)' : '1px solid rgba(232,184,75,0.35)',
                      background: 'transparent',
                      color: alreadyIn ? 'var(--gold)' : 'var(--ivory)',
                      fontSize: '0.75rem',
                      cursor: alreadyIn ? 'default' : isAdding ? 'not-allowed' : 'pointer',
                      transition: 'border-color 0.15s, color 0.15s',
                      opacity: isAdding ? 0.6 : 1,
                    }}
                  >
                    {alreadyIn ? <><Check size={11} /> Added</> : <><Plus size={11} /> Add</>}
                  </button>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlaylistDetailPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentSong, isPlaying } = usePlayerStore();
  const { playSong } = usePlayer();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(new Set());
  const [liking, setLiking] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    playlistsApi.getPlaylist(id)
      .then(r => setPlaylist(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Fetch liked song IDs for non-owners so Heart buttons reflect current state
  useEffect(() => {
    if (!playlist || !user || playlist.userId === user.id) return;
    playlistsApi.getLikedSongs()
      .then(r => {
        const liked: PlaylistSongItem[] = r.data?.songs ?? [];
        setLikedSongIds(new Set(liked.map(s => s.id)));
      })
      .catch(() => {});
  }, [playlist?.id, user?.id]);

  const handlePlay = (song: PlaylistSongItem) => {
    if (song.isTakenDown || song.status !== 'LIVE') return;
    playSong({
      id: song.id,
      title: song.title,
      artistName: song.artistName ?? 'Unknown',
      coverArtUrl: song.coverArtUrl,
      fileUrl: '',
      durationSeconds: song.duration ?? 0,
    });
  };

  const handlePlayAll = () => {
    const first = playlist?.songs?.find(s => !s.isTakenDown && s.status === 'LIVE');
    if (first) handlePlay(first);
  };

  const handleSave = async () => {
    if (!playlist) return;
    setSaving(true);
    try {
      if (playlist.isSaved) {
        await playlistsApi.unsavePlaylist(id);
        setPlaylist(p => p ? { ...p, isSaved: false } : p);
      } else {
        await playlistsApi.savePlaylist(id);
        setPlaylist(p => p ? { ...p, isSaved: true } : p);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this playlist? This cannot be undone.')) return;
    await playlistsApi.deletePlaylist(id);
    router.push(`/${locale}/playlists`);
  };

  const handleRemoveSong = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    setRemoving(songId);
    setPlaylist(p => p ? {
      ...p,
      songs: (p.songs ?? []).filter(s => s.id !== songId),
      totalTracks: Math.max(0, p.totalTracks - 1),
    } : p);
    try {
      await playlistsApi.removeSong(id, songId);
    } catch { load(); } // rollback via re-fetch on failure
    finally { setRemoving(null); }
  };

  const handleToggleLike = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    if (!user) return;
    setLiking(songId);
    const wasLiked = likedSongIds.has(songId);
    setLikedSongIds(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(songId) : next.add(songId);
      return next;
    });
    try {
      wasLiked ? await songsApi.unlikeSong(songId) : await songsApi.likeSong(songId);
    } catch {
      setLikedSongIds(prev => {
        const next = new Set(prev);
        wasLiked ? next.add(songId) : next.delete(songId);
        return next;
      });
    } finally { setLiking(null); }
  };

  const handleSongAdded = () =>
    setPlaylist(p => p ? { ...p, totalTracks: p.totalTracks + 1 } : p);

  const isOwner = !!(playlist && user && playlist.userId === user.id);
  const showActionCol = isOwner || !!user;
  const gridCols = showActionCol ? '28px 38px 1fr 72px 32px' : '28px 38px 1fr 72px';
  const songs = playlist?.songs ?? [];
  const coverUrl = playlist?.coverArtUrl;
  const existingSongIds = new Set(songs.map(s => s.id));

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

  if (!playlist) {
    return (
      <div style={{ padding: 40, color: 'var(--muted-text)' }}>Playlist not found.</div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--charcoal)' }}>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {coverUrl && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'blur(55px)', transform: 'scale(1.15)',
            opacity: 0.25,
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(13,13,13,0.4) 0%, rgba(13,13,13,0.92) 60%, #0d0d0d 100%)',
        }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(232,184,75,0.06)', filter: 'blur(80px)', animation: 'auroraShift1 18s ease-in-out infinite' }} />
        </div>

        <div className="anim-hero-reveal" style={{ position: 'relative', zIndex: 1, padding: '48px 32px 36px', display: 'flex', gap: 32, alignItems: 'flex-end' }}>
          {/* Cover art */}
          <div className="anim-scale-reveal" style={{
            width: 200, height: 200, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
            background: 'rgba(232,184,75,0.05)',
            border: '1px solid rgba(232,184,75,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          }}>
            {coverUrl
              ? <img src={coverUrl} alt={playlist.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <ListMusic size={64} color="rgba(232,184,75,0.2)" />
            }
          </div>

          {/* Meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.45)', marginBottom: 8 }}>
              {playlist.isLikedSongs ? 'Liked Songs' : playlist.isPublic ? 'Public Playlist' : 'Private Playlist'}
            </p>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.8rem)',
              fontWeight: 400, color: 'var(--ivory)', lineHeight: 1.1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {playlist.title}
            </h1>
            {playlist.description && (
              <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', marginTop: 8, lineHeight: 1.5 }}>
                {playlist.description}
              </p>
            )}

            {/* Stats */}
            <div style={{ display: 'flex', gap: 24, marginTop: 16, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Music2 size={13} color="rgba(232,184,75,0.5)" />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--gold)' }}>{playlist.totalTracks}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted-text)' }}>tracks</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock3 size={13} color="rgba(232,184,75,0.5)" />
                <span style={{ fontSize: '0.7rem', color: 'var(--muted-text)' }}>{fmtHours(playlist.totalHours)}</span>
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handlePlayAll}
                disabled={songs.filter(s => !s.isTakenDown && s.status === 'LIVE').length === 0}
                className="btn-gold"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px', borderRadius: 6, border: 'none',
                  cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500,
                }}
              >
                <Play size={15} fill="currentColor" />
                Play All
              </button>

              {/* Add Songs — owner only, not for Liked Songs playlist */}
              {isOwner && !playlist.isLikedSongs && (
                <button
                  onClick={() => setAddModalOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid rgba(232,184,75,0.2)',
                    cursor: 'pointer', fontSize: '0.82rem', color: 'var(--ivory)',
                    transition: 'border-color 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.45)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.2)'; }}
                >
                  <Plus size={13} /> Add Songs
                </button>
              )}

              {!isOwner && !playlist.isLikedSongs && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 18px', borderRadius: 6,
                    background: 'transparent',
                    border: `1px solid ${playlist.isSaved ? 'rgba(232,184,75,0.5)' : 'rgba(232,184,75,0.2)'}`,
                    cursor: 'pointer', fontSize: '0.83rem',
                    color: playlist.isSaved ? 'var(--gold)' : 'var(--ivory)',
                    transition: 'border-color 0.18s, color 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = playlist.isSaved ? 'rgba(232,184,75,0.5)' : 'rgba(232,184,75,0.2)'; }}
                >
                  {playlist.isSaved ? <BookmarkCheck size={15} /> : <BookmarkPlus size={15} />}
                  {playlist.isSaved ? 'Saved' : 'Save'}
                </button>
              )}

              {isOwner && (
                <>
                  <button
                    onClick={() => router.push(`/${locale}/playlists/${id}/edit`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '9px 16px', borderRadius: 6,
                      background: 'transparent',
                      border: '1px solid rgba(232,184,75,0.15)',
                      cursor: 'pointer', fontSize: '0.82rem', color: 'var(--ivory)',
                      transition: 'border-color 0.18s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.15)'; }}
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  {!playlist.isLikedSongs && (
                    <button
                      onClick={handleDelete}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '9px 16px', borderRadius: 6,
                        background: 'transparent',
                        border: '1px solid rgba(220,50,50,0.2)',
                        cursor: 'pointer', fontSize: '0.82rem', color: 'rgba(220,80,80,0.8)',
                        transition: 'border-color 0.18s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(220,50,50,0.5)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(220,50,50,0.2)'; }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #2a2520, transparent)', margin: '0 28px' }} />

      {/* ── Track list ─────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 20px 120px' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          gap: 14, padding: '0 14px 8px',
          borderBottom: '1px solid rgba(232,184,75,0.06)',
          marginBottom: 4,
        }}>
          {['#', '', 'TITLE', 'DURATION', ...(showActionCol ? [''] : [])].map((h, i) => (
            <span key={i} style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.3)' }}>
              {h}
            </span>
          ))}
        </div>

        {songs.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <Music2 size={40} color="rgba(232,184,75,0.12)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--muted-text)', fontSize: '0.85rem' }}>No songs in this playlist yet</p>
            {isOwner && !playlist.isLikedSongs && (
              <button
                onClick={() => setAddModalOpen(true)}
                className="btn-gold"
                style={{ marginTop: 16, padding: '9px 22px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.83rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={13} /> Add Songs
              </button>
            )}
          </div>
        )}

        {songs.map((song, i) => {
          const isActive = currentSong?.id === song.id;
          const unavailable = song.isTakenDown || song.status !== 'LIVE';
          // Remove: show for owner always, or for anyone on TAKEN_DOWN rows (BL-16)
          const showRemoveBtn = isOwner || song.isTakenDown;
          // Like: show for non-owner authenticated users on LIVE songs only
          const showLikeBtn = !isOwner && !!user && !song.isTakenDown && song.status === 'LIVE';

          return (
            <div
              key={song.playlistSongId}
              onClick={() => !unavailable && handlePlay(song)}
              className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                gap: 14, padding: '9px 14px', borderRadius: 6,
                cursor: unavailable ? 'default' : 'pointer',
                opacity: unavailable ? 0.38 : 1,
                background: isActive ? 'rgba(232,184,75,0.05)' : 'transparent',
                transition: 'background 0.15s, opacity 0.15s',
                alignItems: 'center',
              }}
              onMouseEnter={e => {
                if (!unavailable) (e.currentTarget as HTMLElement).style.background =
                  isActive ? 'rgba(232,184,75,0.08)' : 'rgba(255,255,255,0.03)';
                const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
                  '[data-remove-btn],[data-like-btn]'
                );
                if (btn) btn.style.opacity = '1';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background =
                  isActive ? 'rgba(232,184,75,0.05)' : 'transparent';
                const btn = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
                  '[data-remove-btn],[data-like-btn]'
                );
                if (btn) btn.style.opacity = '0';
              }}
            >
              {/* Track number / waveBar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  <span style={{
                    fontSize: '0.75rem', fontFamily: 'var(--font-display)',
                    color: isActive ? 'var(--gold)' : 'var(--muted-text)',
                  }}>
                    {song.position}
                  </span>
                )}
              </div>

              {/* Cover art */}
              <div style={{
                width: 38, height: 38, borderRadius: 4, overflow: 'hidden',
                background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {song.coverArtUrl
                  ? <img src={song.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Music2 size={14} color="rgba(232,184,75,0.3)" />
                }
              </div>

              {/* Title + artist + taken-down badge */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{
                    color: isActive ? 'var(--gold)' : 'var(--ivory)',
                    fontSize: '0.87rem', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    transition: 'color 0.15s',
                  }}>
                    {song.title}
                  </p>
                  {song.isTakenDown && (
                    <span style={{
                      fontSize: '0.55rem', letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'rgba(220,80,80,0.7)', border: '1px solid rgba(220,80,80,0.25)',
                      padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                    }}>
                      Removed
                    </span>
                  )}
                </div>
                {song.artistName && (
                  <p style={{ color: 'var(--muted-text)', fontSize: '0.71rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {song.artistName}
                  </p>
                )}
              </div>

              {/* Duration */}
              <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-display)', color: 'var(--muted-text)' }}>
                {fmtDuration(song.duration)}
              </span>

              {/* Action column */}
              {showActionCol && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showRemoveBtn ? (
                    <button
                      data-remove-btn
                      type="button"
                      onClick={e => handleRemoveSong(e, song.id)}
                      disabled={removing === song.id}
                      title="Remove from playlist"
                      style={{
                        opacity: 0,
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 4, display: 'flex',
                        color: 'rgba(220,80,80,0.6)',
                        transition: 'opacity 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'rgba(220,80,80,0.9)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(220,80,80,0.6)'; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : showLikeBtn ? (
                    <button
                      data-like-btn
                      type="button"
                      onClick={e => handleToggleLike(e, song.id)}
                      disabled={liking === song.id}
                      title={likedSongIds.has(song.id) ? 'Unlike' : 'Like'}
                      style={{
                        opacity: 0,
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 4, display: 'flex',
                        color: likedSongIds.has(song.id) ? 'rgba(255,80,100,0.7)' : 'var(--muted-text)',
                        transition: 'opacity 0.15s, color 0.15s',
                      }}
                    >
                      <Heart
                        size={13}
                        fill={likedSongIds.has(song.id) ? 'rgba(255,80,100,0.6)' : 'none'}
                      />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Songs Modal */}
      <AddSongsModal
        open={addModalOpen}
        onClose={() => { setAddModalOpen(false); load(); }}
        playlistId={id}
        existingSongIds={existingSongIds}
        onSongAdded={handleSongAdded}
      />
    </div>
  );
}
