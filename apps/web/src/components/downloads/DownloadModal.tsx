'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Download, CheckCircle2, AlertCircle, Crown, Music2 } from 'lucide-react';
import { downloadsApi } from '@/lib/api/downloads.api';
import { useAuthStore } from '@/store/useAuthStore';
import { decryptSong, triggerBlobDownload } from '@/lib/utils/crypto';
import { PremiumUpgradeModal } from '@/components/payment/PremiumUpgradeModal';
import { Role } from '@mymusic/types';

interface DownloadSong {
  id: string;
  title: string;
  artistName?: string;
  coverArtUrl?: string | null;
}

interface DownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: DownloadSong;
}

type Status = 'idle' | 'downloading' | 'success' | 'error';

function QuotaBar({ used, quota }: { used: number; quota: number }) {
  const [animate, setAnimate] = useState(false);
  const pct = Math.min((used / quota) * 100, 100);
  const nearLimit = pct >= 90;

  useEffect(() => { const t = setTimeout(() => setAnimate(true), 60); return () => clearTimeout(t); }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Downloads used
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: nearLimit ? 'hsl(var(--destructive))' : 'var(--ivory)' }}>
          {used} <span style={{ color: 'var(--muted-text)', fontSize: 13 }}>/ {quota}</span>
        </span>
      </div>
      {/* Track */}
      <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        {/* Wrapper sized to target percentage; inner div animates 0→100% of wrapper */}
        <div style={{ width: `${pct}%`, height: '100%' }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 4,
            background: nearLimit
              ? 'linear-gradient(90deg, hsl(var(--destructive)) 0%, rgba(220,50,50,0.7) 100%)'
              : 'linear-gradient(90deg, var(--gold-dim) 0%, var(--gold) 100%)',
            animation: animate ? 'progressGrow 0.7s cubic-bezier(0.16,1,0.3,1) both' : 'none',
          }} />
        </div>
      </div>
    </div>
  );
}

export function DownloadModal({ open, onOpenChange, song }: DownloadModalProps) {
  const { user, isPremium, hasRole } = useAuthStore();
  const [quotaUsed, setQuotaUsed]     = useState<number | null>(null);
  const [quota, setQuota]             = useState<number>(100);
  const [status, setStatus]           = useState<Status>('idle');
  const [error, setError]             = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const fetchedRef                    = useRef(false);

  const premium = isPremium();

  // Fetch current quota on open
  useEffect(() => {
    if (!open) { fetchedRef.current = false; setStatus('idle'); setError(null); return; }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    downloadsApi.getDownloads()
      .then((res) => {
        const d = res.data?.data ?? res.data;
        setQuotaUsed(d.downloadCount ?? (d.items?.length ?? 0));
        setQuota(d.downloadQuota ?? (hasRole(Role.ARTIST) ? 200 : 100));
      })
      .catch(() => {
        setQuotaUsed(0);
        setQuota(hasRole(Role.ARTIST) ? 200 : 100);
      });
  }, [open, hasRole]);

  const handleDownload = async () => {
    if (status !== 'idle') return;
    setStatus('downloading');
    setError(null);
    try {
      // 1. Get license + presigned URL
      const licenseRes = await downloadsApi.downloadSong(song.id);
      const licenseData = licenseRes.data?.data ?? licenseRes.data;
      const { licenseJwt, downloadUrl } = licenseData as { licenseJwt: string; downloadUrl: string };

      // 2. Fetch encrypted .enc file
      const encRes = await fetch(downloadUrl);
      if (!encRes.ok) throw new Error('Failed to retrieve the audio file. Please try again.');
      const encBuffer = await encRes.arrayBuffer();

      // 3. Client-side AES-CBC decrypt
      const decBuffer = await decryptSong(encBuffer, licenseJwt);

      // 4. Trigger browser save
      triggerBlobDownload(decBuffer, `${song.title}.mp3`);

      setStatus('success');
      setQuotaUsed((prev) => (prev !== null ? prev + 1 : null));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed. Please try again.';
      setError(msg);
      setStatus('error');
    }
  };

  const atLimit = quotaUsed !== null && quota !== null && quotaUsed >= quota;

  // ── Non-premium gate ───────────────────────────────────────────────────────
  if (!premium) {
    return (
      <>
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
          <Dialog.Portal>
            <Dialog.Overlay style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }} />
            <Dialog.Content
              className="anim-scale-reveal"
              style={{
                position: 'fixed', top: '50%', left: '50%', zIndex: 201,
                transform: 'translate(-50%,-50%)',
                width: 'min(420px, 94vw)',
                background: 'var(--surface)',
                border: '1px solid rgba(232,184,75,0.12)',
                borderRadius: 14,
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                padding: '36px 28px',
                textAlign: 'center',
              }}
            >
              <Crown size={36} color="var(--gold)" style={{ marginBottom: 14 }} />
              <Dialog.Title style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ivory)', margin: '0 0 10px' }}>
                Premium Required
              </Dialog.Title>
              <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 14, margin: '0 0 22px' }}>
                Download songs to listen offline. Upgrade to Premium to unlock up to 100 downloads.
              </p>
              <button
                onClick={() => { onOpenChange(false); setShowUpgrade(true); }}
                className="btn-gold"
                style={{
                  width: '100%', padding: '13px', borderRadius: 8, border: 'none',
                  color: 'var(--charcoal)', fontWeight: 700, fontSize: 15,
                  fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 44,
                }}
                onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
                onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
              >
                Go Premium →
              </button>
              <Dialog.Close asChild>
                <button
                  style={{
                    position: 'absolute', top: 14, right: 14,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted-text)', padding: 6, borderRadius: 6,
                    minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
                  onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <PremiumUpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
      </>
    );
  }

  // ── Premium download flow ──────────────────────────────────────────────────
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (status !== 'downloading') onOpenChange(v); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }} />
        <Dialog.Content
          className="anim-scale-reveal"
          style={{
            position: 'fixed', top: '50%', left: '50%', zIndex: 201,
            transform: 'translate(-50%,-50%)',
            width: 'min(440px, 94vw)',
            background: 'var(--surface)',
            border: '1px solid rgba(232,184,75,0.12)',
            borderRadius: 14,
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '20px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Dialog.Title style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ivory)', margin: 0 }}>
              Download Song
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                disabled={status === 'downloading'}
                style={{
                  background: 'none', border: 'none', cursor: status === 'downloading' ? 'not-allowed' : 'pointer',
                  color: 'var(--muted-text)', padding: 6, borderRadius: 6,
                  minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s', outline: 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ivory)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-text)'; }}
                onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
                onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div style={{ padding: '18px 22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Song info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 6, flexShrink: 0,
                background: 'rgba(232,184,75,0.05)',
                border: '1px solid rgba(232,184,75,0.1)',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {song.coverArtUrl
                  ? <img src={song.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Music2 size={20} color="rgba(232,184,75,0.3)" />
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ivory)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0,
                }}>
                  {song.title}
                </p>
                {song.artistName && (
                  <p style={{ color: 'var(--muted-text)', fontSize: 13, fontFamily: 'var(--font-body)', margin: '3px 0 0' }}>
                    {song.artistName}
                  </p>
                )}
              </div>
            </div>

            {/* Quota bar */}
            {quotaUsed !== null
              ? <QuotaBar used={quotaUsed} quota={quota} />
              : <div style={{ height: 36, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
            }

            {/* Action area */}
            {status === 'success' ? (
              <div className="anim-scale-reveal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <CheckCircle2 size={32} color="var(--gold)" strokeWidth={1.5} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ivory)', margin: 0 }}>
                  Saved to your device
                </p>
              </div>
            ) : atLimit ? (
              <div style={{ padding: '12px 14px', background: 'rgba(220,50,50,0.07)', border: '1px solid rgba(220,50,50,0.2)', borderRadius: 8 }}>
                <p style={{ color: 'hsl(var(--destructive))', fontFamily: 'var(--font-body)', fontSize: 13, margin: '0 0 8px' }}>
                  Download limit reached ({quota}/{quota}). Remove existing downloads to free up space.
                </p>
                <a
                  href={`#downloads`}
                  onClick={() => onOpenChange(false)}
                  style={{ color: 'var(--gold)', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline' }}
                >
                  Manage downloads →
                </a>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertCircle size={15} color="hsl(var(--destructive))" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: 'hsl(var(--destructive))', fontFamily: 'var(--font-body)', fontSize: 13, margin: 0 }}>
                      {error}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleDownload}
                  disabled={status === 'downloading'}
                  className="btn-gold"
                  style={{
                    width: '100%', padding: '13px', borderRadius: 8, border: 'none',
                    color: 'var(--charcoal)', fontWeight: 700, fontSize: 15,
                    fontFamily: 'var(--font-body)', cursor: status === 'downloading' ? 'not-allowed' : 'pointer',
                    opacity: status === 'downloading' ? 0.75 : 1, minHeight: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}
                  onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
                  onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
                >
                  {status === 'downloading' ? (
                    <>
                      <div
                        className="vinyl-spin"
                        style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          background: 'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.3), rgba(0,0,0,0.6))',
                          border: '2px solid rgba(13,13,13,0.4)',
                        }}
                      />
                      Decrypting…
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      {error ? 'Retry Download' : 'Download'}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
