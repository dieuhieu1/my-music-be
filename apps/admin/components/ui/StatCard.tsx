'use client';

import { ArrowUp, ArrowDown, Minus, type LucideIcon } from 'lucide-react';

interface StatCardTrend {
  value: number;
  direction: 'up' | 'down' | 'neutral';
  label: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  trend?: StatCardTrend;
  loading?: boolean;
  className?: string;
}

function SkeletonBlock({ w, h }: { w: number | string; h: number }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: 'var(--radius-sm)' }}
    />
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  loading,
  className = '',
}: StatCardProps) {
  const trendColor =
    trend?.direction === 'up'
      ? 'var(--success)'
      : trend?.direction === 'down'
        ? 'var(--danger)'
        : 'var(--text-muted)';

  const TrendIcon =
    trend?.direction === 'up'
      ? ArrowUp
      : trend?.direction === 'down'
        ? ArrowDown
        : Minus;

  if (loading) {
    return (
      <div
        className={`animate-fade-in-up ${className}`}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <SkeletonBlock w={90} h={10} />
          <SkeletonBlock w={40} h={40} />
        </div>
        <SkeletonBlock w={72} h={28} />
        <div style={{ marginTop: 10 }}>
          <SkeletonBlock w={110} h={12} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`animate-fade-in-up ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        boxShadow: 'var(--shadow-sm)',
        transition: 'box-shadow 200ms ease, border-color 200ms ease, transform 200ms ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = 'var(--border-2)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Row 1: label + icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--text-faint)',
        }}>
          {label}
        </span>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius)',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={20} color={iconColor} strokeWidth={1.8} />
        </div>
      </div>

      {/* Row 2: value + trend badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {value}
        </span>
        {trend && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '3px 7px',
            borderRadius: 'var(--radius-full)',
            background: trend.direction === 'up'
              ? 'var(--success-light)'
              : trend.direction === 'down'
                ? 'var(--danger-light)'
                : 'var(--bg-subtle)',
          }}>
            <TrendIcon size={11} color={trendColor} strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 500, color: trendColor }}>
              {trend.direction !== 'neutral' && (trend.direction === 'up' ? '+' : '')}{trend.value}%
            </span>
          </div>
        )}
      </div>

      {/* Row 3: trend label */}
      {trend && (
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{trend.label}</span>
        </div>
      )}
    </div>
  );
}
