'use client';

import { useRef, useState, useEffect } from 'react';
import {
  SkipBack, SkipForward, Play, Pause,
  Volume2, VolumeX, ListMusic, Music2, Repeat, Repeat1,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePlayer } from '@/hooks/usePlayer';
import { getAssetUrl } from '@/lib/utils/asset';

// ── Animated wave bars ────────────────────────────────────────────────────────
function WaveBar({ isPlaying }: { isPlaying: boolean }) {
  const heights = [9, 14, 11, 14, 9];
  return (
    <div style={{ display: 'flex', gap: 2.5, alignItems: 'center', height: 16 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          height: isPlaying ? h : 4,
          background: isPlaying ? 'var(--gold)' : 'rgba(232,184,75,0.3)',
          animation: isPlaying ? 'waveBar 0.8s ease-in-out infinite' : 'none',
          animationDelay: `${i * 0.1}s`,
          transformOrigin: 'center',
          transition: 'height 0.3s ease, background 0.3s ease',
        }} />
      ))}
    </div>
  );
}

// ── Marquee title ─────────────────────────────────────────────────────────────
function MarqueeTitle({ title, maxWidth }: { title: string; maxWidth: number }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    setOverflow(el.scrollWidth > maxWidth);
  }, [title, maxWidth]);

  const duration = overflow && spanRef.current
    ? (spanRef.current.scrollWidth / 40).toFixed(1)
    : '0';

  return (
    <div style={{ overflow: 'hidden', maxWidth, width: maxWidth }}>
      <span
        ref={spanRef}
        style={{
          display: 'inline-block', whiteSpace: 'nowrap',
          animation: overflow ? `marqueeScroll ${duration}s linear infinite` : 'none',
          color: 'var(--ivory)', fontSize: '0.9rem', fontWeight: 600,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </span>
    </div>
  );
}

// ── Icon button helper ────────────────────────────────────────────────────────
function IconBtn({
  onClick, active = false, title, children, size = 32,
}: {
  onClick?: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: active ? 'rgba(232,184,75,0.12)' : 'none',
        border: 'none', cursor: 'pointer', padding: 0,
        color: active ? 'var(--gold)' : 'var(--muted-text)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'color 0.15s, background 0.15s, transform 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = active ? 'var(--gold)' : 'var(--ivory)';
        e.currentTarget.style.background = active ? 'rgba(232,184,75,0.18)' : 'rgba(255,255,255,0.06)';
        e.currentTarget.style.transform = 'scale(1.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = active ? 'var(--gold)' : 'var(--muted-text)';
        e.currentTarget.style.background = active ? 'rgba(232,184,75,0.12)' : 'none';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {children}
    </button>
  );
}

// ── Player Bar ────────────────────────────────────────────────────────────────
export default function PlayerBar() {
  const { locale } = useParams<{ locale: string }>();
  const { currentSong, isPlaying, positionSeconds, volume, repeatMode, cycleRepeat } = usePlayerStore();
  const { togglePlay, next, previous, seek, setVolume } = usePlayer();
  const barRef    = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  const duration = currentSong?.durationSeconds ?? 0;
  const progress = duration > 0 ? Math.min(100, (positionSeconds / duration) * 100) : 0;

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || !duration) return;
    const rect = barRef.current.getBoundingClientRect();
    seek(Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration)));
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!currentSong) {
    return (
      <footer style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 80, zIndex: 50,
        background: 'rgba(11,11,11,0.96)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <p style={{ fontSize: '0.76rem', color: 'rgba(90,85,80,0.6)', fontFamily: 'var(--font-body)', letterSpacing: '0.04em' }}>
          Browse songs and press play to start listening
        </p>
      </footer>
    );
  }

  // ── Now playing ─────────────────────────────────────────────────────────────
  return (
    <footer style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 88, zIndex: 50,
      background: 'rgba(11,11,11,0.97)',
      backdropFilter: 'blur(24px)',
      borderTop: isPlaying
        ? '1px solid rgba(232,184,75,0.18)'
        : '1px solid rgba(255,255,255,0.05)',
      transition: 'border-color 0.5s ease',
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
      gap: 20,
    }}>

      {/* Gold shimmer line at top when playing */}
      {isPlaying && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(232,184,75,0.5) 30%, rgba(232,184,75,0.8) 50%, rgba(232,184,75,0.5) 70%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmerLine 3s linear infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* ── Left: artwork + info ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: 250, flexShrink: 0 }}>
        {/* Album art */}
        <div style={{
          width: 54, height: 54, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
          border: isPlaying ? '1.5px solid rgba(232,184,75,0.35)' : '1.5px solid rgba(255,255,255,0.08)',
          background: 'rgba(232,184,75,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isPlaying ? '0 0 24px rgba(232,184,75,0.18)' : '0 4px 12px rgba(0,0,0,0.4)',
          transition: 'border-color 0.4s, box-shadow 0.4s',
          position: 'relative',
        }}>
          {currentSong.coverArtUrl ? (
            <img
              src={getAssetUrl(currentSong.coverArtUrl)}
              alt={currentSong.title}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                filter: isPlaying ? 'brightness(1.05)' : 'brightness(0.85)',
                transition: 'filter 0.4s',
              }}
            />
          ) : (
            <div
              className={isPlaying ? 'vinyl-spin' : ''}
              style={{
                width: '100%', height: '100%', borderRadius: 7,
                background: 'radial-gradient(circle at 35% 35%, #2a2520, #111)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Music2 size={20} color="rgba(232,184,75,0.4)" />
            </div>
          )}
        </div>

        {/* Title + artist */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <MarqueeTitle title={currentSong.title} maxWidth={170} />
          <p style={{
            color: 'var(--muted-text)', fontSize: '1rem', marginTop: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {currentSong.artistName}
          </p>
        </div>
      </div>

      {/* ── Center: controls + progress ──────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 8, minWidth: 0,
      }}>

        {/* Control buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconBtn onClick={previous} title="Skip back" size={32}>
            <SkipBack size={17} fill="currentColor" />
          </IconBtn>

          {/* Main play/pause */}
          <button
            type="button"
            onClick={togglePlay}
            style={{
              width: 46, height: 46, borderRadius: '50%',
              background: 'var(--gold)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isPlaying
                ? '0 0 28px rgba(232,184,75,0.5), 0 0 8px rgba(232,184,75,0.3)'
                : '0 0 16px rgba(232,184,75,0.25)',
              transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 0 36px rgba(232,184,75,0.6), 0 0 12px rgba(232,184,75,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = isPlaying
                ? '0 0 28px rgba(232,184,75,0.5), 0 0 8px rgba(232,184,75,0.3)'
                : '0 0 16px rgba(232,184,75,0.25)';
            }}
          >
            {isPlaying
              ? <Pause size={17} fill="#0d0d0d" color="#0d0d0d" />
              : <Play  size={17} fill="#0d0d0d" color="#0d0d0d" style={{ marginLeft: 2 }} />
            }
          </button>

          <IconBtn onClick={next} title="Skip forward" size={32}>
            <SkipForward size={17} fill="currentColor" />
          </IconBtn>

          {/* Repeat button */}
          <IconBtn
            onClick={cycleRepeat}
            active={repeatMode !== 'off'}
            title={repeatMode === 'off' ? 'Repeat: off' : repeatMode === 'all' ? 'Repeat: all' : 'Repeat: one'}
            size={32}
          >
            {repeatMode === 'one'
              ? <Repeat1 size={15} />
              : <Repeat  size={15} />
            }
          </IconBtn>
        </div>

        {/* Progress row */}
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: '1rem', color: 'var(--muted-text)', fontFamily: 'var(--font-display)',
            flexShrink: 0, width: 32, textAlign: 'right', letterSpacing: '0.02em',
          }}>
            {fmtTime(positionSeconds)}
          </span>

          <div
            ref={barRef}
            onClick={handleBarClick}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            style={{
              flex: 1, height: hovering ? 6 : 4, borderRadius: 4,
              background: 'rgba(255,255,255,0.07)',
              cursor: 'pointer', position: 'relative',
              transition: 'height 0.2s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {/* Filled */}
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${progress}%`,
              background: hovering
                ? 'linear-gradient(90deg, var(--gold-dim), var(--gold))'
                : 'var(--gold)',
              transition: 'width 1s linear, background 0.2s',
              pointerEvents: 'none',
            }} />
            {/* Thumb */}
            {hovering && (
              <div style={{
                position: 'absolute', top: '50%',
                left: `${progress}%`,
                transform: 'translate(-50%, -50%)',
                width: 12, height: 12, borderRadius: '50%',
                background: 'var(--ivory)',
                boxShadow: '0 0 6px rgba(232,184,75,0.5)',
                pointerEvents: 'none',
                transition: 'left 1s linear',
              }} />
            )}
          </div>

          <span style={{
            fontSize: '1rem', color: 'var(--muted-text)', fontFamily: 'var(--font-display)',
            flexShrink: 0, width: 32, letterSpacing: '0.02em',
          }}>
            {fmtTime(duration)}
          </span>
        </div>
      </div>

      {/* ── Right: wave + volume + queue ─────────────────────────────────── */}
      <div style={{
        width: 210, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        justifyContent: 'flex-end',
      }}>
        <WaveBar isPlaying={isPlaying} />

        <IconBtn onClick={() => setVolume(volume > 0 ? 0 : 0.8)} size={30}>
          {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </IconBtn>

        <div style={{ position: 'relative', width: 76 }}>
          <div style={{
            position: 'absolute', top: '50%', left: 0, right: 0, height: 3,
            background: 'rgba(255,255,255,0.08)', borderRadius: 2, transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}>
            <div style={{
              height: '100%', width: `${volume * 100}%`,
              background: 'var(--gold)', borderRadius: 2,
            }} />
          </div>
          <input
            type="range" min="0" max="1" step="0.02" value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{ width: '100%', opacity: 0, cursor: 'pointer', position: 'relative', zIndex: 1, height: 16 }}
          />
        </div>

        <Link
          href={`/${locale}/queue`}
          title="View queue"
          style={{ color: 'var(--muted-text)', display: 'flex', padding: 4, borderRadius: 6, transition: 'color 0.15s, background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--gold)'; (e.currentTarget as HTMLElement).style.background = 'rgba(232,184,75,0.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted-text)'; (e.currentTarget as HTMLElement).style.background = 'none'; }}
        >
          <ListMusic size={16} />
        </Link>
      </div>
    </footer>
  );
}
