'use client';

import { useMemo } from 'react';

interface DataPoint { label: string; value: number; }

interface LineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  title?: string;
  subtitle?: string;
}

export function LineChart({
  data,
  height = 140,
  color = 'var(--accent)',
  title,
  subtitle,
}: LineChartProps) {
  const resolvedColor = color === 'var(--accent)' ? '#6366F1' : color;

  const { points, area } = useMemo(() => {
    if (!data.length) return { points: '', area: '' };
    const W = 560, H = height - 32;
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const xs = data.map((_, i) => (i / (data.length - 1 || 1)) * W);
    const ys = data.map((d) => H - (d.value / maxVal) * H);
    const pts = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
    return { points: pts, area: `0,${H} ${pts} ${W},${H}` };
  }, [data, height]);

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
        <>
          <svg width="100%" viewBox={`0 0 560 ${height - 32}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="line-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={resolvedColor} stopOpacity="0.15" />
                <stop offset="100%" stopColor={resolvedColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
              <line key={i} x1={0} y1={(height - 32) * t} x2={560} y2={(height - 32) * t}
                stroke="var(--border)" strokeDasharray="4 4" strokeWidth={1} />
            ))}
            <polygon points={area} fill="url(#line-gradient)" />
            <polyline points={points} fill="none" stroke={resolvedColor}
              strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {[data[0], data[Math.floor(data.length / 2)], data[data.length - 1]].map((d, i) => (
              <span key={i} style={{ fontSize: 11, color: 'var(--text-faint)' }}>{d?.label ?? ''}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
