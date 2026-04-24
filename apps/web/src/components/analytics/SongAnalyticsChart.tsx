'use client';

import { useMemo } from 'react';
import type { DailyPlay } from '@/lib/api/analytics.api';

interface SongAnalyticsChartProps {
  data: DailyPlay[];
  height?: number;
}

export function SongAnalyticsChart({ data, height = 140 }: SongAnalyticsChartProps) {
  const { points, areaPath, linePath, max, labels } = useMemo(() => {
    if (!data.length) return { points: [], areaPath: '', linePath: '', max: 0, labels: [] };

    const w = 600;
    const h = height - 24;
    const padL = 8;
    const padR = 8;
    const innerW = w - padL - padR;
    const innerH = h - 16;
    const maxVal = Math.max(...data.map((d) => d.count), 1);

    const pts = data.map((d, i) => ({
      x: padL + (i / (data.length - 1)) * innerW,
      y: 8 + innerH - (d.count / maxVal) * innerH,
      count: d.count,
      date: d.date,
    }));

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${(8 + innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(8 + innerH).toFixed(1)} Z`;

    const labelStep = Math.ceil(data.length / 6);
    const lbls = data
      .map((d, i) => ({ i, date: d.date, x: padL + (i / (data.length - 1)) * innerW }))
      .filter((_, i) => i % labelStep === 0 || i === data.length - 1);

    return { points: pts, areaPath: area, linePath: line, max: maxVal, labels: lbls };
  }, [data, height]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

  if (!data.length) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--muted-text)', fontSize: '0.78rem',
      }}>
        No data available
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <svg
        viewBox={`0 0 600 ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
      >
        <defs>
          <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(232,184,75,0.22)" />
            <stop offset="100%" stopColor="rgba(232,184,75,0)"    />
          </linearGradient>
          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1="8" x2="592"
              y1={8 + (1 - f) * (height - 40)}
              y2={8 + (1 - f) * (height - 40)}
              stroke="rgba(42,37,32,0.4)" strokeWidth="1"
            />
          ))}
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1="8" x2="592"
            y1={8 + (1 - f) * (height - 40)}
            y2={8 + (1 - f) * (height - 40)}
            stroke="rgba(42,37,32,0.4)" strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#goldArea)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.count > 0 ? 3 : 0}
            fill="var(--gold)"
            opacity={0.7}
          />
        ))}

        {/* X-axis labels */}
        {labels.map(({ i, date, x }) => (
          <text
            key={i}
            x={x}
            y={height - 4}
            textAnchor="middle"
            fill="rgba(90,85,80,0.7)"
            fontSize="9"
            fontFamily="var(--font-body)"
          >
            {fmtDate(date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
