'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, ShieldAlert } from 'lucide-react';
import { adminApi, type Report } from '@/lib/api/admin.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow, Pagination } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';

const STATUS_OPTS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'DISMISSED', label: 'Dismissed' },
  { value: 'TAKEN_DOWN', label: 'Taken Down' },
  { value: '', label: 'All' },
];

const TYPE_OPTS = [
  { value: '', label: 'All Types' },
  { value: 'SONG', label: 'Song' },
  { value: 'USER', label: 'User' },
  { value: 'PLAYLIST', label: 'Playlist' },
  { value: 'COMMENT', label: 'Comment' },
];

export function ReportQueue() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [status, setStatus] = useState('PENDING');
  const [targetType, setTargetType] = useState('');
  const [page, setPage] = useState(1);
  const [dismissTarget, setDismissTarget] = useState<Report | null>(null);
  const [takedownTarget, setTakedownTarget] = useState<Report | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', status, targetType, page],
    queryFn: async () =>
      (await adminApi.getReports({
        status: status || undefined,
        targetType: targetType || undefined,
        page,
        size: 20,
      })).data,
    placeholderData: (prev) => prev,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
  }

  const dismissMut = useMutation({
    mutationFn: (id: string) => adminApi.dismissReport(id),
    onSuccess: () => { toast('Report dismissed.', 'success'); invalidate(); setDismissTarget(null); },
    onError: () => toast('Failed to dismiss.', 'error'),
  });

  const takedownMut = useMutation({
    mutationFn: (id: string) => adminApi.takedownReport(id),
    onSuccess: () => { toast('Content taken down.', 'success'); invalidate(); setTakedownTarget(null); },
    onError: () => toast('Failed to take down.', 'error'),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div style={{ minWidth: 160 }}>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
        <div style={{ minWidth: 160 }}>
          <Select value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1); }}>
            {TYPE_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <Table>
          <Thead>
            <Tr>
              <Th>Target</Th>
              <Th>Type</Th>
              <Th>Reason</Th>
              <Th>Reporter</Th>
              <Th>Status</Th>
              <Th>Date</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <EmptyRow cols={7} message="Loading…" />
            ) : data?.items.length === 0 ? (
              <EmptyRow cols={7} message="No reports found." />
            ) : (
              data?.items.map((report) => (
                <Tr key={report.id}>
                  <Td className="font-medium max-w-[180px] truncate">{report.targetTitle}</Td>
                  <Td><Badge variant="muted">{report.targetType}</Badge></Td>
                  <Td className="text-[#6B7280] max-w-[200px] truncate">{report.reason}</Td>
                  <Td className="text-[#6B7280]">{report.reporterEmail}</Td>
                  <Td><Badge status={report.status}>{report.status}</Badge></Td>
                  <Td className="text-[#9CA3AF] text-xs">
                    {format(new Date(report.createdAt), 'MMM d, yyyy')}
                  </Td>
                  <Td>
                    {report.status === 'PENDING' && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setDismissTarget(report)}>
                          <CheckCheck size={13} /> Dismiss
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setTakedownTarget(report)}>
                          <ShieldAlert size={13} /> Takedown
                        </Button>
                      </div>
                    )}
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>

      <ConfirmDialog
        open={!!dismissTarget}
        onOpenChange={(open) => !open && setDismissTarget(null)}
        title="Dismiss Report"
        description={`Dismiss report against "${dismissTarget?.targetTitle}"? No action will be taken on the content.`}
        confirmLabel="Dismiss"
        confirmVariant="default"
        loading={dismissMut.isPending}
        onConfirm={() => dismissTarget && dismissMut.mutate(dismissTarget.id)}
      />

      <ConfirmDialog
        open={!!takedownTarget}
        onOpenChange={(open) => !open && setTakedownTarget(null)}
        title="Takedown Content"
        description={`Take down "${takedownTarget?.targetTitle}"?`}
        confirmLabel="Takedown"
        confirmVariant="destructive"
        loading={takedownMut.isPending}
        onConfirm={() => takedownTarget && takedownMut.mutate(takedownTarget.id)}
      >
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            fontSize: 13,
            color: '#B91C1C',
          }}
        >
          ⚠ This will remove the content from the platform immediately.
          The artist will be notified. This action cannot be undone from the admin portal.
        </div>
      </ConfirmDialog>
    </div>
  );
}
