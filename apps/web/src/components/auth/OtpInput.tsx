'use client';
import { useRef, KeyboardEvent, ClipboardEvent } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  error?: string;
}

export default function OtpInput({ value, onChange, length = 6, error }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, '').split('').slice(0, length);

  const update = (index: number, char: string) => {
    const arr = digits.slice();
    arr[index] = char;
    onChange(arr.join('').trimEnd());
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        update(i, '');
      } else if (i > 0) {
        update(i - 1, '');
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus();
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault();
      update(i, e.key);
      if (i < length - 1) refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>, startIndex: number) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length - startIndex);
    const arr = digits.slice();
    pasted.split('').forEach((ch, j) => {
      if (startIndex + j < length) arr[startIndex + j] = ch;
    });
    onChange(arr.join('').trimEnd());
    const next = Math.min(startIndex + pasted.length, length - 1);
    refs.current[next]?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3 justify-center">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i] ?? ''}
            onChange={() => {}}
            onKeyDown={(e) => handleKey(e, i)}
            onPaste={(e) => handlePaste(e, i)}
            onFocus={(e) => e.target.select()}
            style={{
              width: 46,
              height: 56,
              textAlign: 'center',
              fontSize: '1.4rem',
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              background: '#111111',
              border: `1px solid ${digits[i] ? 'var(--gold)' : '#2a2520'}`,
              borderRadius: 4,
              color: 'var(--ivory)',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              letterSpacing: '0.05em',
            }}
          />
        ))}
      </div>
      {error && (
        <p className="text-center" style={{ fontSize: '0.75rem', color: 'hsl(var(--destructive))' }}>
          {error}
        </p>
      )}
    </div>
  );
}
