'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Music2, Search, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { adminApi, type AdminSong, type SongStatus } from '@/lib/api/admin.api';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { BADGE_QUERY_KEYS } from '@/components/ui/NotificationBell';

// ── Types for extra fields not yet in AdminSong type ─────────────────────
type SongWithExtras = AdminSong & {
  bpm?: number | null;
  duration?: number | null;
  genres?: string[];
  camelotKey?: string | null;
  notes?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const STATUS_TABS = [
  { key: '',                  label: 'All' },
  { key: 'PENDING',           label: 'Pending' },
  { key: 'LIVE',              label: 'Live' },
  { key: 'SCHEDULED',         label: 'Scheduled' },
  { key: 'APPROVED',          label: 'Approved' },
  { key: 'REJECTED',          label: 'Rejected' },
  { key: 'REUPLOAD_REQUIRED', label: 'Reupload Required' },
  { key: 'TAKEN_DOWN',        label: 'Taken Down' },
];

// ── Row expanded detail ───────────────────────────────────────────────────

function ExpandedRow({ song }: { song: AdminSong }) {
  const s = song as SongWithExtras;
  return (
    <div style={{
      padding: '16px 24px', background: 'var(--bg-subtle)',
      display: 'flex', gap: 24, alignItems: 'flex-start',
    }}>
      {s.coverArtUrl && (
        <img
          src={s.coverArtUrl}
          alt=""
          style={{ width: 100, height: 100, borderRadius: 'var(--radius)', objectFit: 'cover', flexShrink: 0 }}
        />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <InfoBlock label="Genres">
          {s.genres?.length
            ? s.genres.map((g) => (
              <span key={g} style={{ display: 'inline-block', padding: '2px 10px', marginRight: 4, marginBottom: 4, borderRadius: 'var(--radius-full)', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 12 }}>{g}</span>
            ))
            : <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>—</span>
          }
        </InfoBlock>
        <InfoBlock label="Camelot Key">
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.camelotKey ?? '—'}</span>
        </InfoBlock>
        <InfoBlock label="Total Plays">
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{song.totalPlays}</span>
        </InfoBlock>
        {s.notes && (
          <InfoBlock label="Notes">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.notes}</span>
          </InfoBlock>
        )}
        {song.dropAt && (
          <InfoBlock label="Scheduled For">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <span suppressHydrationWarning>
                {format(new Date(song.dropAt), 'MMM d, yyyy HH:mm')}
              </span>
            </span>
          </InfoBlock>
        )}
      </div>
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

// ── Row actions ───────────────────────────────────────────────────────────

function ActionBtn({
  label, bg, color, border, onClick,
}: {
  label: string;
  bg: string;
  color: string;
  border: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      style={{
        height: 28, padding: '0 10px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 12, fontWeight: 500,
        background: bg, color, border: `1px solid ${border}`,
        cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
    >
      {label}
    </button>
  );
}

function RowActions({ song, onAction }: {
  song: AdminSong;
  onAction: (type: string, song: AdminSong) => void;
}) {
  const s = song.status;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {(s === 'PENDING' || s === 'APPROVED') && (
        <>
          <ActionBtn label="✓ Approve"  bg="var(--success-light)" color="var(--success)" border="#6EE7B7" onClick={() => onAction('approve', song)} />
          <ActionBtn label="✕ Reject"   bg="var(--danger-light)"  color="var(--danger)"  border="#FCA5A5" onClick={() => onAction('reject', song)} />
        </>
      )}
      {s === 'LIVE' && (
        <ActionBtn label="⊘ Take Down" bg="var(--danger-light)" color="var(--danger)" border="#FCA5A5" onClick={() => onAction('takedown', song)} />
      )}
      {(s === 'TAKEN_DOWN' || s === 'REJECTED' || s === 'REUPLOAD_REQUIRED') && (
        <ActionBtn label="↑ Restore" bg="var(--accent-light)" color="var(--accent)" border="#A5B4FC" onClick={() => onAction('restore', song)} />
      )}
      {s === 'SCHEDULED' && (
        <ActionBtn label="✓ Release Now" bg="var(--success-light)" color="var(--success)" border="#6EE7B7" onClick={() => onAction('approve', song)} />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function SongsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');
  const [page, setPage] = useState(1);
  const size = 20;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialog, setDialog] = useState<{
    type: string;
    song?: AdminSong;
    notes: string;
  } | null>(null);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Pending count for tab badge
  const { data: pendingCount } = useQuery({
    queryKey: ['songs-page', 'pending-count'],
    queryFn: () => adminApi.getSongs({ status: 'PENDING', page: 1, size: 1 }),
    select: (r) => r.data.totalItems,
    staleTime: 0,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['songs', statusFilter, search, page, size],
    queryFn: () => adminApi.getSongs({
      status: statusFilter || undefined,
      search: search || undefined,
      page, size,
    }),
    select: (r) => r.data,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['songs'] });
    qc.invalidateQueries({ queryKey: BADGE_QUERY_KEYS.pendingSongs });
  }, [qc]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: SongStatus; notes?: string }) =>
      adminApi.updateSongStatus(id, status, notes),
    onSuccess: invalidate,
  });
  const reupload = useMutation({ mutationFn: ({ id, notes }: { id: string; notes: string }) => adminApi.requireReupload(id, notes), onSuccess: invalidate });

  function handleAction(type: string, song: AdminSong) {
    if (type === 'approve') {
      statusMutation.mutateAsync({ id: song.id, status: 'LIVE' })
        .then(() => toast('Song approved'))
        .catch(() => toast('Action failed', 'error'));
    } else if (type === 'restore') {
      statusMutation.mutateAsync({ id: song.id, status: 'LIVE' })
        .then(() => toast('Song restored'))
        .catch(() => toast('Action failed', 'error'));
    } else if (type === 'takedown') {
      statusMutation.mutateAsync({ id: song.id, status: 'TAKEN_DOWN' })
        .then(() => toast('Song taken down'))
        .catch(() => toast('Action failed', 'error'));
    } else {
      setDialog({ type, song, notes: '' });
    }
  }

  async function confirmDialog() {
    if (!dialog) return;
    try {
      if ((dialog.type === 'reject' || dialog.type === 'bulk-reject') && dialog.notes.length < 10) return;

      if (dialog.type === 'reject' && dialog.song) {
        await statusMutation.mutateAsync({ id: dialog.song.id, status: 'REJECTED', notes: dialog.notes });
        toast('Song rejected');
      } else if (dialog.type === 'reupload' && dialog.song) {
        await reupload.mutateAsync({ id: dialog.song.id, notes: dialog.notes });
        toast('Reupload requested');
      } else if (dialog.type === 'bulk-approve') {
        await Promise.all(selectedIds.map((id) => statusMutation.mutateAsync({ id, status: 'LIVE' })));
        toast(`${selectedIds.length} song${selectedIds.length !== 1 ? 's' : ''} approved`);
        setSelectedIds([]);
      } else if (dialog.type === 'bulk-reject') {
        await Promise.all(selectedIds.map((id) => statusMutation.mutateAsync({ id, status: 'REJECTED', notes: dialog.notes })));
        toast(`${selectedIds.length} song${selectedIds.length !== 1 ? 's' : ''} rejected`);
        setSelectedIds([]);
      } else if (dialog.type === 'bulk-reupload') {
        await Promise.all(selectedIds.map((id) => reupload.mutateAsync({ id, notes: dialog.notes })));
        toast(`Reupload requested for ${selectedIds.length} song${selectedIds.length !== 1 ? 's' : ''}`);
        setSelectedIds([]);
      } else if (dialog.type === 'bulk-takedown') {
        await Promise.all(selectedIds.map((id) => statusMutation.mutateAsync({ id, status: 'TAKEN_DOWN' })));
        toast(`${selectedIds.length} song${selectedIds.length !== 1 ? 's' : ''} taken down`);
        setSelectedIds([]);
      } else if (dialog.type === 'bulk-restore') {
        await Promise.all(selectedIds.map((id) => statusMutation.mutateAsync({ id, status: 'LIVE' })));
        toast(`${selectedIds.length} song${selectedIds.length !== 1 ? 's' : ''} restored`);
        setSelectedIds([]);
      }
    } catch {
      toast('Action failed', 'error');
    }
    setDialog(null);
  }

  function handleRowClick(song: AdminSong) {
    router.push(`/songs/${song.id}`);
  }

  const COLS: Column<AdminSong>[] = [
    {
      key: 'cover', header: 'Cover', width: 72,
      render: (s) => s.coverArtUrl
        ? <img src={s.coverArtUrl} alt="" style={{ width: 48, height: 48, minWidth: 48, minHeight: 48, flexShrink: 0, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
        : <div style={{ width: 48, height: 48, minWidth: 48, minHeight: 48, flexShrink: 0, borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music2 size={20} color="var(--text-faint)" /></div>,
    },
    {
      key: 'title', header: 'Title', width: 'auto',
      render: (s) => (
        <div>
          <Link
            href={`/songs/${s.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)'; }}
          >
            {s.title}
          </Link>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{s.artistName ?? '—'}</p>
        </div>
      ),
    },
    { key: 'status',   header: 'Status',   width: 120, render: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'bpm',      header: 'BPM',      width: 80,
      render: (s) => {
        const bpm = (s as SongWithExtras).bpm;
        return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{bpm != null ? bpm : '—'}</span>;
      },
    },
    {
      key: 'duration', header: 'Duration', width: 90,
      render: (s) => {
        const dur = (s as SongWithExtras).duration;
        return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{dur != null ? formatDuration(dur) : '—'}</span>;
      },
    },
    {
      key: 'createdAt', header: 'Uploaded', width: 120,
      render: (s) => <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{format(new Date(s.createdAt), 'MMM d, yyyy')}</span>,
    },
    {
      key: 'actions',  header: 'Actions',  width: 160,
      render: (s) => <RowActions song={s} onAction={handleAction} />,
    },
  ];

  const tabs = STATUS_TABS.map((t) => {
    if (t.key === 'PENDING')
      return { ...t, count: pendingCount }
    if (t.key === '')
      return { ...t, count: data?.totalItems }
    return t
  })

  const needsNotes = dialog?.type === 'reject' || dialog?.type === 'bulk-reject' || dialog?.type === 'reupload' || dialog?.type === 'bulk-reupload';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Songs</h1>
          {data && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {data.totalItems.toLocaleString()} total
            </p>
          )}
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }}
          />
          <input
            placeholder="Search songs…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              paddingLeft: 34, paddingRight: 12, height: 38, width: 280, fontSize: 13,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text)', outline: 'none',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          />
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ overflowX: 'auto' }}>
        <StatusTabs
          tabs={tabs}
          active={statusFilter}
          onChange={(key) => { setStatusFilter(key); setPage(1); setSelectedIds([]); }}
        />
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div
          className="animate-slide-down"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px',
            background: 'var(--accent-light)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 'var(--radius)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)', flex: 1 }}>
            {selectedIds.length} song{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          {(statusFilter === '' || statusFilter === 'PENDING' || statusFilter === 'APPROVED' || statusFilter === 'REJECTED' || statusFilter === 'REUPLOAD_REQUIRED') && (
            <>
              <BulkBtn label="✓ Approve all" bg="var(--success)" onClick={() => setDialog({ type: 'bulk-approve',  notes: '' })} />
              <BulkBtn label="✕ Reject all"  bg="var(--danger)"  onClick={() => setDialog({ type: 'bulk-reject',   notes: '' })} />
            </>
          )}
          {(statusFilter === '' || statusFilter === 'PENDING' || statusFilter === 'APPROVED') && (
            <BulkBtn label="↩ Reupload" bg="var(--warning)" onClick={() => setDialog({ type: 'bulk-reupload', notes: '' })} />
          )}
          {(statusFilter === 'LIVE' || statusFilter === 'SCHEDULED') && (
            <BulkBtn label="⊘ Take Down all" bg="var(--danger)"  onClick={() => setDialog({ type: 'bulk-takedown', notes: '' })} />
          )}
          {statusFilter === 'TAKEN_DOWN' && (
            <BulkBtn label="↑ Restore all" bg="var(--accent)" onClick={() => setDialog({ type: 'bulk-restore', notes: '' })} />
          )}
          <BulkBtn
            label="✕ Clear"
            bg="var(--surface)"
            color="var(--text-muted)"
            border="var(--border)"
            onClick={() => setSelectedIds([])}
          />
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={COLS}
        data={data?.items ?? []}
        rowKey={(s) => s.id}
        loading={isLoading}
        emptyMessage="No songs found"
        emptyIcon={CheckCircle2}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        page={page}
        size={size}
        totalItems={data?.totalItems ?? 0}
        onPageChange={setPage}
        onRowClick={handleRowClick}
      />

      {/* Reject / Reupload / Bulk reject / Bulk reupload dialog */}
      <ConfirmDialog
        open={!!dialog && needsNotes}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        title={
          dialog?.type === 'reupload' || dialog?.type === 'bulk-reupload'
            ? 'Request Reupload'
            : dialog?.type === 'bulk-reject'
              ? `Reject ${selectedIds.length} Song${selectedIds.length !== 1 ? 's' : ''}`
              : 'Reject Song'
        }
        description={
          dialog?.type === 'reupload' || dialog?.type === 'bulk-reupload'
            ? 'Describe what needs to be fixed.'
            : 'Provide a reason (shown to artist). Minimum 10 characters.'
        }
        onConfirm={confirmDialog}
        confirmLabel={dialog?.type?.includes('reupload') ? 'Request Reupload' : 'Reject'}
        confirmVariant={dialog?.type?.includes('reupload') ? 'default' : 'destructive'}
      >
        {dialog?.song && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            <strong style={{ color: 'var(--text)' }}>{dialog.song.title}</strong>
            {dialog.song.artistName ? ` · ${dialog.song.artistName}` : ''}
          </p>
        )}
        <textarea
          placeholder={
            dialog?.type?.includes('reupload')
              ? 'Notes for the artist…'
              : 'Reason for rejection (required, min 10 chars)…'
          }
          value={dialog?.notes ?? ''}
          onChange={(e) => setDialog((d) => d ? { ...d, notes: e.target.value } : null)}
          rows={3}
          style={{
            width: '100%', padding: '8px 10px', marginTop: 4,
            background: 'var(--bg-subtle)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontSize: 13, outline: 'none', resize: 'vertical',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
        {(dialog?.type === 'reject' || dialog?.type === 'bulk-reject') && dialog.notes.length > 0 && dialog.notes.length < 10 && (
          <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
            Must be at least 10 characters ({dialog.notes.length}/10)
          </p>
        )}
      </ConfirmDialog>

      {/* Bulk approve confirm */}
      <ConfirmDialog
        open={dialog?.type === 'bulk-approve'}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        title={`Approve ${selectedIds.length} Song${selectedIds.length !== 1 ? 's' : ''}?`}
        description="These songs will be approved immediately."
        onConfirm={confirmDialog}
        confirmLabel="Approve all"
        confirmVariant="success"
      />

      {/* Bulk take-down confirm */}
      <ConfirmDialog
        open={dialog?.type === 'bulk-takedown'}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        title="Take Down Selected Songs"
        description={`Take down ${selectedIds.length} song${selectedIds.length !== 1 ? 's' : ''}? They will be removed from the platform.`}
        onConfirm={confirmDialog}
        confirmLabel="Take Down"
        confirmVariant="destructive"
      />

      {/* Bulk restore confirm */}
      <ConfirmDialog
        open={dialog?.type === 'bulk-restore'}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        title="Restore Selected Songs"
        description={`Restore ${selectedIds.length} song${selectedIds.length !== 1 ? 's' : ''} to Live?`}
        onConfirm={confirmDialog}
        confirmLabel="Restore"
        confirmVariant="success"
      />
    </div>
  );
}

// ── Bulk action button helper ──────────────────────────────────────────────

function BulkBtn({
  label, bg, color = '#fff', border, onClick,
}: {
  label: string;
  bg: string;
  color?: string;
  border?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13, fontWeight: 500,
        background: bg, color,
        border: `1px solid ${border ?? bg}`,
        cursor: 'pointer', transition: 'all 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
    >
      {label}
    </button>
  );
}
