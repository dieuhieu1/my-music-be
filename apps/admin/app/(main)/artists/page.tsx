'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Plus, Search, Pencil, Trash2, Upload, User } from 'lucide-react';
import UploadSongModal from '@/components/artists/UploadSongModal';
import { adminApi, type OfficialArtist } from '@/lib/api/admin.api';
import apiClient from '@/lib/api/axios';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';

// ── Artist modal ──────────────────────────────────────────────────────────────

function ArtistModal({
  open,
  onClose,
  onSuccess,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: OfficialArtist;
}) {
  const { toast } = useToast();
  const [stageName, setStageName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarInputMode, setAvatarInputMode] = useState<'file' | 'url'>('file');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStageName(initial?.stageName ?? '');
      setBio(initial?.bio ?? '');
      setAvatarFile(null);
      setAvatarPreview(initial?.avatarUrl ?? null);
      setAvatarInputMode('file');
      setAvatarUrlInput('');
    }
  }, [open, initial]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5 MB', 'error'); return; }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!stageName.trim()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('stageName', stageName.trim());
      if (bio.trim()) formData.append('bio', bio.trim());
      if (avatarInputMode === 'file' && avatarFile) {
        formData.append('avatar', avatarFile);
      } else if (avatarInputMode === 'url' && avatarUrlInput.trim()) {
        formData.append('avatarUrl', avatarUrlInput.trim());
      }

      if (initial) {
        await apiClient.patch(`/admin/artists/${initial.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast('Artist updated.', 'success');
      } else {
        await apiClient.post('/admin/artists', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast('Artist created.', 'success');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err?.response?.data?.message ?? 'Failed to save artist.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent
        title={initial ? `Edit: ${initial.stageName}` : 'New Official Artist'}
        description="Official artists are content-only profiles with no user account."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Avatar upload */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                Artist Photo <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(optional)</span>
              </label>
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-raised)', padding: 3, borderRadius: 6, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setAvatarInputMode('file')}
                  style={{
                    padding: '4px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer', border: 'none',
                    background: avatarInputMode === 'file' ? 'var(--accent)' : 'transparent',
                    color: avatarInputMode === 'file' ? '#fff' : 'var(--text-muted)',
                    transition: 'all 150ms'
                  }}
                >File</button>
                <button
                  type="button"
                  onClick={() => setAvatarInputMode('url')}
                  style={{
                    padding: '4px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer', border: 'none',
                    background: avatarInputMode === 'url' ? 'var(--accent)' : 'transparent',
                    color: avatarInputMode === 'url' ? '#fff' : 'var(--text-muted)',
                    transition: 'all 150ms'
                  }}
                >URL</button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div
                onClick={() => avatarInputMode === 'file' && document.getElementById('avatar-input')?.click()}
                style={{
                  width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
                  background: 'var(--bg-subtle)', border: '2px dashed var(--border-2)',
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: avatarInputMode === 'file' ? 'pointer' : 'default', transition: 'border-color 150ms',
                }}
                onMouseEnter={(e) => { if (avatarInputMode === 'file') e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { if (avatarInputMode === 'file') e.currentTarget.style.borderColor = 'var(--border-2)'; }}
              >
                {avatarPreview
                  ? <img src={avatarPreview} onError={() => { if(avatarInputMode === 'url') setAvatarPreview(null); }} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <User size={28} color="var(--text-faint)" />
                }
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginTop: avatarInputMode === 'url' ? 0 : 8 }}>
                {avatarInputMode === 'file' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => document.getElementById('avatar-input')?.click()}
                      style={{
                        padding: '6px 12px', borderRadius: 'var(--radius-sm)', width: 'max-content',
                        border: '1px solid var(--border-2)', background: 'var(--surface)',
                        color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        transition: 'all 150ms', display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text)'; }}
                    >
                      <Upload size={13} />
                      {avatarPreview ? 'Change photo' : 'Upload photo'}
                    </button>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', padding: 0, textAlign: 'left', width: 'max-content' }}
                      >
                        Remove photo
                      </button>
                    )}
                    {avatarFile && (
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                        {avatarFile.name} · {(avatarFile.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      value={avatarUrlInput}
                      onChange={(e) => {
                        setAvatarUrlInput(e.target.value);
                        setAvatarPreview(e.target.value);
                      }}
                      disabled={loading}
                      style={{
                        width: '100%', height: 38, padding: '0 12px', fontSize: 13,
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', color: 'var(--text)', outline: 'none',
                        boxSizing: 'border-box', transition: 'border-color 150ms',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      Image will be verified before upload.
                    </span>
                  </>
                )}
              </div>
            </div>
            <input id="avatar-input" type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

          {/* Stage name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Stage Name *
            </label>
            <input
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              placeholder="Artist name…"
              maxLength={100}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text)', outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>

          {/* Bio */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Short biography…"
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text)', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '7px 14px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-muted)', fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!stageName.trim() || loading || (avatarInputMode === 'url' && !!avatarUrlInput.trim() && !avatarPreview)}
            style={{
              padding: '7px 14px', borderRadius: 'var(--radius)',
              border: 'none', background: 'var(--accent)',
              color: 'white', fontSize: 13, fontWeight: 600,
              cursor: (!stageName.trim() || loading || (avatarInputMode === 'url' && !!avatarUrlInput.trim() && !avatarPreview)) ? 'not-allowed' : 'pointer',
              opacity: (!stageName.trim() || loading || (avatarInputMode === 'url' && !!avatarUrlInput.trim() && !avatarPreview)) ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving…' : initial ? 'Update' : 'Create'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
  artist,
  onCancel,
  onConfirm,
  loading,
}: {
  artist: OfficialArtist;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent title="Delete Official Artist" description={`Delete "${artist.stageName}"? This cannot be undone. Songs linked to this artist will remain.`}>
        <DialogFooter>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 14px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '7px 14px', borderRadius: 'var(--radius)',
              border: 'none', background: 'var(--danger)',
              color: 'white', fontSize: 13, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ArtistsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const size = 20;

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OfficialArtist | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OfficialArtist | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ id: string; stageName: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'artists', page, search],
    queryFn: () => adminApi.getOfficialArtists({ page, size, search: search || undefined }),
    select: (r) => r.data,
    placeholderData: (prev) => prev,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['admin', 'artists'] });
  }

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteOfficialArtist(id),
    onSuccess: () => { toast('Artist deleted.', 'success'); invalidate(); setDeleteTarget(null); },
    onError:   () => toast('Failed to delete artist.', 'error'),
  });

  const COLS: Column<OfficialArtist>[] = [
    {
      key: 'avatar', header: '', width: 72,
      render: (a) => a.avatarUrl
        ? <img src={a.avatarUrl} alt="" style={{ width: 48, height: 48, minWidth: 48, minHeight: 48, flexShrink: 0, borderRadius: '50%', objectFit: 'cover' }} />
        : (
          <div style={{
            width: 48, height: 48, minWidth: 48, minHeight: 48, flexShrink: 0, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: 'white',
          }}>
            {a.stageName.slice(0, 1).toUpperCase()}
          </div>
        ),
    },
    {
      key: 'stageName', header: 'Name', width: 'auto',
      render: (a) => (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{a.stageName}</p>
          {a.bio && (
            <p style={{
              fontSize: 12, color: 'var(--text-muted)', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300,
            }}>
              {a.bio}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'stats', header: 'Followers', width: 100,
      render: (a) => (
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {a.followerCount.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'createdAt', header: 'Created', width: 120,
      render: (a) => (
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {format(new Date(a.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions', header: '', width: 160,
      render: (a) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setUploadTarget({ id: a.id, stageName: a.stageName });
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-light)', color: 'var(--accent)',
              border: '1px solid transparent',
              font: '12px/1 var(--font-sans)', fontWeight: 500,
              cursor: 'pointer', transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <Upload size={12} />
            Upload
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditTarget(a); }}
            title="Edit"
            style={{
              padding: '5px 8px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(a); }}
            title="Delete"
            style={{
              padding: '5px 8px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Official Artists</h1>
          {data && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {data.totalItems.toLocaleString()} artists
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
            <input
              placeholder="Search artists…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{
                paddingLeft: 32, paddingRight: 10, height: 36, width: 220, fontSize: 13,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text)', outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 'var(--radius)',
              background: 'var(--accent)', color: 'white',
              border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> New Artist
          </button>
        </div>
      </div>

      <DataTable
        columns={COLS}
        data={data?.items ?? []}
        rowKey={(a) => a.id}
        loading={isLoading}
        emptyMessage="No official artists yet"
        emptyIcon={Star}
        page={page}
        size={size}
        totalItems={data?.totalItems ?? 0}
        onPageChange={setPage}
      />

      {/* Create modal */}
      <ArtistModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => invalidate()}
      />

      {/* Edit modal */}
      {editTarget && (
        <ArtistModal
          open
          onClose={() => setEditTarget(null)}
          onSuccess={() => invalidate()}
          initial={editTarget}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirm
          artist={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          loading={deleteMut.isPending}
        />
      )}

      {/* Upload song modal */}
      <UploadSongModal
        open={!!uploadTarget}
        onOpenChange={(open) => { if (!open) setUploadTarget(null); }}
        artist={uploadTarget ?? { id: '', stageName: '' }}
        onSuccess={() => {
          setUploadTarget(null);
          qc.invalidateQueries({ queryKey: ['admin', 'songs'] });
        }}
      />
    </div>
  );
}
