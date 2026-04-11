'use client';
import Link from 'next/link';
import { ReactNode } from 'react';

/* ── Floating music note component ───────────────────────────────────────── */
function FloatingNote({ delay, x, symbol }: { delay: number; x: number; symbol: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '18%',
        left: `${x}%`,
        fontSize: '1.1rem',
        color: 'var(--gold)',
        opacity: 0,
        animation: `floatNote ${3.6 + delay * 0.4}s ease-out infinite`,
        animationDelay: `${delay}s`,
        pointerEvents: 'none',
        userSelect: 'none',
        filter: 'drop-shadow(0 0 6px rgba(232,184,75,0.5))',
      }}
    >
      {symbol}
    </div>
  );
}

/* ── Waveform bars ────────────────────────────────────────────────────────── */
function Waveform() {
  const bars = [0.4, 0.7, 1, 0.8, 0.5, 0.9, 0.6, 1, 0.7, 0.45, 0.85, 0.6, 0.95, 0.5, 0.75];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 2.5,
            height: `${h * 100}%`,
            background: 'var(--gold)',
            borderRadius: 2,
            opacity: 0.55,
            transformOrigin: 'center',
            animation: `waveBar ${0.8 + (i % 5) * 0.18}s ease-in-out infinite`,
            animationDelay: `${i * 0.07}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Ambient particle dots ────────────────────────────────────────────────── */
const PARTICLES = [
  { top: '20%', left: '15%', delay: 0 },
  { top: '35%', left: '70%', delay: 1.2 },
  { top: '55%', left: '25%', delay: 2.4 },
  { top: '70%', left: '60%', delay: 0.8 },
  { top: '80%', left: '40%', delay: 3.1 },
  { top: '15%', left: '55%', delay: 1.8 },
  { top: '45%', left: '80%', delay: 2.9 },
];

/* ── Light beam ───────────────────────────────────────────────────────────── */
function LightBeam({ top, delay }: { top: string; delay: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: '-10%',
        width: '70%',
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(232,184,75,0.12), transparent)',
        transform: 'rotate(-30deg)',
        transformOrigin: 'left center',
        animation: `beamSweep ${5 + delay}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        pointerEvents: 'none',
      }}
    />
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--charcoal)' }}>

      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[42%] flex-col justify-between p-12 relative overflow-hidden noise"
        style={{ backgroundColor: '#060606', borderRight: '1px solid #1a1510' }}
      >
        {/* Light beams */}
        <LightBeam top="25%" delay={0} />
        <LightBeam top="55%" delay={2.5} />
        <LightBeam top="75%" delay={4.5} />

        {/* Particle dots */}
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: p.top,
              left: p.left,
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'var(--gold)',
              opacity: 0,
              animation: `particleDrift ${4.5 + i * 0.3}s ease-out infinite`,
              animationDelay: `${p.delay}s`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Vinyl record — glow + spin */}
        <div
          className="absolute -right-28 top-1/2 -translate-y-1/2 vinyl-spin vinyl-glow"
          style={{ width: 580, height: 580 }}
        >
          <svg viewBox="0 0 580 580" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="vinylSheen" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#3a3020" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#0a0806" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e8b84b" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#e8b84b" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Groove rings */}
            {[290, 272, 254, 236, 220, 204, 188, 172, 157, 143, 129, 116, 104, 92, 81, 71, 61, 52].map((r, i) => (
              <circle
                key={i}
                cx="290" cy="290" r={r}
                stroke={i % 4 === 0 ? '#2e2820' : i % 2 === 0 ? '#201c14' : '#141008'}
                strokeWidth={i % 4 === 0 ? '1.8' : '0.7'}
                fill="none"
              />
            ))}
            {/* Inner sheen highlight */}
            <circle cx="290" cy="290" r="290" fill="url(#vinylSheen)" />
            <circle cx="290" cy="290" r="290" fill="url(#goldGlow)" />
            {/* Label disc */}
            <circle cx="290" cy="290" r="58" fill="#1a1510" />
            <circle cx="290" cy="290" r="50" fill="#0e0c08" stroke="#2e2418" strokeWidth="1" />
            {/* Spindle */}
            <circle cx="290" cy="290" r="8" fill="#e8b84b" />
            <circle cx="290" cy="290" r="3.5" fill="#0d0d0d" />
            {/* Gold highlight arc */}
            <path d="M 115 290 A 175 175 0 0 1 465 290" stroke="#e8b84b" strokeWidth="0.8" opacity="0.15" fill="none" />
            <path d="M 140 220 A 160 160 0 0 1 440 220" stroke="#e8b84b" strokeWidth="0.4" opacity="0.08" fill="none" />
          </svg>
        </div>

        {/* Deep amber ambient glow behind vinyl */}
        <div
          className="absolute pointer-events-none"
          style={{
            right: -80,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,184,75,0.07) 0%, rgba(180,120,30,0.03) 45%, transparent 70%)',
          }}
        />
        {/* Secondary cool teal counter-glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: -60,
            top: '30%',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(40,80,100,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Floating music notes */}
        <FloatingNote delay={0}   x={18} symbol="♪" />
        <FloatingNote delay={1.5} x={35} symbol="♫" />
        <FloatingNote delay={2.8} x={55} symbol="♩" />
        <FloatingNote delay={0.9} x={72} symbol="♬" />
        <FloatingNote delay={3.6} x={28} symbol="♪" />
        <FloatingNote delay={4.4} x={62} symbol="♫" />

        {/* Brand */}
        <Link href="/" className="relative z-10 flex items-center gap-3 group">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
            style={{ background: 'var(--gold)', boxShadow: '0 0 24px rgba(232,184,75,0.45)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M7 3.5V14.5M7 3.5L13 6M7 3.5L13 6V11.5L7 14.5V3.5Z" stroke="#0d0d0d" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 600, color: 'var(--ivory)', letterSpacing: '0.01em' }}>
            My Music
          </span>
        </Link>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          {/* Waveform */}
          <Waveform />

          <div style={{ width: 36, height: 1, background: 'var(--gold)', opacity: 0.5 }} />

          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.9rem',
              lineHeight: 1.12,
              fontWeight: 500,
              color: 'var(--ivory)',
              letterSpacing: '-0.02em',
            }}
          >
            Your music,<br />
            <em style={{ fontWeight: 400, color: 'var(--gold)', fontStyle: 'italic' }}>your world.</em>
          </p>

          <p style={{
            fontSize: '0.72rem',
            color: 'var(--muted-text)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}>
            Stream · Download · Discover
          </p>
        </div>

        {/* Footer */}
        <p className="relative z-10" style={{ fontSize: '0.68rem', color: '#2e2820', letterSpacing: '0.06em' }}>
          © {new Date().getFullYear()} My Music. All rights reserved.
        </p>
      </div>

      {/* ── Right panel: Form ────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col justify-center px-6 py-10 lg:px-16 xl:px-24 overflow-y-auto"
        style={{ backgroundColor: 'var(--charcoal)' }}
      >
        {/* Mobile brand */}
        <div className="flex justify-center mb-10 lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--gold)' }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M7 3.5V14.5M7 3.5L13 6M7 3.5L13 6V11.5L7 14.5V3.5Z" stroke="#0d0d0d" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--ivory)' }}>
              My Music
            </span>
          </Link>
        </div>

        <div className="w-full max-w-[420px] mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
