'use client';

import { Music2, Trash2, AlertTriangle, CheckCircle2, Crown } from 'lucide-react';

export interface DownloadRecord {
  songId: string;
  title: string;
  artistName: string;
  coverArtUrl: string | null;
  downloadedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

interface DownloadRowProps {
  record: DownloadRecord;
  index: number;
  locale: string;
  onRemove: (songId: string) => void;
  removing: boolean;
}

type RowStatus = 'active' | 'expiring' | 'revoked';

function getStatus(record: DownloadRecord): RowStatus {
  if (record.revokedAt) return 'revoked';
  const daysLeft = (new Date(record.expiresAt).getTime() - Date.now()) / 86_400_000;
  if (daysLeft <= 7) return 'expiring';
  return 'active';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const STATUS_CONFIG = {
  active:   { label: 'Active',        color: 'var(--gold)',                Icon: CheckCircle2 },
  expiring: { label: 'Expiring soon', color: 'var(--gold-dim)',             Icon: AlertTriangle },
  revoked:  { label: 'Revoked',       color: 'hsl(var(--destructive))',     Icon: AlertTriangle },
};

export function DownloadRow({ record, index, locale, onRemove, removing }: DownloadRowProps) {
  const rowStatus = getStatus(record);
  const { label, color, Icon } = STATUS_CONFIG[rowStatus];
  const isRevoked = rowStatus === 'revoked';

  return (
    <div
      className={`anim-fade-up anim-fade-up-${Math.min(index + 1, 8)}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 16px', borderRadius: 8,
        background: 'var(--surface)',
        border: `1px solid ${isRevoked ? 'rgba(220,50,50,0.12)' : 'rgba(232,184,75,0.07)'}`,
        opacity: isRevoked ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      {/* Cover */}
      <div style={{
        width: 44, height: 44, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
        background: 'rgba(232,184,75,0.04)',
        border: '1px solid rgba(232,184,75,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {record.coverArtUrl
          ? <img src={record.coverArtUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Music2 size={16} color="rgba(232,184,75,0.3)" />
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
          color: 'var(--ivory)', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {record.title}
        </p>
        <p style={{
          color: 'var(--muted-text)', fontSize: 12, fontFamily: 'var(--font-body)',
          margin: '2px 0 0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {record.artistName}
          {!isRevoked && (
            <span style={{ marginLeft: 8 }}>
              · expires {fmtDate(record.expiresAt)}
            </span>
          )}
        </p>
      </div>

      {/* Status badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
        padding: '3px 9px', borderRadius: 20,
        background: `${color}14`,
        border: `1px solid ${color}30`,
      }}>
        <Icon size={11} color={color} />
        <span style={{ fontSize: 11, color, fontFamily: 'var(--font-body)', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>

      {/* Action */}
      {isRevoked ? (
        <a
          href={`/${locale}/payment`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '6px 12px', borderRadius: 6,
            border: '1px solid rgba(232,184,75,0.2)',
            color: 'var(--gold)', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500,
            textDecoration: 'none', transition: 'border-color 0.15s ease', minHeight: 32,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.2)'; }}
        >
          <Crown size={11} /> Renew
        </a>
      ) : (
        <button
          onClick={() => !removing && onRemove(record.songId)}
          disabled={removing}
          style={{
            background: 'none', border: 'none', cursor: removing ? 'not-allowed' : 'pointer',
            color: 'var(--muted-text)', padding: 8, borderRadius: 6, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s ease, transform 0.15s ease',
            opacity: removing ? 0.5 : 1, outline: 'none', minWidth: 32, minHeight: 32,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'hsl(var(--destructive))';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--muted-text)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
          title="Remove download"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
