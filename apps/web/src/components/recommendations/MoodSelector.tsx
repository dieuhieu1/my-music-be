'use client';

import { useState } from 'react';
import type { MoodType } from '@/lib/api/recommendations.api';

interface MoodOption {
  value: MoodType;
  label: string;
  emoji: string;
  bpmLabel: string;
}

const MOODS: MoodOption[] = [
  { value: 'HAPPY',   label: 'Happy',   emoji: '😊', bpmLabel: '120–145 BPM' },
  { value: 'SAD',     label: 'Sad',     emoji: '😔', bpmLabel: '60–90 BPM' },
  { value: 'FOCUS',   label: 'Focus',   emoji: '🎯', bpmLabel: '70–100 BPM' },
  { value: 'CHILL',   label: 'Chill',   emoji: '🌙', bpmLabel: '80–110 BPM' },
  { value: 'WORKOUT', label: 'Workout', emoji: '💪', bpmLabel: '130–175 BPM' },
];

interface Props {
  selected: MoodType | null;
  onChange: (mood: MoodType | null) => void;
}

export function MoodSelector({ selected, onChange }: Props) {
  const [hovered, setHovered] = useState<MoodType | null>(null);

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {MOODS.map((m, i) => {
        const active = selected === m.value;
        const isHov = hovered === m.value;
        return (
          <button
            key={m.value}
            type="button"
            className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}
            onClick={() => onChange(active ? null : m.value)}
            onMouseEnter={() => setHovered(m.value)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 6, padding: '14px 18px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${active ? 'var(--gold)' : isHov ? 'rgba(232,184,75,0.3)' : 'rgba(232,184,75,0.1)'}`,
              background: active ? 'rgba(232,184,75,0.12)' : isHov ? 'rgba(232,184,75,0.06)' : 'rgba(17,17,17,0.8)',
              transform: isHov || active ? 'translateY(-2px)' : 'translateY(0)',
              transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)',
              boxShadow: active ? '0 0 16px rgba(232,184,75,0.2)' : 'none',
              minWidth: 88,
            }}
          >
            <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{m.emoji}</span>
            <span style={{
              fontFamily: 'var(--font-display)',
              color: active ? 'var(--gold)' : 'var(--ivory)',
              fontSize: '0.92rem', fontWeight: 600, letterSpacing: '0.01em',
              transition: 'color 0.15s',
            }}>
              {m.label}
            </span>
            <span style={{ color: 'var(--muted-text)', fontSize: '0.65rem', letterSpacing: '0.02em' }}>
              {m.bpmLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
