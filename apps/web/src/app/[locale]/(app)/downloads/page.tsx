'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Crown, Music2 } from 'lucide-react';
import { downloadsApi } from '@/lib/api/downloads.api';
import { useAuthStore } from '@/store/useAuthStore';
import { DownloadRow, type DownloadRecord } from '@/components/downloads/DownloadRow';
import { Role } from '@mymusic/types';

function QuotaHeader({ used, quota }: { used: number; quota: number }) {
  const pct = Math.min((used / quota) * 100, 100);
  const nearLimit = pct >= 90;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 22, color: nearLimit ? 'hsl(var(--destructive))' : 'var(--ivory)',
      }}>
        {used}
      </span>
      <span style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
        / {quota} downloads used
      </span>
      <div style={{
        padding: '3px 10px', borderRadius: 20,
        background: nearLimit ? 'rgba(220,50,50,0.08)' : 'rgba(232,184,75,0.08)',
        border: `1px solid ${nearLimit ? 'rgba(220,50,50,0.25)' : 'rgba(232,184,75,0.2)'}`,
        fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600,
        color: nearLimit ? 'hsl(var(--destructive))' : 'var(--gold)',
      }}>
        {Math.round(pct)}% full
      </div>
    </div>
  );
}

export default function DownloadsPage() {
  const { locale }                        = useParams<{ locale: string }>();
  const router                            = useRouter();
  const { isPremium, hasRole }            = useAuthStore();
  const [records, setRecords]             = useState<DownloadRecord[]>([]);
  const [quotaUsed, setQuotaUsed]         = useState(0);
  const [quota, setQuota]                 = useState(100);
  const [loading, setLoading]             = useState(true);
  const [removing, setRemoving]           = useState<string | null>(null);
  const revalidated                       = useRef(false);

  const premium = isPremium();

  useEffect(() => {
    if (!premium) { router.push(`/${locale}/payment`); return; }

    downloadsApi.getDownloads()
      .then((res) => {
        const d = res.data?.data ?? res.data;
        const items: DownloadRecord[] = d.items ?? [];
        setRecords(items);
        setQuotaUsed(d.downloadCount ?? items.length);
        setQuota(d.downloadQuota ?? (hasRole(Role.ARTIST) ? 200 : 100));

        // Silent revalidation on first load
        if (!revalidated.current && items.length > 0) {
          revalidated.current = true;
          const activeSongIds = items
            .filter((r) => !r.revokedAt)
            .map((r) => r.songId);
          if (activeSongIds.length > 0) {
            downloadsApi.revalidate(activeSongIds)
              .then((rv) => {
                const updated = rv.data?.data ?? rv.data;
                if (updated?.items) setRecords(updated.items);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [premium, locale, router, hasRole]);

  const handleRemove = async (songId: string) => {
    setRemoving(songId);
    try {
      const res = await downloadsApi.removeDownload(songId);
      const d   = res.data?.data ?? res.data;
      setRecords((prev) => prev.filter((r) => r.songId !== songId));
      if (d?.downloadCount !== undefined) setQuotaUsed(d.downloadCount);
      else setQuotaUsed((prev) => Math.max(0, prev - 1));
    } catch {
      // leave list unchanged on error
    } finally {
      setRemoving(null);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 24px' }}>
        <div
          className="vinyl-spin"
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, var(--surface-2), var(--charcoal))',
            border: '2px solid var(--gold-dim)', boxShadow: '0 0 24px var(--gold-glow)',
          }}
        />
        <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
          Loading downloads…
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 100px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="anim-fade-up" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <Download size={22} color="var(--gold)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ivory)', margin: 0 }}>
            Downloads
          </h1>
        </div>
        {records.length > 0 && <QuotaHeader used={quotaUsed} quota={quota} />}
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {records.length === 0 && (
        <div className="anim-fade-up anim-fade-up-1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0', textAlign: 'center' }}>
          <Crown size={40} color="rgba(232,184,75,0.25)" />
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ivory)', margin: '0 0 8px' }}>
              No downloads yet
            </p>
            <p style={{ color: 'var(--muted-text)', fontFamily: 'var(--font-body)', fontSize: 14, margin: 0 }}>
              Browse songs and use the "…" menu to download for offline listening.
            </p>
          </div>
          <button
            onClick={() => router.push(`/${locale}/browse`)}
            style={{
              marginTop: 4, padding: '11px 24px', borderRadius: 8,
              border: '1.5px solid rgba(232,184,75,0.2)',
              background: 'transparent', color: 'var(--gold)',
              fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', minHeight: 44,
              transition: 'border-color 0.2s ease',
              outline: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(232,184,75,0.2)'; }}
            onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--gold)'; e.currentTarget.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
          >
            Browse Music
          </button>
        </div>
      )}

      {/* ── Download list ─────────────────────────────────────────────────── */}
      {records.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {records.map((record, i) => (
            <DownloadRow
              key={record.songId}
              record={record}
              index={i}
              locale={locale}
              onRemove={handleRemove}
              removing={removing === record.songId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
