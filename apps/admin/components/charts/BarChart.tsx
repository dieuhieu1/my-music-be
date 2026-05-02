'use client';

import { useMemo } from 'react';

interface DataPoint { label: string; value: number; }

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  title?: string;
  subtitle?: string;
  formatValue?: (v: number) => string;
}

export function BarChart({
  data,
  height = 140,
  color = 'var(--success)',
  title,
  subtitle,
  formatValue = (v) => v.toLocaleString(),
}: BarChartProps) {
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '20px 24px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {(title || subtitle) && (
        <div style={{ marginBottom: 16 }}>
          {title && <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</p>}
          {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{subtitle}</p>}
        </div>
      )}

      {!data.length ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 12 }}>
          No data
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
          {data.map((d, i) => {
            const pct = (d.value / maxVal) * 100;
            return (
              <div
                key={i}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}
                title={`${d.label}: ${formatValue(d.value)}`}
              >
                <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>
                  {d.value > 0 ? formatValue(d.value) : ''}
                </span>
                <div style={{
                  width: '100%', background: color, borderRadius: '3px 3px 0 0',
                  height: `${pct}%`, minHeight: d.value > 0 ? 2 : 0,
                  opacity: 0.85, transition: 'opacity 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                />
                <span style={{ fontSize: 9, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
