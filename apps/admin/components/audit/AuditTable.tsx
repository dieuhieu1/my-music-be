'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin.api';
import { Input, Select } from '@/components/ui/input';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyRow, Pagination } from '@/components/ui/table';
import { format } from 'date-fns';

export function AuditTable() {
  const [action, setAction] = useState('');
  const [adminId, setAdminId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', action, adminId, from, to, page],
    queryFn: async () =>
      (await adminApi.getAuditLogs({
        action: action || undefined,
        adminId: adminId || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        size: 20,
      })).data,
    placeholderData: (prev) => prev,
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div style={{ minWidth: 180 }}>
          <Input
            type="text"
            placeholder="Filter by action…"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
          />
        </div>
        <div style={{ minWidth: 220 }}>
          <Input
            type="text"
            placeholder="Filter by admin ID…"
            value={adminId}
            onChange={(e) => { setAdminId(e.target.value); setPage(1); }}
          />
        </div>
        <div>
          <Input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            placeholder="From"
          />
        </div>
        <div>
          <Input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            placeholder="To"
          />
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <Table>
          <Thead>
            <Tr>
              <Th>Admin</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Notes</Th>
              <Th>Date</Th>
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <EmptyRow cols={5} message="Loading…" />
            ) : data?.items.length === 0 ? (
              <EmptyRow cols={5} message="No audit logs found." />
            ) : (
              data?.items.map((log) => (
                <Tr key={log.id}>
                  <Td className="text-[#374151]">{log.adminEmail}</Td>
                  <Td>
                    <span className="font-medium text-[#111827]">{log.action}</span>
                  </Td>
                  <Td className="text-[#6B7280] text-xs">
                    {log.targetType && log.targetId
                      ? `${log.targetType} / ${log.targetId.slice(0, 8)}…`
                      : '—'}
                  </Td>
                  <Td className="text-[#6B7280] max-w-[200px] truncate">
                    {log.notes ?? '—'}
                  </Td>
                  <Td className="text-[#9CA3AF] text-xs">
                    {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </div>
  );
}
