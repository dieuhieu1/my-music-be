'use client';
import Link from 'next/link';
import { ReactNode, useEffect, useRef, useState } from 'react';

/* ── Live Spectrum Canvas ─────────────────────────────────────────────────── */
function SpectrumCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const W = (canvas.width = 220);
    const H = (canvas.height = 48);
    const bars = 28;
    const phases = Array.from({ length: bars }, () => Math.random() * Math.PI * 2);
    const speeds = Array.from({ length: bars }, () => 0.15 + Math.random() * 0.25);
    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const bw = W / bars - 1.2;
      for (let i = 0; i < bars; i++) {
        const h = (0.18 + 0.82 * Math.abs(Math.sin(t * speeds[i] + phases[i]))) * H;
        const x = i * (bw + 1.2);
        const grad = ctx.createLinearGradient(0, H - h, 0, H);
        grad.addColorStop(0, 'rgba(232,184,75,0.85)');
        grad.addColorStop(1, 'rgba(232,184,75,0.12)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, H - h, bw, h, 2);
        ctx.fill();
      }
      t += 0.012;
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}

/* ── Spinning Mini Vinyl ──────────────────────────────────────────────────── */
function MiniVinyl({ size = 72 }: { size?: number }) {
  const spinRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const ang = useRef(0);
  useEffect(() => {
    const go = () => {
      ang.current = (ang.current + 0.22) % 360;
      if (spinRef.current) spinRef.current.style.transform = `rotate(${ang.current}deg)`;
      rafRef.current = requestAnimationFrame(go);
    };
    rafRef.current = requestAnimationFrame(go);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  return (
    <div style={{ width: size, height: size, flexShrink: 0, position: 'relative' }}>
      <div ref={spinRef} style={{ width: '100%', height: '100%' }}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.7)) drop-shadow(0 0 16px rgba(232,184,75,0.15))' }}>
          <defs>
            <radialGradient id="mvBase" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#2a1e0d" />
              <stop offset="100%" stopColor="#060402" />
            </radialGradient>
            <radialGradient id="mvLabel" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f2c840" />
              <stop offset="100%" stopColor="#8a5e18" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="49" fill="url(#mvBase)" />
          {[46,41,36,31,26,21,17,13,10].map((r, i) => (
            <circle key={i} cx="50" cy="50" r={r}
              stroke={i % 3 === 0 ? '#2a2010' : '#141008'}
              strokeWidth={i % 3 === 0 ? 1.2 : 0.5} fill="none" />
          ))}
          <circle cx="50" cy="50" r="16" fill="url(#mvLabel)" />
          {/* Tick mark so spin is visible */}
          <line x1="50" y1="36" x2="50" y2="41" stroke="#e8b84b" strokeWidth="1.2" opacity="0.7" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3.2" fill="#f0c840" />
          <circle cx="50" cy="50" r="1.4" fill="#030201" />
        </svg>
      </div>
    </div>
  );
}

/* ── Now Playing Card ─────────────────────────────────────────────────────── */
function NowPlayingCard() {
  const [playing, setPlaying] = useState(true);
  return (
    <div style={{
      background: 'rgba(12,10,6,0.88)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(232,184,75,0.18)',
      borderRadius: 14,
      padding: '14px 16px',
      animation: 'floatCard1 5.5s ease-in-out infinite',
      boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,184,75,0.05)',
    }}>
      <div style={{ fontSize: '0.58rem', color: 'var(--muted-text)', letterSpacing: '0.14em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px #4ade80', animation: 'orbFloat 1.5s ease-in-out infinite' }} />
        NOW PLAYING
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <MiniVinyl size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ivory)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Midnight Echo</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--gold)' }}>Lunar Wave</div>
        </div>
        <button
          onClick={() => setPlaying(p => !p)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ivory)', padding: 4, display: 'flex', opacity: 0.8 }}
        >
          {playing
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>
      </div>
      <div style={{ marginTop: 10, height: 2, background: 'rgba(232,184,75,0.1)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '38%', background: 'linear-gradient(90deg, var(--gold), #f5d27a)', borderRadius: 2 }} />
      </div>
      <div style={{ marginTop: 5, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.58rem', color: 'var(--muted-text)' }}>1:36</span>
        <span style={{ fontSize: '0.58rem', color: 'var(--muted-text)' }}>4:12</span>
      </div>
    </div>
  );
}

/* ── Floating music note ──────────────────────────────────────────────────── */
function FloatingNote({ delay, x, symbol, size = '1.1rem' }: { delay: number; x: number; symbol: string; size?: string }) {
  return (
    <div style={{
      position: 'absolute', bottom: '15%', left: `${x}%`, fontSize: size,
      color: 'var(--gold)', opacity: 0,
      animation: `floatNote ${3.8 + delay * 0.45}s ease-out infinite`,
      animationDelay: `${delay}s`, pointerEvents: 'none', userSelect: 'none',
      filter: 'drop-shadow(0 0 8px rgba(232,184,75,0.6))',
    }}>
      {symbol}
    </div>
  );
}

/* ── Light beam ───────────────────────────────────────────────────────────── */
function LightBeam({ top, delay }: { top: string; delay: number }) {
  return (
    <div style={{
      position: 'absolute', top, left: '-10%', width: '70%', height: 1,
      background: 'linear-gradient(90deg, transparent, rgba(232,184,75,0.14), transparent)',
      transform: 'rotate(-30deg)', transformOrigin: 'left center',
      animation: `beamSweep ${5 + delay}s ease-in-out infinite`,
      animationDelay: `${delay}s`, pointerEvents: 'none',
    }} />
  );
}

/* ── Ambient particles ────────────────────────────────────────────────────── */
const PARTICLES = [
  { top: '18%', left: '14%', delay: 0, size: 3 },
  { top: '32%', left: '68%', delay: 1.2, size: 4 },
  { top: '52%', left: '22%', delay: 2.5, size: 3 },
  { top: '68%', left: '58%', delay: 0.7, size: 5 },
  { top: '78%', left: '38%', delay: 3.2, size: 3 },
  { top: '13%', left: '52%', delay: 1.9, size: 4 },
  { top: '44%', left: '78%', delay: 2.8, size: 3 },
  { top: '62%', left: '8%',  delay: 1.4, size: 4 },
  { top: '28%', left: '42%', delay: 3.7, size: 2 },
  { top: '86%', left: '72%', delay: 0.3, size: 3 },
];

/* ── Aurora orbs ──────────────────────────────────────────────────────────── */
function AuroraOrbs() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: '-15%', left: '20%', width: 360, height: 280,
        background: 'radial-gradient(ellipse, rgba(232,184,75,0.1) 0%, transparent 68%)',
        animation: 'auroraShift1 14s ease-in-out infinite', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '5%', right: '10%', width: 280, height: 280,
        background: 'radial-gradient(ellipse, rgba(80,40,160,0.1) 0%, transparent 68%)',
        animation: 'auroraShift2 18s ease-in-out infinite', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', top: '40%', left: '-10%', width: 220, height: 220,
        background: 'radial-gradient(ellipse, rgba(20,90,160,0.08) 0%, transparent 70%)',
        animation: 'auroraShift3 11s ease-in-out infinite', borderRadius: '50%' }} />
    </div>
  );
}

/* ── Large spinning vinyl (background decoration) ─────────────────────────── */
function BackgroundVinyl() {
  const spinRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const ang = useRef(0);
  useEffect(() => {
    const go = () => {
      ang.current = (ang.current + 0.12) % 360;
      if (spinRef.current) spinRef.current.style.transform = `rotate(${ang.current}deg)`;
      rafRef.current = requestAnimationFrame(go);
    };
    rafRef.current = requestAnimationFrame(go);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  return (
    <div className="absolute -right-36 top-1/2 -translate-y-1/2" style={{ width: 580, height: 580, opacity: 1 }}>
      <div ref={spinRef} style={{ width: '100%', height: '100%' }}>
        <svg viewBox="0 0 580 580" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ filter: 'drop-shadow(0 0 60px rgba(232,184,75,0.18))' }}>
          <defs>
            <radialGradient id="vinylSheen" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#3a3020" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0a0806" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e8b84b" stopOpacity="0.09" />
              <stop offset="100%" stopColor="#e8b84b" stopOpacity="0" />
            </radialGradient>
          </defs>
          {[290, 272, 254, 236, 220, 204, 188, 172, 157, 143, 129, 116, 104, 92, 81, 71, 61, 52].map((r, i) => (
            <circle key={i} cx="290" cy="290" r={r}
              stroke={i % 4 === 0 ? '#2e2820' : i % 2 === 0 ? '#201c14' : '#141008'}
              strokeWidth={i % 4 === 0 ? '1.8' : '0.7'} fill="none" />
          ))}
          <circle cx="290" cy="290" r="290" fill="url(#vinylSheen)" />
          <circle cx="290" cy="290" r="290" fill="url(#goldGlow)" />
          <circle cx="290" cy="290" r="58" fill="#1a1510" />
          <circle cx="290" cy="290" r="50" fill="#0e0c08" stroke="#2e2418" strokeWidth="1" />
          {/* Tick mark for visible spin */}
          <line x1="290" y1="243" x2="290" y2="256" stroke="#e8b84b" strokeWidth="1.8" opacity="0.5" strokeLinecap="round" />
          <circle cx="290" cy="290" r="8" fill="#e8b84b" />
          <circle cx="290" cy="290" r="3.5" fill="#0d0d0d" />
          <path d="M 115 290 A 175 175 0 0 1 465 290" stroke="#e8b84b" strokeWidth="0.8" opacity="0.12" fill="none" />
        </svg>
      </div>
    </div>
  );
}

/* ── Testimonial pill ─────────────────────────────────────────────────────── */
function TestimonialPill({ text, author, delay }: { text: string; author: string; delay: number }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: 'rgba(14,12,8,0.7)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(232,184,75,0.12)',
      borderRadius: 10,
      animation: `floatCard${delay < 2 ? '1' : '2'} ${5 + delay}s ease-in-out infinite`,
      animationDelay: `${delay}s`,
    }}>
      <p style={{ fontSize: '0.72rem', color: 'rgba(245,238,216,0.7)', lineHeight: 1.55, margin: '0 0 6px' }}>"{text}"</p>
      <span style={{ fontSize: '0.62rem', color: 'var(--gold)', fontWeight: 600 }}>{author}</span>
    </div>
  );
}

/* ── Main Layout ──────────────────────────────────────────────────────────── */
export default function AuthLayoutClient({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--charcoal)' }}>

      {/* ── Left decorative panel ────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[46%] xl:w-[44%] flex-col justify-between p-12 relative overflow-hidden noise"
        style={{ backgroundColor: '#060606', borderRight: '1px solid #16120a' }}
      >
        <AuroraOrbs />

        {/* Light beams */}
        <LightBeam top="22%" delay={0} />
        <LightBeam top="50%" delay={2.8} />
        <LightBeam top="74%" delay={5} />

        {/* Ambient particles */}
        {PARTICLES.map((p, i) => (
          <div key={i} style={{
            position: 'absolute', top: p.top, left: p.left,
            width: p.size, height: p.size, borderRadius: '50%',
            background: 'var(--gold)', opacity: 0,
            animation: `particleDrift ${5 + i * 0.35}s ease-out infinite`,
            animationDelay: `${p.delay}s`, pointerEvents: 'none',
          }} />
        ))}

        {/* Large spinning background vinyl */}
        <BackgroundVinyl />

        {/* Deep amber glow */}
        <div className="absolute pointer-events-none" style={{
          right: -60, top: '50%', transform: 'translateY(-50%)',
          width: 480, height: 480, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,184,75,0.08) 0%, rgba(180,120,30,0.03) 45%, transparent 70%)',
        }} />

        {/* Floating music notes */}
        <FloatingNote delay={0}   x={16} symbol="♪"  />
        <FloatingNote delay={1.4} x={32} symbol="♫"  />
        <FloatingNote delay={2.7} x={52} symbol="♩"  size="0.9rem" />
        <FloatingNote delay={0.8} x={70} symbol="♬"  />
        <FloatingNote delay={3.5} x={24} symbol="♪"  size="0.85rem" />
        <FloatingNote delay={4.2} x={60} symbol="♫"  />
        <FloatingNote delay={1.9} x={44} symbol="𝄞"  size="1.3rem" />

        {/* ── Brand ── */}
        <Link href="/" className="relative z-10 flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
            style={{ background: 'var(--gold)', boxShadow: '0 0 24px rgba(232,184,75,0.45)', animation: 'ringPulse 3s ease-in-out infinite' }}>
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
              <path d="M7 3.5V14.5M7 3.5L13 6M7 3.5L13 6V11.5L7 14.5V3.5Z" stroke="#0d0d0d" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600, color: 'var(--ivory)', letterSpacing: '0.01em' }}>
            My Music
          </span>
        </Link>

        {/* ── Center content ── */}
        <div className="relative z-10 space-y-6">
          {/* Live spectrum */}
          <SpectrumCanvas />

          <div style={{ width: 40, height: 1, background: 'var(--gold)', opacity: 0.45 }} />

          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '2.75rem', lineHeight: 1.1,
            fontWeight: 400, color: 'var(--ivory)', letterSpacing: '-0.025em',
          }}>
            Your music,<br />
            <em style={{ fontWeight: 300, color: 'var(--gold)', fontStyle: 'italic' }}>your world.</em>
          </p>

          <p style={{ fontSize: '0.7rem', color: 'var(--muted-text)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Stream · Download · Discover
          </p>

          {/* Now playing card */}
          <NowPlayingCard />

          {/* Testimonial */}
          <TestimonialPill
            text="The lossless quality is extraordinary. I hear things I never noticed before."
            author="Sofia L. — Verified Listener"
            delay={0}
          />
        </div>

        {/* ── Footer ── */}
        <p className="relative z-10" style={{ fontSize: '0.65rem', color: '#2a2418', letterSpacing: '0.07em' }}>
          © {new Date().getFullYear()} My Music. All rights reserved.
        </p>
      </div>

      {/* ── Right panel: form ────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col justify-center px-6 py-10 lg:px-16 xl:px-24 overflow-y-auto relative"
        style={{ backgroundColor: 'var(--charcoal)' }}
      >
        {/* Subtle background gradient for right panel */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(232,184,75,0.025) 0%, transparent 70%)',
        }} />

        {/* Mobile brand */}
        <div className="flex justify-center mb-10 lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--gold)' }}>
              <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                <path d="M7 3.5V14.5M7 3.5L13 6M7 3.5L13 6V11.5L7 14.5V3.5Z" stroke="#0d0d0d" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--ivory)' }}>
              My Music
            </span>
          </Link>
        </div>

        <div className="w-full max-w-[420px] mx-auto relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
