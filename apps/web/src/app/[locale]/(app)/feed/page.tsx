'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Music2, Heart, UserPlus, Disc3, Rss } from 'lucide-react';
import { feedApi } from '@/lib/api/feed.api';
import { usePlayer } from '@/hooks/usePlayer';

interface FeedEntity {
  type: 'SONG' | 'PLAYLIST' | 'USER';
  id: string;
  title?: string;
  name?: string;
  coverArtUrl?: string | null;
  totalTracks?: number;
}

interface FeedItem {
  id: string;
  eventType: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  createdAt: string;
  entity: FeedEntity | null;
}

const EVENT_LABELS: Record<string, string> = {
  NEW_PLAYLIST: 'created a playlist',
  SONG_LIKED: 'liked a song',
  ARTIST_FOLLOWED: 'started following',
  NEW_RELEASE: 'released a new song',
  UPCOMING_DROP: 'announced an upcoming drop',
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  NEW_PLAYLIST: <Disc3 size={13} color="var(--gold)" />,
  SONG_LIKED: <Heart size={13} color="rgba(255,80,100,0.8)" />,
  ARTIST_FOLLOWED: <UserPlus size={13} color="var(--gold)" />,
  NEW_RELEASE: <Music2 size={13} color="var(--gold)" />,
  UPCOMING_DROP: <Disc3 size={13} color="rgba(232,184,75,0.6)" />,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function FeedPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const { playSong } = usePlayer();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 20;

  const load = useCallback(async (p: number) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const r = await feedApi.getFeed(p, limit);
      const data = r.data as { items: FeedItem[]; total: number };
      setItems(prev => p === 1 ? data.items : [...prev, ...data.items]);
      setTotal(data.total);
      setPage(p);
    } finally {
      if (p === 1) setLoading(false); else setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const hasMore = items.length < total;

  const handleEntityClick = (item: FeedItem) => {
    if (!item.entity) return;
    if (item.entity.type === 'SONG') {
      playSong({
        id: item.entity.id,
        title: item.entity.title ?? '',
        artistName: item.actorName,
        coverArtUrl: item.entity.coverArtUrl ?? null,
        fileUrl: '',
        durationSeconds: 0,
      });
    } else if (item.entity.type === 'PLAYLIST') {
      router.push(`/${locale}/playlists/${item.entity.id}`);
    } else if (item.entity.type === 'USER') {
      router.push(`/${locale}/users/${item.entity.id}`);
    }
  };

  return (
    <div style={{ padding: '32px 28px', minHeight: '100vh', background: 'var(--charcoal)' }}>
      {/* Aurora orbs */}
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: 480, height: 480, borderRadius: '50%', background: 'rgba(232,184,75,0.04)', filter: 'blur(80px)', animation: 'auroraShift1 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 360, height: 360, borderRadius: '50%', background: 'rgba(245,238,216,0.02)', filter: 'blur(80px)', animation: 'auroraShift3 14s ease-in-out infinite' }} />
      </div>

      {/* Header */}
      <div className="anim-fade-up" style={{ marginBottom: 36 }}>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(232,184,75,0.35)', marginBottom: 6 }}>
          Following
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Rss size={26} color="var(--gold)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, color: 'var(--ivory)', lineHeight: 1.15 }}>
            Activity Feed
          </h1>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div className="vinyl-spin" style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
            border: '2px solid rgba(232,184,75,0.2)',
          }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="anim-fade-up" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', paddingTop: 100, gap: 14,
        }}>
          <Rss size={48} color="rgba(232,184,75,0.12)" />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--ivory)', fontWeight: 400 }}>
            Nothing here yet
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', textAlign: 'center', maxWidth: 320 }}>
            Follow artists and users to see their activity here
          </p>
        </div>
      )}

      {/* Timeline */}
      {!loading && items.length > 0 && (
        <div style={{ position: 'relative', maxWidth: 680 }}>
          {/* Vertical gold line */}
          <div
            className="anim-fade-up"
            style={{
              position: 'absolute', left: 20, top: 8, bottom: 0, width: 1,
              background: 'linear-gradient(to bottom, rgba(232,184,75,0.35) 0%, rgba(232,184,75,0.05) 100%)',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((item, i) => (
              <div
                key={item.id}
                className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 20,
                  padding: '14px 14px 14px 0',
                }}
              >
                {/* Timeline dot */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(13,13,13,0.9)',
                    border: '1px solid rgba(232,184,75,0.2)',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {item.actorAvatarUrl
                      ? <img src={item.actorAvatarUrl} alt="" className="avatar-ring-pulse" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '0.75rem', color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>
                          {item.actorName.charAt(0).toUpperCase()}
                        </span>
                    }
                  </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Actor + verb */}
                  <p style={{ fontSize: '0.84rem', color: 'var(--ivory)', lineHeight: 1.4, marginBottom: 8 }}>
                    <button
                      onClick={() => router.push(`/${locale}/users/${item.actorId}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontWeight: 600, padding: 0, fontSize: 'inherit', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      {item.actorName}
                    </button>
                    {' '}
                    <span style={{ color: 'var(--muted-text)' }}>
                      {EVENT_LABELS[item.eventType] ?? item.eventType.toLowerCase().replace(/_/g, ' ')}
                    </span>
                    {' '}
                    <span style={{ marginLeft: 4, display: 'inline-flex', verticalAlign: 'middle' }}>
                      {EVENT_ICONS[item.eventType] ?? null}
                    </span>
                  </p>

                  {/* Entity card */}
                  {item.entity && (
                    <div
                      onClick={() => handleEntityClick(item)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 8,
                        background: 'rgba(17,17,17,0.75)',
                        border: '1px solid rgba(232,184,75,0.08)',
                        cursor: item.entity.type !== 'USER' || true ? 'pointer' : 'default',
                        maxWidth: 340,
                        transition: 'border-color 0.18s, transform 0.2s cubic-bezier(0.16,1,0.3,1)',
                        backdropFilter: 'blur(8px)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.22)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.08)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Thumb */}
                      {item.entity.type !== 'USER' && (
                        <div style={{
                          width: 36, height: 36, borderRadius: item.entity.type === 'SONG' ? 4 : 4,
                          overflow: 'hidden', flexShrink: 0,
                          background: 'rgba(232,184,75,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {item.entity.coverArtUrl
                            ? <img src={item.entity.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : item.entity.type === 'SONG'
                              ? <Music2 size={14} color="rgba(232,184,75,0.3)" />
                              : <Disc3 size={14} color="rgba(232,184,75,0.3)" />
                          }
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '0.82rem', color: 'var(--ivory)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                          {item.entity.title ?? item.entity.name}
                        </p>
                        {item.entity.type === 'PLAYLIST' && item.entity.totalTracks !== undefined && (
                          <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)', marginTop: 2 }}>
                            <span style={{ fontFamily: 'var(--font-display)' }}>{item.entity.totalTracks}</span> tracks
                          </p>
                        )}
                        {item.entity.type === 'SONG' && (
                          <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)', marginTop: 2 }}>
                            {item.actorName}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <p style={{ fontSize: '0.68rem', color: 'rgba(90,85,80,0.6)', marginTop: 8 }}>
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div style={{ paddingLeft: 60, marginTop: 12 }}>
              <button
                onClick={() => load(page + 1)}
                disabled={loadingMore}
                style={{
                  padding: '9px 20px', borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid rgba(232,184,75,0.15)',
                  cursor: loadingMore ? 'not-allowed' : 'pointer',
                  color: 'var(--ivory)', fontSize: '0.83rem',
                  transition: 'border-color 0.18s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.35)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(232,184,75,0.15)')}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom padding for PlayerBar */}
      <div style={{ height: 96 }} />
    </div>
  );
}
