'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Tag, Plus } from 'lucide-react';
import { adminApi } from '@/lib/api/admin.api';
import type { GenreSuggestion } from '@/lib/api/admin.api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { BADGE_QUERY_KEYS } from '@/components/ui/NotificationBell';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

export default function GenresPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showAddForm, setShowAddForm]     = useState(false);
  const [newGenreName, setNewGenreName]   = useState('');
  const [newGenreDesc, setNewGenreDesc]   = useState('');

  const [suggStatus, setSuggStatus] = useState('PENDING');
  const [suggPage, setSuggPage]     = useState(1);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const { data: genres, isLoading: loadingGenres } = useQuery({
    queryKey: ['genres'],
    queryFn: () => adminApi.getGenres(),
    select: (r) => r.data,
  });

  const { data: suggestions, isLoading: loadingSugg } = useQuery({
    queryKey: BADGE_QUERY_KEYS.genreSuggestions,
    queryFn: () => adminApi.getGenreSuggestions(),
    select: (r) => r.data,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: BADGE_QUERY_KEYS.genreSuggestions });

  const addGenre = useMutation({
    mutationFn: (dto: { name: string; description?: string }) => adminApi.createGenre(dto),
    onSuccess: () => {
      toast('Genre created', 'success');
      qc.invalidateQueries({ queryKey: ['genres'] });
      setShowAddForm(false);
      setNewGenreName('');
      setNewGenreDesc('');
    },
    onError: () => toast('Failed to create genre', 'error'),
  });

  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveGenreSuggestion(id),
    onSuccess: () => { toast('Genre suggestion approved', 'success'); invalidate(); },
    onError: () => toast('Failed to approve', 'error'),
  });

  const reject = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      adminApi.rejectGenreSuggestion(id, notes),
    onSuccess: () => {
      toast('Genre suggestion rejected');
      invalidate();
      setRejectingId(null);
      setRejectNotes('');
    },
    onError: () => toast('Failed to reject', 'error'),
  });

  const pendingCount = suggestions?.filter((s) => s.status === 'PENDING').length ?? 0;
  const filtered     = (suggestions ?? []).filter((s) => !suggStatus || s.status === suggStatus);
  const sliced       = filtered.slice((suggPage - 1) * PAGE_SIZE, suggPage * PAGE_SIZE);

  const SUGG_TABS = [
    { key: '', label: 'All' },
    { key: 'PENDING',  label: 'Pending',  count: pendingCount },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
  ];

  const COLS: Column<GenreSuggestion>[] = [
    {
      key: 'name', header: 'Genre Name',
      render: (s) => (
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{s.name}</span>
      ),
    },
    {
      key: 'userId', header: 'Suggested By', width: 160,
      render: (s) => (
        <span style={{
          fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)',
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: 144,
        }}>
          {s.userId}
        </span>
      ),
    },
    {
      key: 'songId', header: 'Song', width: 160,
      render: (s) => s.songId ? (
        <span style={{
          fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)',
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: 144,
        }}>
          {s.songId}
        </span>
      ) : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>,
    },
    {
      key: 'createdAt', header: 'Date', width: 120,
      render: (s) => (
        <span style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
          {format(new Date(s.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 120,
      render: (s) => <StatusBadge status={s.status} />,
    },
    {
      key: 'actions', header: 'Actions', width: 210,
      render: (s) => {
        if (s.status !== 'PENDING') return null;

        if (rejectingId === s.id) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <textarea
                rows={2}
                placeholder="Rejection notes (optional)…"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                autoFocus
                style={{
                  width: '100%', padding: '4px 8px', fontSize: 11,
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-2)',
                  background: 'var(--bg)', color: 'var(--text)',
                  resize: 'none', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => reject.mutate({ id: s.id, notes: rejectNotes || undefined })}
                  disabled={reject.isPending}
                  style={{
                    flex: 1, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                    fontSize: 11, fontWeight: 600, background: 'var(--danger)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    opacity: reject.isPending ? 0.6 : 1,
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => { setRejectingId(null); setRejectNotes(''); }}
                  style={{
                    padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                    background: 'var(--bg-subtle)', color: 'var(--text-muted)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); approve.mutate(s.id); }}
              disabled={approve.isPending}
              style={{
                padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                fontWeight: 500, background: 'var(--success-light)', color: 'var(--success)',
                border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer',
                opacity: approve.isPending ? 0.6 : 1,
              }}
            >
              ✓ Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRejectingId(s.id);
                setRejectNotes('');
              }}
              style={{
                padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                fontWeight: 500, background: 'var(--danger-light)', color: 'var(--danger)',
                border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer',
              }}
            >
              ✕ Reject
            </button>
          </div>
        );
      },
    },
  ];

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Genres</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Manage music genres</p>
      </div>

      {/* ── Section 1: Confirmed Genres ─────────────────────────────────────── */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Confirmed Genres
            </h2>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-light)', color: 'var(--accent)',
            }}>
              {genres?.length ?? 0}
            </span>
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 'var(--radius)',
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'opacity 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <Plus size={13} /> Add Genre
          </button>
        </div>

        {/* Inline add form */}
        {showAddForm && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: '12px 16px', marginBottom: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                placeholder="Genre name…"
                value={newGenreName}
                onChange={(e) => setNewGenreName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGenreName.trim()) {
                    addGenre.mutate({ name: newGenreName, description: newGenreDesc || undefined });
                  }
                  if (e.key === 'Escape') { setShowAddForm(false); setNewGenreName(''); setNewGenreDesc(''); }
                }}
                autoFocus
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-2)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: 13, outline: 'none',
                }}
              />
              <input
                placeholder="Description (optional)…"
                value={newGenreDesc}
                onChange={(e) => setNewGenreDesc(e.target.value)}
                style={{
                  flex: 2, padding: '8px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-2)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: 13, outline: 'none',
                }}
              />
              <button
                disabled={!newGenreName.trim() || addGenre.isPending}
                onClick={() => addGenre.mutate({ name: newGenreName, description: newGenreDesc || undefined })}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius)',
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  fontSize: 12, fontWeight: 500,
                  cursor: newGenreName.trim() && !addGenre.isPending ? 'pointer' : 'not-allowed',
                  opacity: newGenreName.trim() && !addGenre.isPending ? 1 : 0.45,
                }}
              >
                {addGenre.isPending ? 'Adding…' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewGenreName(''); setNewGenreDesc(''); }}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius)',
                  background: 'transparent', color: 'var(--text-muted)',
                  border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Genre chips grid */}
        {loadingGenres ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 36, borderRadius: 'var(--radius-full)' }} />
            ))}
          </div>
        ) : !genres?.length ? (
          <div style={{
            padding: 40, textAlign: 'center', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          }}>
            <Tag size={32} color="var(--text-faint)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No genres yet</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {genres.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px', borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-light)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  overflow: 'hidden',
                }}
              >
                <span style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--accent)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {g.name}
                </span>
                <span style={{
                  fontSize: 11, color: 'var(--text-faint)',
                  flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  {g.songCount ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Genre Suggestions ────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Genre Suggestions
          </h2>
          {pendingCount > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--warning-light)', color: 'var(--warning)',
            }}>
              {pendingCount} pending
            </span>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <StatusTabs
            tabs={SUGG_TABS}
            active={suggStatus}
            onChange={(k) => { setSuggStatus(k); setSuggPage(1); }}
          />
        </div>

        <DataTable
          columns={COLS}
          data={sliced}
          loading={loadingSugg}
          rowKey={(s) => s.id}
          page={suggPage}
          size={PAGE_SIZE}
          totalItems={filtered.length}
          onPageChange={setSuggPage}
          emptyIcon={CheckCircle2}
          emptyMessage={suggStatus === 'PENDING' ? 'No pending suggestions' : 'No suggestions found'}
        />
      </div>

    </div>
  );
}
