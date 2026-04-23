'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { dropsApi } from '@/lib/api/drops.api';

interface CancelDropModalProps {
  songId: string;
  songTitle: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancelDropModal({ songId, songTitle, open, onClose, onSuccess }: CancelDropModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    setLoading(true);
    setError('');
    try {
      await dropsApi.cancelDrop(songId);
      onSuccess();
      onClose();
    } catch {
      setError('Failed to cancel drop. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
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
            width: '92vw', maxWidth: 420,
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
                background: 'rgba(255,255,255,0.05)',
                border: 'none', cursor: 'pointer',
                color: 'var(--muted-text)',
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
              background: 'rgba(220,80,80,0.1)',
              border: '1px solid rgba(220,80,80,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={22} style={{ color: 'hsl(var(--destructive))' }} />
            </div>
          </div>

          {/* Title */}
          <Dialog.Title asChild>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.15rem',
              fontWeight: 500,
              color: 'var(--ivory)',
              textAlign: 'center',
              marginBottom: 10,
            }}>
              Cancel Drop?
            </h2>
          </Dialog.Title>

          {/* Description */}
          <Dialog.Description asChild>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-text)', textAlign: 'center', lineHeight: 1.55, marginBottom: 24 }}>
              Cancel the scheduled drop for <span style={{ color: 'var(--ivory)' }}>"{songTitle}"</span>?
              The song will revert to <span style={{ color: 'var(--gold)' }}>Approved</span> status.
              Opted-in users will be notified of the cancellation.
            </p>
          </Dialog.Description>

          {error && (
            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--destructive))', textAlign: 'center', marginBottom: 14 }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1, padding: '10px 0',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--muted-text)',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-body)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.color = 'var(--ivory)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; } }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            >
              Keep Drop
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              style={{
                flex: 1, padding: '10px 0',
                borderRadius: 8,
                background: loading ? 'rgba(220,80,80,0.12)' : 'rgba(220,80,80,0.15)',
                border: '1px solid rgba(220,80,80,0.3)',
                color: loading ? 'var(--muted-text)' : 'hsl(var(--destructive))',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(220,80,80,0.25)'; e.currentTarget.style.borderColor = 'rgba(220,80,80,0.5)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,80,80,0.15)'; e.currentTarget.style.borderColor = 'rgba(220,80,80,0.3)'; }}
            >
              {loading ? 'Cancelling…' : 'Cancel Drop'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
