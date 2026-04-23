'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarDays, X, AlertTriangle } from 'lucide-react';
import { dropsApi } from '@/lib/api/drops.api';

interface RescheduleDropModalProps {
  songId: string;
  songTitle: string;
  hasRescheduled: boolean;
  open: boolean;
  onClose: () => void;
  onSuccess: (requiresReApproval: boolean) => void;
}

function getMinDatetimeLocal(): string {
  const d = new Date(Date.now() + 3_600_000 + 60_000); // now + 1h + 1min buffer
  // datetime-local format: YYYY-MM-DDTHH:MM
  return d.toISOString().slice(0, 16);
}

export default function RescheduleDropModal({
  songId, songTitle, hasRescheduled, open, onClose, onSuccess,
}: RescheduleDropModalProps) {
  const [dropAt, setDropAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!dropAt) { setError('Please select a new drop date and time.'); return; }

    const selected = new Date(dropAt).getTime();
    const minTime  = Date.now() + 3_600_000;
    if (selected < minTime) { setError('Drop time must be at least 1 hour from now.'); return; }

    setLoading(true);
    try {
      const res = await dropsApi.rescheduleDrop(songId, new Date(dropAt).toISOString());
      const data = res.data?.data ?? res.data;
      onSuccess(!!data?.requiresReApproval);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setError(msg || 'Failed to reschedule. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const minVal = getMinDatetimeLocal();

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) { setDropAt(''); setError(''); onClose(); } }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
            zIndex: 60,
          }}
        />
        <Dialog.Content
          className="anim-scale-reveal"
          style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '92vw', maxWidth: 440,
            background: 'var(--surface-2)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: '28px 28px 24px',
            zIndex: 61,
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          }}
        >
          {/* Close */}
          <Dialog.Close asChild>
            <button
              type="button"
              style={{
                position: 'absolute', top: 14, right: 14,
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)', border: 'none',
                cursor: 'pointer', color: 'var(--muted-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--ivory)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--muted-text)'; }}
            >
              <X size={14} />
            </button>
          </Dialog.Close>

          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(232,184,75,0.08)',
              border: '1px solid rgba(232,184,75,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CalendarDays size={22} style={{ color: 'var(--gold)' }} />
            </div>
          </div>

          <Dialog.Title asChild>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.15rem', fontWeight: 500,
              color: 'var(--ivory)', textAlign: 'center', marginBottom: 6,
            }}>
              Reschedule Drop
            </h2>
          </Dialog.Title>

          <Dialog.Description asChild>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-text)', textAlign: 'center', marginBottom: 20 }}>
              Set a new release date for <span style={{ color: 'var(--ivory)' }}>"{songTitle}"</span>
            </p>
          </Dialog.Description>

          {/* Final reschedule warning */}
          {hasRescheduled && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px',
              background: 'rgba(232,184,75,0.06)',
              border: '1px solid rgba(232,184,75,0.25)',
              borderRadius: 8,
              marginBottom: 18,
            }}>
              <AlertTriangle size={15} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '0.76rem', color: 'var(--gold)', lineHeight: 1.5 }}>
                This is your final reschedule — a 2nd reschedule sends the song back to pending review for admin approval.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: 'block', fontSize: '0.72rem',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'rgba(232,184,75,0.45)', marginBottom: 8,
              }}>
                New Drop Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={dropAt}
                min={minVal}
                onChange={e => { setDropAt(e.target.value); setError(''); }}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: 'var(--ivory)',
                  fontSize: '0.84rem',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  transition: 'border-color 0.18s',
                  colorScheme: 'dark',
                }}
                onFocus={e  => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.4)'; }}
                onBlur={e   => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />
              <p style={{ fontSize: '0.68rem', color: 'var(--muted-text)', marginTop: 6 }}>
                Must be ≥ 1 hour from now
              </p>
            </div>

            {error && (
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--destructive))', marginBottom: 14 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--muted-text)', fontSize: '0.82rem',
                  fontFamily: 'var(--font-body)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.color = 'var(--ivory)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; } }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={!loading && dropAt ? 'btn-gold' : ''}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  background: loading || !dropAt ? 'rgba(232,184,75,0.1)' : undefined,
                  border: loading || !dropAt ? '1px solid rgba(232,184,75,0.15)' : 'none',
                  color: loading || !dropAt ? 'var(--muted-text)' : '#0d0d0d',
                  fontSize: '0.82rem', fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  cursor: loading || !dropAt ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
