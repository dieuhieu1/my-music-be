'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle } from 'lucide-react';
import { adminApi, type GenreSuggestion } from '@/lib/api/admin.api';
import { Button } from '@/components/ui/button';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';

// BE GET /genres returns Genre[] plain array: { id, name, description }
function GenreList() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'genres'],
    queryFn: async () => (await adminApi.getGenres()).data,
    staleTime: 60_000,
  });

  const items = Array.isArray(data) ? data : [];

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
      <Table>
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Description</Th>
          </Tr>
        </Thead>
        <Tbody>
          {isLoading ? (
            <EmptyRow cols={2} message="Loading…" />
          ) : items.length === 0 ? (
            <EmptyRow cols={2} message="No genres." />
          ) : (
            items.map((genre) => (
              <Tr key={genre.id}>
                <Td className="font-medium">{genre.name}</Td>
                <Td className="text-[#6B7280]">{genre.description ?? '—'}</Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </div>
  );
}

// BE GET /admin/genres/suggestions returns GenreSuggestion[] plain array (no pagination).
// Fields: id, userId, songId, name, status, reviewedBy, reviewedAt, createdAt
// Filter PENDING client-side — BE has no filter param.
function SuggestionQueue() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<GenreSuggestion | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<GenreSuggestion | null>(null);

  const { data: allSuggestions, isLoading } = useQuery({
    queryKey: ['admin', 'genre-suggestions'],
    queryFn: async () => (await adminApi.getGenreSuggestions()).data,
  });

  // Filter PENDING client-side
  const pending = Array.isArray(allSuggestions)
    ? allSuggestions.filter((s) => s.status === 'PENDING')
    : [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['admin', 'genre-suggestions'] });
    qc.invalidateQueries({ queryKey: ['admin', 'genres'] });
  }

  const approveMut = useMutation({
    mutationFn: (id: string) => adminApi.approveGenreSuggestion(id),
    onSuccess: () => { toast('Suggestion approved.', 'success'); invalidate(); setConfirmApprove(null); },
    onError: () => toast('Failed to approve.', 'error'),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => adminApi.rejectGenreSuggestion(id),
    onSuccess: () => { toast('Suggestion rejected.', 'success'); invalidate(); setRejectTarget(null); },
    onError: () => toast('Failed to reject.', 'error'),
  });

  return (
    <>
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <Table>
          <Thead>
            <Tr>
              <Th>Genre Name</Th>
              <Th>Suggested By (User ID)</Th>
              <Th>Song ID</Th>
              <Th>Date</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <EmptyRow cols={5} message="Loading…" />
            ) : pending.length === 0 ? (
              <EmptyRow cols={5} message="No pending suggestions." />
            ) : (
              pending.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-medium">{s.name}</Td>
                  {/* BE returns userId/songId — no email/title available without JOIN */}
                  <Td className="text-[#6B7280] font-mono text-xs">{s.userId.slice(0, 8)}…</Td>
                  <Td className="text-[#6B7280] font-mono text-xs">
                    {s.songId ? `${s.songId.slice(0, 8)}…` : '—'}
                  </Td>
                  <Td className="text-[#9CA3AF] text-xs">
                    {format(new Date(s.createdAt), 'MMM d, yyyy')}
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="success" onClick={() => setConfirmApprove(s)}>
                        <CheckCircle size={13} /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectTarget(s)}>
                        <XCircle size={13} /> Reject
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!confirmApprove}
        onOpenChange={(open) => !open && setConfirmApprove(null)}
        title="Approve Genre Suggestion"
        description={`Approve "${confirmApprove?.name}" as a confirmed genre?`}
        confirmLabel="Approve"
        confirmVariant="success"
        loading={approveMut.isPending}
        onConfirm={() => confirmApprove && approveMut.mutate(confirmApprove.id)}
      />

      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject Genre Suggestion"
        description={`Reject "${rejectTarget?.name}"? This cannot be undone.`}
        confirmLabel="Reject"
        confirmVariant="destructive"
        loading={rejectMut.isPending}
        onConfirm={() => rejectTarget && rejectMut.mutate(rejectTarget.id)}
      />
    </>
  );
}

export function GenreSuggestionQueue() {
  const [tab, setTab] = useState<'confirmed' | 'suggestions'>('suggestions');

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E5E7EB' }}>
        {(['suggestions', 'confirmed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #2563EB' : '2px solid transparent',
              color: tab === t ? '#2563EB' : '#6B7280',
              textTransform: 'capitalize',
              transition: 'color 0.15s',
            }}
          >
            {t === 'suggestions' ? 'Suggestions' : 'Confirmed Genres'}
          </button>
        ))}
      </div>

      {tab === 'suggestions' ? <SuggestionQueue /> : <GenreList />}
    </div>
  );
}
