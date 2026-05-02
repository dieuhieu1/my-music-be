'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { Role } from '@mymusic/types';
import { getRoleHome } from '@/lib/utils/roleRedirect';
import PublicHeader from '@/components/layout/PublicHeader';
import { RecommendationSection } from '@/components/recommendations/RecommendationSection';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useMoodRecs } from '@/hooks/useMoodRecs';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePlayer } from '@/hooks/usePlayer';
import { useQueue } from '@/hooks/useQueue';
import { genresApi } from '@/lib/api/genres.api';
import type { MoodType } from '@/lib/api/recommendations.api';
import TopBar from '@/components/layout/TopBar';

/* ════════════════════════════════════════════════════════════════════════════
   CURSOR TRAIL
   ════════════════════════════════════════════════════════════════════════════ */
function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<Array<{ x: number; y: number; life: number; vx: number; vy: number }>>([]);
  const mouseRef = useRef({ x: -999, y: -999 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      for (let i = 0; i < 3; i++) {
        trailRef.current.push({
          x: e.clientX + (Math.random() - 0.5) * 10,
          y: e.clientY + (Math.random() - 0.5) * 10,
          life: 1,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5 - 0.5,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      trailRef.current = trailRef.current.filter(p => p.life > 0);
      for (const p of trailRef.current) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.life * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232,184,75,${p.life * 0.5})`;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(232,184,75,0.6)';
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.025;
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('resize', onResize);
    draw();
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999, mixBlendMode: 'screen' }}
    />
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TEXT SCRAMBLE
   ════════════════════════════════════════════════════════════════════════════ */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&';
function useScramble(target: string, delay = 0) {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    let frame = 0;
    let started = false;
    const timeout = setTimeout(() => { started = true; }, delay * 1000);
    const interval = setInterval(() => {
      if (!started) return;
      frame++;
      const progress = Math.min(frame / 30, 1);
      const revealCount = Math.floor(progress * target.length);
      let result = '';
      for (let i = 0; i < target.length; i++) {
        if (i < revealCount) result += target[i];
        else if (target[i] === ' ') result += ' ';
        else result += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      setDisplay(result);
      if (progress >= 1) clearInterval(interval);
    }, 40);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [target, delay]);
  return display;
}

/* ════════════════════════════════════════════════════════════════════════════
   MAGNETIC BUTTON
   ════════════════════════════════════════════════════════════════════════════ */
function MagneticWrap({ children, strength = 0.3 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current!;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * strength;
    const dy = (e.clientY - cy) * strength;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const onLeave = () => { ref.current!.style.transform = 'translate(0,0)'; };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)', display: 'inline-block' }}
    >
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   3D MOUSE-TRACKING VINYL
   ════════════════════════════════════════════════════════════════════════════ */
function Vinyl3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 5, ry: -10 });
  const [glare, setGlare] = useState({ x: 50, y: 50 });
  const angleRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Continuous spin via rAF so it never resets when tilt changes
  useEffect(() => {
    const spin = () => {
      angleRef.current = (angleRef.current + 0.18) % 360; // ~0.18°/frame ≈ 33s per revolution
      if (spinRef.current) {
        spinRef.current.style.transform = `rotate(${angleRef.current}deg)`;
      }
      rafRef.current = requestAnimationFrame(spin);
    };
    rafRef.current = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current!;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = -((e.clientY - cy) / (rect.height / 2)) * 18;
    const ry = ((e.clientX - cx) / (rect.width / 2)) * 18;
    const gx = ((e.clientX - rect.left) / rect.width) * 100;
    const gy = ((e.clientY - rect.top) / rect.height) * 100;
    setTilt({ rx, ry });
    setGlare({ x: gx, y: gy });
  }, []);

  const onLeave = () => setTilt({ rx: 5, ry: -10 });

  return (
    <div
      ref={containerRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ perspective: 900, width: 380, height: 380, cursor: 'none' }}
    >
      {/* Tilt layer — only handles the 3D perspective tilt */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.15s ease-out',
        }}
      >
        {/* Spin layer — continuously rotates the disc */}
        <div ref={spinRef} style={{ width: '100%', height: '100%', position: 'relative', willChange: 'transform' }}>
          <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 60px 100px rgba(0,0,0,0.95)) drop-shadow(0 0 80px rgba(232,184,75,0.25))' }}>
            <defs>
              <radialGradient id="vBase" cx="42%" cy="36%" r="62%">
                <stop offset="0%" stopColor="#2e2414" />
                <stop offset="50%" stopColor="#0c0a07" />
                <stop offset="100%" stopColor="#030201" />
              </radialGradient>
              <radialGradient id="vLabel" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f2c840" />
                <stop offset="55%" stopColor="#e8b84b" />
                <stop offset="100%" stopColor="#8a5e18" />
              </radialGradient>
            </defs>
            <circle cx="200" cy="200" r="198" fill="url(#vBase)" />
            {[195,183,171,159,148,137,126,116,106,96,87,78,70,62,55,48,42,36].map((r, i) => (
              <circle key={i} cx="200" cy="200" r={r}
                stroke={i % 4 === 0 ? '#2e2512' : i % 2 === 0 ? '#1a1408' : '#0e0b04'}
                strokeWidth={i % 4 === 0 ? 2.2 : 0.8} fill="none" />
            ))}
            <circle cx="200" cy="200" r="65" fill="#1c1609" />
            <circle cx="200" cy="200" r="58" fill="url(#vLabel)" />
            <circle cx="200" cy="200" r="50" fill="#0c0804" opacity="0.7"/>
            <circle cx="200" cy="200" r="44" stroke="#f2c840" strokeWidth="0.7" fill="none" opacity="0.35" />
            {/* Needle mark on label so spin is visible */}
            <line x1="200" y1="157" x2="200" y2="175" stroke="#e8b84b" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
            <circle cx="200" cy="200" r="7" fill="#f0c840" />
            <circle cx="200" cy="200" r="3.2" fill="#020100" />
            <path d="M 50 200 A 150 150 0 0 1 350 200" stroke="#e8b84b" strokeWidth="1.2" opacity="0.1" fill="none" />
            <path d="M 78 140 A 135 135 0 0 1 322 140" stroke="white" strokeWidth="0.6" opacity="0.07" fill="none" />
          </svg>
        </div>
        {/* Glare layer — stays fixed relative to perspective, does NOT spin */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,240,180,0.2) 0%, transparent 58%)`,
            pointerEvents: 'none',
            transition: 'background 0.08s',
          }}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   AURORA BACKGROUND
   ════════════════════════════════════════════════════════════════════════════ */
function Aurora() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '30%', width: 800, height: 500,
        background: 'radial-gradient(ellipse, rgba(232,184,75,0.07) 0%, transparent 65%)',
        animation: 'auroraShift1 12s ease-in-out infinite', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', top: '30%', left: '-15%', width: 600, height: 600,
        background: 'radial-gradient(ellipse, rgba(80,40,160,0.09) 0%, transparent 65%)',
        animation: 'auroraShift2 16s ease-in-out infinite', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '10%', width: 700, height: 500,
        background: 'radial-gradient(ellipse, rgba(20,100,180,0.07) 0%, transparent 65%)',
        animation: 'auroraShift3 14s ease-in-out infinite', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', top: '60%', right: '-10%', width: 400, height: 400,
        background: 'radial-gradient(ellipse, rgba(232,100,75,0.05) 0%, transparent 65%)',
        animation: 'auroraShift1 18s ease-in-out infinite reverse', borderRadius: '50%' }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SCROLL REVEAL HOOK
   ════════════════════════════════════════════════════════════════════════════ */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

/* ════════════════════════════════════════════════════════════════════════════
   ANIMATED COUNTER
   ════════════════════════════════════════════════════════════════════════════ */
function AnimCounter({ to, suffix, label }: { to: number; suffix: string; label: string }) {
  const { ref, visible } = useReveal();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const end = to;
    const duration = 1800;
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setVal(Math.floor(ease * end));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible, to]);

  return (
    <div ref={ref} style={{ textAlign: 'center', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 4.5vw, 4rem)', fontWeight: 300, color: 'var(--ivory)', letterSpacing: '-0.04em', lineHeight: 1 }}>
        {val.toLocaleString()}{suffix}
      </div>
      <div style={{ marginTop: 8, fontSize: '0.63rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>{label}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   LIVE SPECTRUM BARS
   ════════════════════════════════════════════════════════════════════════════ */
function Spectrum() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width = 300, H = canvas.height = 70;
    const bars = 34;
    const phases = Array.from({ length: bars }, () => Math.random() * Math.PI * 2);
    // Much slower individual speeds — 0.18–0.45 range (was 0.6–1.8)
    const speeds = Array.from({ length: bars }, () => 0.18 + Math.random() * 0.27);
    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const bw = W / bars - 1.5;
      for (let i = 0; i < bars; i++) {
        const h = (0.2 + 0.8 * Math.abs(Math.sin(t * speeds[i] + phases[i]))) * H;
        const x = i * (bw + 1.5);
        const gradient = ctx.createLinearGradient(0, H - h, 0, H);
        gradient.addColorStop(0, 'rgba(232,184,75,0.9)');
        gradient.addColorStop(1, 'rgba(232,184,75,0.15)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, H - h, bw, h, 2);
        ctx.fill();
      }
      t += 0.012; // was 0.04 — ~3× slower overall
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}

/* ════════════════════════════════════════════════════════════════════════════
   FEATURE CARD  (scroll-reveal + glitch hover)
   ════════════════════════════════════════════════════════════════════════════ */
function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: number }) {
  const { ref, visible } = useReveal();
  const [hover, setHover] = useState(false);
  return (
    <div
      ref={ref}
      style={{
        padding: '2px',
        borderRadius: 18,
        background: hover
          ? 'linear-gradient(135deg, rgba(232,184,75,0.4) 0%, rgba(232,184,75,0.1) 50%, rgba(232,184,75,0.35) 100%)'
          : 'linear-gradient(135deg, rgba(232,184,75,0.18) 0%, rgba(232,184,75,0.04) 60%, rgba(232,184,75,0.16) 100%)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(36px) scale(0.96)',
        transition: `opacity 0.65s ${delay}s ease, transform 0.65s ${delay}s cubic-bezier(0.16,1,0.3,1), background 0.3s ease`,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          background: hover ? 'linear-gradient(135deg, #130f06 0%, #0c0c0c 100%)' : 'linear-gradient(135deg, #0f0d07 0%, #0a0a0a 100%)',
          borderRadius: 16,
          padding: '36px 30px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          position: 'relative',
          overflow: 'hidden',
          transition: 'background 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
          transform: hover ? 'translateY(-6px)' : 'translateY(0)',
        }}
      >
        {/* Animated top-right glow */}
        <div style={{
          position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: '50%',
          background: hover ? 'radial-gradient(circle, rgba(232,184,75,0.18) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(232,184,75,0.06) 0%, transparent 70%)',
          transition: 'background 0.4s ease',
          pointerEvents: 'none',
        }} />
        {/* Animated bottom scan line */}
        {hover && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(232,184,75,0.6), transparent)',
            animation: 'scanLine 1.5s ease-in-out infinite',
          }} />
        )}
        <span style={{ fontSize: '2.2rem', filter: hover ? 'drop-shadow(0 0 12px rgba(232,184,75,0.8))' : 'none', transition: 'filter 0.3s ease' }}>{icon}</span>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600,
          color: hover ? 'var(--gold)' : 'var(--ivory)', margin: 0,
          transition: 'color 0.3s ease',
          textShadow: hover ? '0 0 20px rgba(232,184,75,0.4)' : 'none',
        }}>{title}</h3>
        <p style={{ fontSize: '0.83rem', color: 'var(--muted-text)', lineHeight: 1.75, margin: 0 }}>{desc}</p>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6, opacity: hover ? 1 : 0, transition: 'opacity 0.3s ease' }}>
          <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: 'var(--gold)', textTransform: 'uppercase' }}>Learn more</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e8b84b" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SCROLLING MARQUEE
   ════════════════════════════════════════════════════════════════════════════ */
function Marquee() {
  const items = ['AMBIENT', '♦', 'JAZZ', '♦', 'ELECTRONIC', '♦', 'CLASSICAL', '♦', 'HIP-HOP', '♦', 'INDIE', '♦', 'R&B', '♦', 'LO-FI', '♦', 'SOUL', '♦', 'EXPERIMENTAL', '♦'];
  return (
    <div style={{ overflow: 'hidden', borderTop: '1px solid rgba(232,184,75,0.08)', borderBottom: '1px solid rgba(232,184,75,0.08)', padding: '16px 0', position: 'relative', background: 'rgba(232,184,75,0.015)' }}>
      <div style={{ display: 'flex', gap: 36, animation: 'marqueeScroll 22s linear infinite', whiteSpace: 'nowrap' }}>
        {[...items, ...items].map((item, i) => (
          <span key={i} style={{
            fontSize: '0.6rem', letterSpacing: '0.25em',
            color: item === '♦' ? 'rgba(232,184,75,0.4)' : (i % 6 === 0 ? 'var(--gold)' : 'var(--muted-text)'),
            fontWeight: item === '♦' ? 400 : 700,
          }}>{item}</span>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   NOW PLAYING MINI PLAYER (floating)
   ════════════════════════════════════════════════════════════════════════════ */
function NowPlayingCard() {
  const [playing, setPlaying] = useState(true);
  return (
    <div style={{
      background: 'rgba(14,12,8,0.92)',
      backdropFilter: 'blur(24px)',
      border: '1px solid rgba(232,184,75,0.18)',
      borderRadius: 16,
      padding: '16px 18px',
      minWidth: 200,
      animation: 'floatCard1 5s ease-in-out infinite',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,184,75,0.06)',
    }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--muted-text)', letterSpacing: '0.14em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80', animation: 'orbFloat 1.5s ease-in-out infinite' }} />
        NOW PLAYING
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(232,184,75,0.4)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#0d0d0d"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ivory)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Midnight Echo</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>Lunar Wave</div>
        </div>
        <button onClick={() => setPlaying(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ivory)', padding: 4, display: 'flex' }}>
          {playing
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>
      </div>
      {/* Progress bar */}
      <div style={{ marginTop: 12, height: 2, background: 'rgba(232,184,75,0.12)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '42%', background: 'linear-gradient(90deg, var(--gold), #f5d27a)', borderRadius: 2, animation: playing ? 'progressGrow 60s linear infinite' : 'none' }} />
      </div>
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--muted-text)' }}>1:48</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--muted-text)' }}>4:12</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TESTIMONIAL CARD
   ════════════════════════════════════════════════════════════════════════════ */
function TestCard({ name, handle, text, idx }: { name: string; handle: string; text: string; idx: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      style={{
        padding: '24px 22px',
        background: 'linear-gradient(135deg, #0f0d08 0%, #0a0a0a 100%)',
        border: '1px solid rgba(232,184,75,0.1)',
        borderRadius: 14,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.6s ${idx * 0.12}s ease, transform 0.6s ${idx * 0.12}s ease`,
      }}
    >
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {[0,1,2,3,4].map(i => (
          <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="#e8b84b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        ))}
      </div>
      <p style={{ fontSize: '0.82rem', color: 'rgba(245,238,216,0.75)', lineHeight: 1.75, marginBottom: 18 }}>"{text}"</p>
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ivory)' }}>{name}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted-text)' }}>{handle}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   GUEST ZONE — top songs + genre links + sign-in banner
   ════════════════════════════════════════════════════════════════════════════ */
function GuestZone({ locale }: { locale: string }) {
  const { data: genres } = useQuery({
    queryKey: ['genres'],
    queryFn: async () => {
      const res = await genresApi.getGenres();
      return (res.data?.data ?? res.data) as { id: string; name: string }[];
    },
    staleTime: 60 * 60 * 1000,
  });

  return (
    <section
      className="anim-fade-up"
      style={{ padding: 'clamp(40px,5vw,60px) clamp(24px,6vw,96px) 0' }}
    >
      {/* Sign-in personalisation banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14,
        padding: '16px 24px', borderRadius: 10, marginBottom: 32,
        border: '1px solid rgba(232,184,75,0.18)',
        background: 'rgba(232,184,75,0.04)',
      }}>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.85rem', margin: 0 }}>
          Sign in for personalized picks
        </p>
        <Link href={`/${locale}/login`} style={{
          padding: '7px 20px', borderRadius: 6, textDecoration: 'none',
          background: 'var(--gold)', color: '#0d0d0d',
          fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          Sign in
        </Link>
      </div>

      {/* Genre browse links */}
      {genres && genres.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <p style={{
            fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--muted-text)', marginBottom: 12, fontFamily: 'var(--font-body)',
          }}>
            Browse by genre
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {genres.slice(0, 12).map((g, i) => (
              <Link
                key={g.id}
                href={`/${locale}/genres`}
                className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}
                style={{
                  padding: '6px 14px', borderRadius: 99, textDecoration: 'none',
                  border: '1px solid rgba(232,184,75,0.1)',
                  background: 'rgba(17,17,17,0.8)',
                  color: 'var(--muted-text)', fontSize: '0.78rem', fontWeight: 500,
                  transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(232,184,75,0.35)';
                  e.currentTarget.style.color = 'var(--ivory)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(232,184,75,0.1)';
                  e.currentTarget.style.color = 'var(--muted-text)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {g.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: 'rgba(232,184,75,0.07)' }} />
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   AUTH ZONE — 3 recommendation sections for logged-in users
   ════════════════════════════════════════════════════════════════════════════ */
const MOOD_LABELS: Record<MoodType, string> = {
  HAPPY: 'Happy', SAD: 'Sad', FOCUS: 'Focus', CHILL: 'Chill', WORKOUT: 'Workout',
};

function AuthZone({ locale }: { locale: string }) {
  const { songs, isLoading, timeRange, setTimeRange, loadMore, hasMore } = useRecommendations(20);
  const { songs: moodSongs, resolvedMood, inferred, isLoading: moodLoading } = useMoodRecs(undefined, 20);
  const { playWithContext } = usePlayer();
  const { addToQueue } = useQueue();

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const freshSongs = songs.filter((s) => new Date(s.createdAt).getTime() > thirtyDaysAgo);
  const showFreshDrops = freshSongs.length >= 3;

  const playAll = (tracks: typeof songs) => {
    if (tracks.length === 0) return;
    playWithContext(tracks.map(t => ({
      id: t.id,
      title: t.title,
      artistName: t.artistName,
      coverArtUrl: t.coverArtUrl,
      fileUrl: '',
      durationSeconds: t.duration,
    })), 0, 'DISCOVER');
  };

  return (
    <section style={{ padding: 'clamp(48px,6vw,80px) clamp(24px,6vw,96px) 0' }}>
      {/* Section 1 — Picked for you */}
      <RecommendationSection
        title="Picked for you"
        subtitle="Your personal top picks"
        songs={songs}
        loading={isLoading}
        onPlayAll={() => playAll(songs)}
        timeRangeToggle={{ value: timeRange, onChange: setTimeRange }}
      />

      {/* Section 2 — Based on your mood (inferred) */}
      {(moodLoading || moodSongs.length > 0) && (
        <RecommendationSection
          title="Based on your mood"
          subtitle={
            inferred && resolvedMood
              ? `Listening to: ${MOOD_LABELS[resolvedMood]}`
              : 'Mood-matched picks'
          }
          songs={moodSongs}
          loading={moodLoading}
          onPlayAll={() => playAll(moodSongs)}
        />
      )}

      {/* Section 3 — Fresh drops (client-side filter, ≥ 3 required) */}
      {showFreshDrops && (
        <RecommendationSection
          title="Fresh drops"
          subtitle="Added in the last 30 days"
          songs={freshSongs}
          loading={false}
          onPlayAll={() => playAll(freshSongs)}
        />
      )}

      {/* Load more / empty state */}
      {!isLoading && songs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.85rem', marginBottom: 14 }}>
            Tell us what you like to get personalized picks.
          </p>
          <Link href={`/${locale}/onboarding`} style={{
            color: 'var(--gold)', fontSize: '0.82rem', textDecoration: 'none',
            borderBottom: '1px solid rgba(232,184,75,0.3)',
            transition: 'opacity 0.15s',
          }}>
            Set your genres →
          </Link>
        </div>
      )}

      {hasMore && songs.length > 0 && !isLoading && (
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <button
            type="button"
            onClick={loadMore}
            style={{
              padding: '8px 24px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid rgba(232,184,75,0.2)',
              background: 'transparent', color: 'var(--muted-text)',
              fontSize: '0.78rem', fontFamily: 'var(--font-body)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(232,184,75,0.4)';
              e.currentTarget.style.color = 'var(--ivory)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(232,184,75,0.2)';
              e.currentTarget.style.color = 'var(--muted-text)';
            }}
          >
            Load more
          </button>
        </div>
      )}

      <div style={{ height: 1, background: 'rgba(232,184,75,0.07)', marginTop: 48 }} />
    </section>
  );
}


/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const locale = useLocale();
  const { user } = useAuthStore();
  const [scrollY, setScrollY] = useState(0);
  const heroText1 = useScramble('Music that', 0.3);
  const heroText2 = useScramble('moves you.', 0.8);

  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const parallax1 = scrollY * 0.12;
  const parallax2 = scrollY * 0.07;

  return (
    <main style={{ background: 'var(--charcoal)', minHeight: '100vh', overflowX: 'hidden', cursor: 'none' }}>
      <CursorTrail />
      <PublicHeader locale={locale} />
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr',
        alignItems: 'center', padding: '68px clamp(24px,6vw,96px) 0',
        position: 'relative', overflow: 'hidden', gap: 40,
      }}>
        <Aurora />

        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(rgba(232,184,75,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(232,184,75,0.02) 1px, transparent 1px)`,
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        }} />

        {/* Left copy */}
        <div style={{ position: 'relative', zIndex: 10, transform: `translateY(-${parallax1}px)` }}>
          <div className="anim-fade-up" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px 5px 8px', borderRadius: 99, marginBottom: 32,
            background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.2)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block', animation: 'orbFloat 2s ease-in-out infinite' }} />
            <span style={{ fontSize: '0.65rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600 }}>
              Now Streaming · 10M+ Tracks
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem,6.5vw,6.5rem)',
            fontWeight: 300, lineHeight: 1.02, letterSpacing: '-0.04em',
            color: 'var(--ivory)', margin: '0 0 26px',
          }}>
            <span style={{ display: 'block', opacity: 1 }}>{heroText1 || '\u00a0'}</span>
            <em style={{
              display: 'block', fontStyle: 'italic', fontWeight: 400, color: 'var(--gold)',
              textShadow: '0 0 80px rgba(232,184,75,0.4), 0 0 160px rgba(232,184,75,0.15)',
              letterSpacing: '-0.03em',
            }}>
              {heroText2 || '\u00a0'}
            </em>
          </h1>

          <p className="anim-fade-up anim-fade-up-2" style={{
            fontSize: '0.95rem', color: 'var(--muted-text)', lineHeight: 1.85,
            margin: '0 0 40px', maxWidth: 430,
          }}>
            Discover millions of songs, build playlists that define your world,
            and connect with artists shaping the sound of tomorrow.
          </p>

          <div className="anim-fade-up anim-fade-up-3" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <MagneticWrap>
              {user ? (
                <Link href={getRoleHome(user?.roles, locale)} className="btn-gold" style={{
                  padding: '14px 34px', borderRadius: 8, fontSize: '0.88rem', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0d0d0d',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Go to App
                </Link>
              ) : (
                <Link href={`/${locale}/register`} className="btn-gold" style={{
                  padding: '14px 34px', borderRadius: 8, fontSize: '0.88rem', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0d0d0d',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Start Listening Free
                </Link>
              )}
            </MagneticWrap>
            <MagneticWrap>
              <Link href={`/${locale}/browse`} style={{
                padding: '14px 28px', borderRadius: 8, fontSize: '0.88rem', fontWeight: 500,
                color: 'var(--ivory)', textDecoration: 'none',
                border: '1px solid rgba(245,238,216,0.14)', display: 'inline-block',
                transition: 'border-color 0.25s, background 0.25s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.4)'; e.currentTarget.style.background = 'rgba(232,184,75,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,238,216,0.14)'; e.currentTarget.style.background = 'transparent'; }}>
                Explore Library
              </Link>
            </MagneticWrap>
          </div>

          {/* Live spectrum */}
          <div className="anim-fade-up anim-fade-up-4" style={{ marginTop: 52, display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <Spectrum />
            <span style={{ fontSize: '0.68rem', color: 'var(--muted-text)', letterSpacing: '0.1em', paddingBottom: 8 }}>Live · 24/7 curated streaming</span>
          </div>
        </div>

        {/* Right 3D Vinyl */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', paddingTop: 68,
          transform: `translateY(-${parallax2}px)`,
        }}>
          {/* Radial glow */}
          <div style={{
            position: 'absolute', width: 520, height: 520, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,184,75,0.14) 0%, rgba(232,184,75,0.03) 55%, transparent 70%)',
            animation: 'orbFloat 7s ease-in-out infinite',
          }} />
          {/* Shadow */}
          <div style={{
            position: 'absolute', bottom: -10, width: '60%', height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.7)', filter: 'blur(28px)',
          }} />

          <Vinyl3D />

          {/* Now Playing card */}
          <div style={{ position: 'absolute', top: '12%', right: '-4%', zIndex: 20 }}>
            <NowPlayingCard />
          </div>

          {/* Listeners badge */}
          <div style={{
            position: 'absolute', bottom: '22%', left: '-4%', zIndex: 20,
            padding: '12px 18px',
            background: 'rgba(14,12,8,0.9)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(232,184,75,0.14)', borderRadius: 12,
            animation: 'floatCard2 6s ease-in-out infinite',
            boxShadow: '0 16px 50px rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ display: 'flex' }}>
              {['#e8b84b','#a07d2e','#c9962d'].map((c, i) => (
                <div key={i} style={{
                  width: 26, height: 26, borderRadius: '50%', background: c,
                  border: '2px solid #0d0d0d', marginLeft: i ? -8 : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 700, color: '#0d0d0d',
                }}>
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ivory)' }}>1.2M+ listeners</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--muted-text)' }}>active this week</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ────────────────────────────────────────────────────────── */}
      <Marquee />

      {/* ── PERSONALIZED RECS / GUEST EXPLORE ─────────────────────────────── */}
      {user ? <AuthZone locale={locale} /> : <GuestZone locale={locale} />}

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(72px,9vw,130px) clamp(24px,6vw,96px)',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32,
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 100% at 50% 50%, rgba(232,184,75,0.035) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <AnimCounter to={10}   suffix="M+" label="Tracks Available" />
        <AnimCounter to={4200} suffix="+"  label="Independent Artists" />
        <AnimCounter to={98}   suffix="%"  label="Lossless Quality" />
        <AnimCounter to={150}  suffix="+"  label="Genre Curations" />
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,100px) clamp(24px,6vw,96px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>
            Why My Music
          </p>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,3.5rem)',
            fontWeight: 300, color: 'var(--ivory)', lineHeight: 1.12, margin: 0,
          }}>
            Sound without compromise.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
          <FeatureCard delay={0}    icon="🎵" title="Lossless Audio"    desc="Stream at up to 24-bit / 192kHz FLAC. Every note, every nuance, exactly as the artist intended." />
          <FeatureCard delay={0.12} icon="🌐" title="Offline Mode"     desc="Download any track, album, or playlist. Your music goes wherever you go — no signal required." />
          <FeatureCard delay={0.24} icon="🎛️" title="AI-Matched Radio" desc="Our neural engine analyzes 40+ audio signals to find music that resonates with your exact mood." />
          <FeatureCard delay={0.36} icon="🎤" title="Artist Direct"   desc="Connect with artists through live sessions, exclusive drops, and behind-the-scenes audio journals." />
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,100px) clamp(24px,6vw,96px)', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(80,40,160,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>Listeners love it</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,3.5vw,3rem)', fontWeight: 300, color: 'var(--ivory)', lineHeight: 1.15, margin: 0 }}>
            Trusted by <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>audiophiles.</em>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <TestCard idx={0} name="Sofia Laurent" handle="@sofialaurent"  text="The lossless quality actually changed how I experience music. I hear things I never noticed before." />
          <TestCard idx={1} name="Marcus Webb"   handle="@marcuswebb_mx" text="The AI radio is uncanny. It knows my taste better than I do. Been discovering gems every single day." />
          <TestCard idx={2} name="Yuki Tanaka"   handle="@yukitanaka.dj" text="As a DJ, the catalog depth is unreal. The offline mode means I'm always covered, no matter the venue." />
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section style={{
        margin: '0 clamp(20px,4vw,60px) clamp(60px,8vw,100px)',
        borderRadius: 24, padding: 'clamp(56px,8vw,104px) clamp(32px,6vw,80px)',
        background: 'linear-gradient(135deg, #0e0b06 0%, #111009 45%, #0a0a0a 100%)',
        border: '1px solid rgba(232,184,75,0.14)', position: 'relative', overflow: 'hidden', textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 450, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(232,184,75,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />
        {/* Animated corner accents */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 80, height: 1, background: 'linear-gradient(90deg, var(--gold), transparent)', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 80, background: 'linear-gradient(180deg, var(--gold), transparent)', opacity: 0.5 }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 80, height: 1, background: 'linear-gradient(270deg, var(--gold), transparent)', opacity: 0.5 }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 1, height: 80, background: 'linear-gradient(0deg, var(--gold), transparent)', opacity: 0.5 }} />

        <p style={{ fontSize: '0.62rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 22, position: 'relative', zIndex: 1 }}>
          Free Forever · No Credit Card
        </p>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(2.4rem,5vw,4.5rem)',
          fontWeight: 300, color: 'var(--ivory)', lineHeight: 1.08, margin: '0 0 22px', position: 'relative', zIndex: 1,
        }}>
          Ready to listen?
        </h2>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.9rem', marginBottom: 44, position: 'relative', zIndex: 1 }}>
          Join over 1 million listeners exploring the world through sound.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <MagneticWrap>
            <Link href={`/${locale}/register`} className="btn-gold" style={{
              padding: '15px 40px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0d0d0d', textDecoration: 'none', display: 'inline-block',
            }}>Create Account</Link>
          </MagneticWrap>
          <MagneticWrap>
            <Link href={`/${locale}/login`} style={{
              padding: '15px 30px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500,
              color: 'var(--ivory)', textDecoration: 'none', border: '1px solid rgba(245,238,216,0.15)', display: 'inline-block',
              transition: 'border-color 0.25s, background 0.25s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.4)'; e.currentTarget.style.background = 'rgba(232,184,75,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,238,216,0.15)'; e.currentTarget.style.background = 'transparent'; }}>
              Sign In
            </Link>
          </MagneticWrap>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(232,184,75,0.07)',
        padding: '28px clamp(24px,6vw,96px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
              <path d="M7 3.5V14.5M7 3.5L13 6M7 3.5L13 6V11.5L7 14.5V3.5Z" stroke="#0d0d0d" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--ivory)', fontWeight: 600 }}>My Music</span>
        </div>
        <p style={{ fontSize: '0.65rem', color: '#2e2820', letterSpacing: '0.08em' }}>
          © {new Date().getFullYear()} My Music. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
