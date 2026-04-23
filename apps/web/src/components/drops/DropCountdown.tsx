'use client';

import { useEffect, useState } from 'react';

interface DropCountdownProps {
  dropAt: string;
  compact?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calcTimeLeft(dropAt: string): TimeLeft {
  const diff = new Date(dropAt).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const days    = Math.floor(diff / 86_400_000);
  const hours   = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return { days, hours, minutes, seconds, expired: false };
}

export default function DropCountdown({ dropAt, compact = false }: DropCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calcTimeLeft(dropAt));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(calcTimeLeft(dropAt)), 1_000);
    return () => clearInterval(id);
  }, [dropAt]);

  if (timeLeft.expired) {
    return (
      <span
        className="email-pulse-icon"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: compact ? '0.85rem' : '1.1rem',
          color: 'var(--gold)',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        Dropping now!
      </span>
    );
  }

  const units = [
    { label: 'D', value: timeLeft.days },
    { label: 'H', value: timeLeft.hours },
    { label: 'M', value: timeLeft.minutes },
    { label: 'S', value: timeLeft.seconds },
  ];

  if (compact) {
    const parts: string[] = [];
    if (timeLeft.days > 0)    parts.push(`${timeLeft.days}d`);
    if (timeLeft.hours > 0)   parts.push(`${timeLeft.hours}h`);
    if (timeLeft.minutes > 0) parts.push(`${timeLeft.minutes}m`);
    parts.push(`${timeLeft.seconds}s`);
    return (
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--gold)', letterSpacing: '0.04em' }}>
        {parts.join(' ')}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {units.map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              minWidth: 58,
              height: 58,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(232,184,75,0.07)',
              border: '1px solid rgba(232,184,75,0.22)',
              borderRadius: 8,
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 400,
              color: 'var(--gold)',
              letterSpacing: '-0.02em',
              transition: 'border-color 0.3s',
            }}
          >
            {String(value).padStart(2, '0')}
          </div>
          <span style={{ fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-text)' }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
