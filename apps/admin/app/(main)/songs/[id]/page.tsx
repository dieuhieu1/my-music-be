'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Music2, Play, Pause } from 'lucide-react';
import { adminApi, type AdminSongDetail, type SongStatus } from '@/lib/api/admin.api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────

function MetaBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function MetaValue({ value }: { value: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, color: 'var(--text)', margin: 0 }}>
      {value ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
    </p>
  );
}

function formatDuration(secs: number | null) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Status action panel ───────────────────────────────────────────────────────

const VALID_TRANSITIONS: Partial<Record<SongStatus, SongStatus[]>> = {
  PENDING:           ['LIVE', 'REJECTED', 'REUPLOAD_REQUIRED'],
  APPROVED:          ['LIVE', 'REJECTED', 'REUPLOAD_REQUIRED'],
  LIVE:              ['TAKEN_DOWN'],
  TAKEN_DOWN:        ['LIVE'],
  REJECTED:          ['LIVE', 'PENDING'],
  REUPLOAD_REQUIRED: ['PENDING'],
  SCHEDULED:         ['LIVE', 'TAKEN_DOWN'],
};

const STATUS_LABELS: Record<SongStatus, string> = {
  LIVE:              '✓ Set LIVE',
  TAKEN_DOWN:        '↓ Take Down',
  REJECTED:          '✕ Reject',
  REUPLOAD_REQUIRED: '↩ Request Reupload',
  PENDING:           '↺ Return to Pending',
  APPROVED:          '→ Approve',
  SCHEDULED:         '⏰ Schedule',
};

const STATUS_STYLES: Record<SongStatus, { bg: string; color: string; border: string }> = {
  LIVE:              { bg: 'var(--success-light)', color: 'var(--success)', border: '#6EE7B7' },
  TAKEN_DOWN:        { bg: 'var(--danger-light)',  color: 'var(--danger)',  border: '#FCA5A5' },
  REJECTED:          { bg: 'var(--danger-light)',  color: 'var(--danger)',  border: '#FCA5A5' },
  REUPLOAD_REQUIRED: { bg: 'var(--warning-light)', color: 'var(--warning)', border: '#FDE68A' },
  PENDING:           { bg: 'var(--bg-subtle)',      color: 'var(--text-muted)', border: 'var(--border)' },
  APPROVED:          { bg: 'var(--success-light)', color: 'var(--success)', border: '#6EE7B7' },
  SCHEDULED:         { bg: 'var(--accent-light)',  color: 'var(--accent)',  border: '#A5B4FC' },
};

// ── Audio player ──────────────────────────────────────────────────────────────

function AudioPreview({ url }: { url: string | null }) {
  const [playing, setPlaying] = useState(false);

  if (!url) {
    return (
      <div style={{
        padding: '12px 16px', borderRadius: 'var(--radius)',
        background: 'var(--bg-subtle)', border: '1px solid var(--border)',
        fontSize: 13, color: 'var(--text-faint)', textAlign: 'center',
      }}>
        Audio preview unavailable
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 'var(--radius)',
      background: 'var(--bg-subtle)', border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <button
        onClick={() => {
          const el = document.getElementById('song-preview') as HTMLAudioElement | null;
          if (!el) return;
          if (playing) { el.pause(); setPlaying(false); }
          else { void el.play(); setPlaying(true); }
        }}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--accent)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        {playing ? <Pause size={16} color="white" /> : <Play size={16} color="white" />}
      </button>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Admin preview</span>
      <audio
        id="song-preview"
        src={url}
        onEnded={() => setPlaying(false)}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [statusDialog, setStatusDialog] = useState<{ target: SongStatus } | null>(null);
  const [reason, setReason] = useState('');

  const { data: song, isLoading, error } = useQuery({
    queryKey: ['admin', 'song', id],
    queryFn: () => adminApi.getSongDetail(id).then((r) => r.data),
  });

  const statusMut = useMutation({
    mutationFn: ({ status, reason }: { status: SongStatus; reason?: string }) =>
      adminApi.updateSongStatus(id, status, reason),
    onSuccess: () => {
      toast('Status updated.', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'song', id] });
      qc.invalidateQueries({ queryKey: ['songs'] });
      setStatusDialog(null);
      setReason('');
    },
    onError: () => toast('Failed to update status.', 'error'),
  });

  const needsReason = (target: SongStatus) =>
    target === 'REJECTED' || target === 'REUPLOAD_REQUIRED';

  function handleStatusClick(target: SongStatus) {
    if (needsReason(target)) {
      setStatusDialog({ target });
      setReason('');
    } else {
      statusMut.mutate({ status: target });
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 60 }}>
        <p style={{ color: 'var(--danger)', fontSize: 14 }}>Song not found.</p>
        <button onClick={() => router.push('/songs')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          ← Back to Songs
        </button>
      </div>
    );
  }

  const transitions = VALID_TRANSITIONS[song.status] ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Back + title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, flex: 1 }}>
          {song.title}
        </h1>
        <StatusBadge status={song.status} />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left column: cover, audio, metadata ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Cover + basic info */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', gap: 20, padding: 20 }}>
              {song.coverArtUrl ? (
                <img
                  src={song.coverArtUrl}
                  alt=""
                  style={{ width: 120, height: 120, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 120, height: 120, borderRadius: 8, flexShrink: 0,
                  background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Music2 size={40} color="var(--text-faint)" />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <MetaBlock label="Artist">
                  <MetaValue value={song.artistName} />
                </MetaBlock>
                <MetaBlock label="Uploader">
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                    {song.uploaderName ?? song.uploaderEmail ?? '—'}
                  </p>
                </MetaBlock>
                <MetaBlock label="Uploaded">
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                    {format(new Date(song.createdAt), 'MMM d, yyyy HH:mm')}
                  </p>
                </MetaBlock>
              </div>
            </div>

            {/* Audio preview */}
            <div style={{ padding: '0 20px 20px' }}>
              <AudioPreview url={song.audioUrl} />
            </div>
          </div>

          {/* Metadata grid */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 20,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Metadata</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              <MetaBlock label="Duration">
                <MetaValue value={formatDuration(song.duration)} />
              </MetaBlock>
              <MetaBlock label="BPM">
                <MetaValue value={song.bpm} />
              </MetaBlock>
              <MetaBlock label="Key">
                <MetaValue value={song.camelotKey} />
              </MetaBlock>
              <MetaBlock label="Total Plays">
                <MetaValue value={song.totalPlays.toLocaleString()} />
              </MetaBlock>
              {song.dropAt && (
                <MetaBlock label="Drop Date">
                  <MetaValue value={format(new Date(song.dropAt), 'MMM d, yyyy HH:mm')} />
                </MetaBlock>
              )}
              {song.rejectionReason && (
                <MetaBlock label="Rejection Reason">
                  <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{song.rejectionReason}</p>
                </MetaBlock>
              )}
              {song.reuploadReason && (
                <MetaBlock label="Reupload Notes">
                  <p style={{ fontSize: 13, color: 'var(--warning)', margin: 0 }}>{song.reuploadReason}</p>
                </MetaBlock>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column: status actions + history ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Status actions */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 20,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Status Actions</p>
            {transitions.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No actions available for this status.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transitions.map((target) => {
                  const s = STATUS_STYLES[target];
                  return (
                    <button
                      key={target}
                      onClick={() => handleStatusClick(target)}
                      disabled={statusMut.isPending}
                      style={{
                        padding: '9px 14px', borderRadius: 'var(--radius)',
                        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                        fontSize: 13, fontWeight: 600, cursor: statusMut.isPending ? 'not-allowed' : 'pointer',
                        opacity: statusMut.isPending ? 0.6 : 1, textAlign: 'left',
                      }}
                    >
                      {STATUS_LABELS[target]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status history */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 20,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
              Status History
            </p>
            {song.statusHistory.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No history yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {song.statusHistory.map((entry, i) => (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      paddingBottom: i < song.statusHistory.length - 1 ? 14 : 0,
                      borderLeft: i < song.statusHistory.length - 1 ? '2px solid var(--border)' : '2px solid transparent',
                      marginLeft: 7, paddingLeft: 14, position: 'relative',
                    }}
                  >
                    <div style={{
                      position: 'absolute', left: -8, top: 4,
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'var(--surface)', border: '2px solid var(--border)',
                    }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0, fontFamily: 'monospace' }}>
                        {entry.action}
                      </p>
                      {entry.notes && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                          {entry.notes}
                        </p>
                      )}
                      <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '2px 0 0' }}>
                        {entry.adminEmail ?? 'System'} · {format(new Date(entry.createdAt), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status update dialog (for reject / reupload-required) */}
      <Dialog open={!!statusDialog} onOpenChange={(o) => !o && setStatusDialog(null)}>
        <DialogContent
          title={statusDialog?.target === 'REJECTED' ? 'Reject Song' : 'Request Reupload'}
          description={
            statusDialog?.target === 'REJECTED'
              ? 'Provide a reason (shown to artist).'
              : 'Describe what needs to be fixed (shown to artist).'
          }
        >
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              statusDialog?.target === 'REJECTED'
                ? 'Rejection reason (required)…'
                : 'Reupload notes (required)…'
            }
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13,
              background: 'var(--bg-subtle)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
          <DialogFooter>
            <button
              onClick={() => setStatusDialog(null)}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => statusDialog && statusMut.mutate({ status: statusDialog.target, reason })}
              disabled={!reason.trim() || statusMut.isPending}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius)',
                background: statusDialog?.target === 'REJECTED' ? 'var(--danger)' : 'var(--warning)',
                border: 'none', color: 'white', fontSize: 13, fontWeight: 600,
                cursor: !reason.trim() || statusMut.isPending ? 'not-allowed' : 'pointer',
                opacity: !reason.trim() || statusMut.isPending ? 0.6 : 1,
              }}
            >
              {statusMut.isPending
                ? 'Updating…'
                : statusDialog?.target === 'REJECTED' ? 'Reject' : 'Require Reupload'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
