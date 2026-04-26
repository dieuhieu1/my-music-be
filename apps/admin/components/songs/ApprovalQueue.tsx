'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { CheckCircle, XCircle, RotateCcw, RefreshCw, Music2 } from 'lucide-react';
import { adminApi, type AdminSong, type SongStatus } from '@/lib/api/admin.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow, Pagination } from '@/components/ui/table';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'LIVE', label: 'Live' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'TAKEN_DOWN', label: 'Taken Down' },
  { value: 'REUPLOAD_REQUIRED', label: 'Reupload Required' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: '', label: 'All Statuses' },
];

export function ApprovalQueue() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [status, setStatus] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [rejectTarget, setRejectTarget] = useState<AdminSong | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reuploadTarget, setReuploadTarget] = useState<AdminSong | null>(null);
  const [reuploadNotes, setReuploadNotes] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    song: AdminSong;
    action: 'approve' | 'restore';
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'songs', status, search, page],
    queryFn: async () =>
      (await adminApi.getSongs({ status: status || undefined, search: search || undefined, page, size: 20 })).data,
    placeholderData: (prev) => prev,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['admin', 'songs'] });
  }

  const approveMut = useMutation({
    mutationFn: (id: string) => adminApi.approveSong(id),
    onSuccess: () => { toast('Song approved.', 'success'); invalidate(); setConfirmAction(null); },
    onError: () => toast('Failed to approve.', 'error'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.rejectSong(id, reason),
    onSuccess: () => { toast('Song rejected.', 'success'); invalidate(); setRejectTarget(null); setRejectReason(''); },
    onError: () => toast('Failed to reject.', 'error'),
  });

  const reuploadMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      adminApi.requireReupload(id, notes),
    onSuccess: () => { toast('Reupload required set.', 'success'); invalidate(); setReuploadTarget(null); setReuploadNotes(''); },
    onError: () => toast('Failed to update.', 'error'),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => adminApi.restoreSong(id),
    onSuccess: () => { toast('Song restored.', 'success'); invalidate(); setConfirmAction(null); },
    onError: () => toast('Failed to restore.', 'error'),
  });

  function getActions(song: AdminSong) {
    switch (song.status) {
      case 'PENDING':
        return (
          <div className="flex gap-1.5">
            <Button size="sm" variant="success" onClick={() => setConfirmAction({ song, action: 'approve' })}>
              <CheckCircle size={13} /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setRejectTarget(song)}>
              <XCircle size={13} /> Reject
            </Button>
            <Button size="sm" variant="warning" onClick={() => setReuploadTarget(song)}>
              <RefreshCw size={13} /> Reupload
            </Button>
          </div>
        );
      case 'TAKEN_DOWN':
      case 'REJECTED':
        return (
          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ song, action: 'restore' })}>
            <RotateCcw size={13} /> Restore
          </Button>
        );
      case 'LIVE':
      case 'APPROVED':
        return (
          <Button size="sm" variant="warning" onClick={() => setReuploadTarget(song)}>
            <RefreshCw size={13} /> Reupload Required
          </Button>
        );
      default:
        return null;
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div style={{ minWidth: 180 }}>
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Input
            type="search"
            placeholder="Search by title or artist…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <Table>
          <Thead>
            <Tr>
              <Th>Cover</Th>
              <Th>Title</Th>
              <Th>Artist</Th>
              <Th>Status</Th>
              <Th>Uploaded</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <EmptyRow cols={6} message="Loading…" />
            ) : data?.items.length === 0 ? (
              <EmptyRow cols={6} message="No songs found." />
            ) : (
              data?.items.map((song) => (
                <Tr key={song.id}>
                  <Td>
                    {song.coverArtUrl ? (
                      <Image
                        src={song.coverArtUrl}
                        alt={song.title}
                        width={40}
                        height={40}
                        style={{ borderRadius: 4, objectFit: 'cover' }}
                        unoptimized
                      />
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 4,
                          backgroundColor: '#F3F4F6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Music2 size={16} color="#9CA3AF" />
                      </div>
                    )}
                  </Td>
                  <Td>
                    <span className="font-medium text-[#111827]">{song.title}</span>
                  </Td>
                  <Td className="text-[#6B7280]">{song.artistName}</Td>
                  <Td>
                    <Badge status={song.status}>{song.status}</Badge>
                  </Td>
                  <Td className="text-[#9CA3AF] text-xs">
                    {format(new Date(song.createdAt), 'MMM d, yyyy')}
                  </Td>
                  <Td>{getActions(song)}</Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>

      {/* Approve / Restore confirm */}
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.action === 'approve' ? 'Approve Song' : 'Restore Song'}
        description={
          confirmAction?.action === 'approve'
            ? `Approve "${confirmAction?.song.title}"? It will go LIVE.`
            : `Restore "${confirmAction?.song.title}"? It will return to LIVE.`
        }
        confirmLabel={confirmAction?.action === 'approve' ? 'Approve' : 'Restore'}
        confirmVariant={confirmAction?.action === 'approve' ? 'success' : 'default'}
        loading={approveMut.isPending || restoreMut.isPending}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.action === 'approve') approveMut.mutate(confirmAction.song.id);
          else restoreMut.mutate(confirmAction.song.id);
        }}
      />

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && (setRejectTarget(null), setRejectReason(''))}>
        <DialogContent title={`Reject: ${rejectTarget?.title}`} description="Provide a reason for the artist.">
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (required)…"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              fontSize: 13,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!rejectReason.trim() || rejectMut.isPending}
              onClick={() => rejectTarget && rejectMut.mutate({ id: rejectTarget.id, reason: rejectReason })}
            >
              {rejectMut.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reupload Required dialog */}
      <Dialog open={!!reuploadTarget} onOpenChange={(open) => !open && (setReuploadTarget(null), setReuploadNotes(''))}>
        <DialogContent title={`Reupload Required: ${reuploadTarget?.title}`} description="Provide notes for the artist.">
          <textarea
            rows={3}
            value={reuploadNotes}
            onChange={(e) => setReuploadNotes(e.target.value)}
            placeholder="Notes for the artist (required)…"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              fontSize: 13,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setReuploadTarget(null); setReuploadNotes(''); }}>
              Cancel
            </Button>
            <Button
              variant="warning"
              size="sm"
              disabled={!reuploadNotes.trim() || reuploadMut.isPending}
              onClick={() => reuploadTarget && reuploadMut.mutate({ id: reuploadTarget.id, notes: reuploadNotes })}
            >
              {reuploadMut.isPending ? 'Updating…' : 'Require Reupload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
