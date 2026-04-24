'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Flag, X } from 'lucide-react';
import { reportsApi, type ReportTargetType, type ReportReason } from '@/lib/api/reports.api';

interface ReportModalProps {
  targetType: ReportTargetType;
  targetId: string;
  targetName: string;
  trigger?: React.ReactNode;
  onClose?: () => void;
}

const REASONS: { value: ReportReason; label: string; desc: string }[] = [
  { value: 'EXPLICIT',      label: 'Explicit content',   desc: 'Contains adult or harmful material not marked as explicit' },
  { value: 'COPYRIGHT',     label: 'Copyright violation', desc: 'Uses copyrighted material without permission' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate',       desc: 'Violates community guidelines or terms of service' },
];

export function ReportModal({ targetType, targetId, targetName, trigger, onClose }: ReportModalProps) {
  const [open, setOpen]         = useState(false);
  const [reason, setReason]     = useState<ReportReason | null>(null);
  const [busy, setBusy]         = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const reset = () => {
    setReason(null);
    setBusy(false);
    setDone(false);
    setError(null);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) { reset(); onClose?.(); }
  };

  const handleSubmit = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await reportsApi.createReport({ targetType, targetId, reason });
      setDone(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Failed to submit report';
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button type="button" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 4, background: 'transparent',
            border: '1px solid rgba(42,37,32,0.7)', cursor: 'pointer',
            color: 'var(--muted-text)', fontSize: '0.78rem', fontFamily: 'var(--font-body)',
            transition: 'color 0.15s, border-color 0.15s',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(220,80,80,0.9)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,80,80,0.25)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted-text)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,37,32,0.7)'; }}
          >
            <Flag size={13} />
            Report
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }} />

        <Dialog.Content className="anim-scale-reveal" style={{
          position: 'fixed', top: '50%', left: '50%', zIndex: 201,
          transform: 'translate(-50%,-50%)',
          width: 'min(440px, 92vw)',
          background: 'var(--surface-2)',
          border: '1px solid rgba(232,184,75,0.1)',
          borderRadius: 12, padding: '28px 28px 24px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          outline: 'none',
        }}>
          <Dialog.Title style={{ display: 'none' }}>Report content</Dialog.Title>

          {/* Close */}
          <Dialog.Close asChild>
            <button type="button" style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted-text)', padding: 4, borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s',
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ivory)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted-text)'; }}
            >
              <X size={16} />
            </button>
          </Dialog.Close>

          {done ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
                background: 'rgba(120,200,120,0.08)', border: '1px solid rgba(120,200,120,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Flag size={20} color="rgba(120,200,120,0.8)" />
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--ivory)', marginBottom: 8 }}>
                Report submitted
              </p>
              <p style={{ color: 'var(--muted-text)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                Our moderation team will review this content. Thank you for helping keep the community safe.
              </p>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                style={{
                  marginTop: 20, padding: '9px 24px', borderRadius: 6,
                  background: 'rgba(232,184,75,0.08)', border: '1px solid rgba(232,184,75,0.2)',
                  color: 'var(--gold)', fontSize: '0.82rem', fontFamily: 'var(--font-body)',
                  cursor: 'pointer', letterSpacing: '0.04em',
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Flag size={15} color="rgba(220,80,80,0.8)" />
                </div>
                <div>
                  <p style={{ color: 'var(--ivory)', fontSize: '0.92rem', fontWeight: 500 }}>
                    Report content
                  </p>
                  <p style={{
                    color: 'var(--muted-text)', fontSize: '0.72rem', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280,
                  }}>
                    {targetName}
                  </p>
                </div>
              </div>

              {/* Reason selection */}
              <p style={{
                fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--muted-text)', marginBottom: 10,
              }}>
                Select a reason
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {REASONS.map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReason(value)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                      background: reason === value ? 'rgba(220,80,80,0.06)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${reason === value ? 'rgba(220,80,80,0.3)' : 'rgba(42,37,32,0.6)'}`,
                      textAlign: 'left', fontFamily: 'var(--font-body)',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (reason !== value) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,37,32,0.9)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (reason !== value) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,37,32,0.6)';
                      }
                    }}
                  >
                    <p style={{ color: reason === value ? 'rgba(220,80,80,0.9)' : 'var(--ivory)', fontSize: '0.84rem', fontWeight: 500 }}>
                      {label}
                    </p>
                    <p style={{ color: 'var(--muted-text)', fontSize: '0.72rem', marginTop: 3, lineHeight: 1.4 }}>
                      {desc}
                    </p>
                  </button>
                ))}
              </div>

              {/* Error */}
              {error && (
                <p style={{
                  fontSize: '0.76rem', color: 'rgba(220,80,80,0.9)',
                  padding: '8px 12px', borderRadius: 4,
                  background: 'rgba(220,80,80,0.06)', border: '1px solid rgba(220,80,80,0.2)',
                  marginBottom: 16,
                }}>
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!reason || busy}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 6,
                  background: !reason || busy ? 'rgba(220,80,80,0.04)' : 'rgba(220,80,80,0.1)',
                  border: `1px solid ${!reason || busy ? 'rgba(220,80,80,0.1)' : 'rgba(220,80,80,0.3)'}`,
                  color: !reason || busy ? 'rgba(220,80,80,0.35)' : 'rgba(220,80,80,0.9)',
                  fontSize: '0.82rem', fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
                  cursor: !reason || busy ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                }}
              >
                {busy ? 'Submitting…' : 'Submit report'}
              </button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
