'use client';

import { useEffect, useState } from 'react';
import { ListMusic, Trash2, Sparkles, Play, X, Music2 } from 'lucide-react';
import { useQueueStore } from '@/store/useQueueStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePlayer } from '@/hooks/usePlayer';
import { useQueue } from '@/hooks/useQueue';
import type { PlayerSong } from '@/store/usePlayerStore';

interface ExtendedQueueItem extends PlayerSong {
  queuePosition: number;
  queueItemId: string;
}

export default function QueuePage() {
  const { items } = useQueueStore();
  const { currentSong, isPlaying } = usePlayerStore();
  const { playSong } = usePlayer();
  const { refreshQueue, removeFromQueue, smartOrder, clearQueue } = useQueue();

  const [loading, setLoading]   = useState(true);
  const [smartBusy, setSmartBusy] = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    refreshQueue().finally(() => setLoading(false));
  }, [refreshQueue]);

  const handleSmartOrder = async () => {
    setSmartBusy(true);
    await smartOrder();
    setSmartBusy(false);
    showToast('Queue reordered by Camelot key');
  };

  const handleClear = async () => {
    await clearQueue();
    showToast('Queue cleared');
  };

  const handleRemove = async (queueItemId: string) => {
    await removeFromQueue(queueItemId);
  };

  const handlePlay = (item: ExtendedQueueItem) => {
    playSong({
      id: item.id,
      title: item.title,
      artistName: item.artistName,
      coverArtUrl: item.coverArtUrl,
      fileUrl: item.fileUrl,
      durationSeconds: item.durationSeconds,
    });
  };

  const fmtDuration = (s: number) => {
    if (!s) return '—';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const queueItems = items as unknown as ExtendedQueueItem[];

  return (
    <div style={{ padding: '32px 32px 40px' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 60,
          padding: '11px 18px', borderRadius: 6,
          background: 'rgba(120,200,120,0.1)',
          border: '1px solid rgba(120,200,120,0.3)',
          color: 'rgba(140,220,140,0.95)',
          fontSize: '0.82rem', fontFamily: 'var(--font-body)',
          animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="anim-fade-up anim-fade-up-1" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ListMusic size={13} color="var(--gold)" />
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            Play Queue
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.8rem,4vw,2.6rem)',
              fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.02em',
            }}>
              Up Next
            </h1>
            <p style={{ color: 'var(--muted-text)', fontSize: '0.81rem', marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-display)' }}>{queueItems.length}</span> song{queueItems.length !== 1 ? 's' : ''} in queue
            </p>
          </div>

          {/* Actions */}
          {queueItems.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleSmartOrder}
                disabled={smartBusy || queueItems.length < 2}
                title="Smart order by Camelot key"
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 6,
                  background: 'rgba(232,184,75,0.08)',
                  border: '1px solid rgba(232,184,75,0.2)',
                  color: 'var(--gold)', fontSize: '0.78rem',
                  fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
                  cursor: smartBusy || queueItems.length < 2 ? 'not-allowed' : 'pointer',
                  opacity: smartBusy || queueItems.length < 2 ? 0.5 : 1,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!smartBusy) (e.currentTarget as HTMLElement).style.background = 'rgba(232,184,75,0.14)'; }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(232,184,75,0.08)'}
              >
                <Sparkles size={13} />
                Smart Order
              </button>
              <button
                type="button"
                onClick={handleClear}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid rgba(42,37,32,0.7)',
                  color: 'var(--muted-text)', fontSize: '0.78rem',
                  fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(220,80,80,0.85)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,80,80,0.3)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--muted-text)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,37,32,0.7)';
                }}
              >
                <Trash2 size={13} />
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="vinyl-spin" style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
            border: '2px solid rgba(232,184,75,0.2)',
          }} />
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────────────────────────── */}
      {!loading && queueItems.length === 0 && (
        <div className="anim-fade-up anim-fade-up-2" style={{
          padding: '64px 32px', textAlign: 'center',
          border: '1px dashed rgba(232,184,75,0.1)', borderRadius: 10,
        }}>
          <ListMusic size={28} color="rgba(232,184,75,0.2)" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--ivory)', marginBottom: 8 }}>
            Queue is empty
          </p>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem' }}>
            Browse songs and add them to the queue.
          </p>
        </div>
      )}

      {/* ── Queue list ──────────────────────────────────────────────────────── */}
      {!loading && queueItems.length > 0 && (
        <div style={{
          background: 'rgba(17,17,17,0.5)',
          border: '1px solid rgba(232,184,75,0.07)',
          borderRadius: 10, overflow: 'hidden',
          padding: '4px 0',
        }}>
          {/* Column header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '28px 40px 1fr 60px 36px',
            gap: 12, padding: '8px 16px 8px',
            fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'rgba(90,85,80,0.55)',
          }}>
            <div>#</div>
            <div />
            <div>Song</div>
            <div style={{ textAlign: 'right' }}>Duration</div>
            <div />
          </div>

          <div style={{ height: 1, background: '#141414', margin: '0 16px 4px' }} />

          {queueItems.map((item, idx) => {
            const isActive = currentSong?.id === item.id;
            return (
              <div
                key={item.queueItemId ?? item.id}
                className={`anim-fade-up anim-fade-up-${Math.min(idx + 1, 8)}`}
                style={{
                  display: 'grid', gridTemplateColumns: '28px 40px 1fr 60px 36px',
                  gap: 12, padding: '9px 16px', alignItems: 'center',
                  background: isActive ? 'rgba(232,184,75,0.05)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = isActive ? 'rgba(232,184,75,0.08)' : 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = isActive ? 'rgba(232,184,75,0.05)' : 'transparent')}
                onClick={() => handlePlay(item)}
              >
                {/* Position / waveBar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                  {isActive && isPlaying ? (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 12 }}>
                      {[0, 0.1, 0.15].map((delay, i) => (
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
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Art */}
                <div style={{
                  width: 38, height: 38, borderRadius: 4, overflow: 'hidden',
                  background: 'rgba(232,184,75,0.05)', border: '1px solid rgba(232,184,75,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {item.coverArtUrl
                    ? <img src={item.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Music2 size={14} color="rgba(232,184,75,0.25)" />
                  }
                </div>

                {/* Title + artist */}
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    color: isActive ? 'var(--gold)' : 'var(--ivory)',
                    fontSize: '0.87rem', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    transition: 'color 0.15s',
                  }}>
                    {item.title}
                  </p>
                  <p style={{
                    color: 'var(--muted-text)', fontSize: '0.7rem', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.artistName}
                  </p>
                </div>

                {/* Duration */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-display)', color: 'var(--muted-text)' }}>
                    {fmtDuration(item.durationSeconds)}
                  </span>
                </div>

                {/* Remove */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    title="Remove from queue"
                    onClick={e => { e.stopPropagation(); handleRemove(item.queueItemId); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: 'var(--muted-text)', display: 'flex',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(220,80,80,0.8)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-text)')}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
