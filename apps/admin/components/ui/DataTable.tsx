'use client';

import { ChevronsUpDown, type LucideIcon } from 'lucide-react';
import React, { Fragment } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  width?: string | number;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;

  /** Bulk selection (controlled) */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;

  /** Pagination (controlled — totalPages computed internally) */
  page: number;
  size: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onSizeChange?: (size: number) => void;

  /** Row interaction */
  onRowClick?: (row: T) => void;
  activeRowId?: string;

  /** Expand row — renders a detail section below the clicked row */
  expandedRowId?: string;
  renderExpanded?: (row: T) => React.ReactNode;
}

// ── Pagination helpers ─────────────────────────────────────────────────────

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1) as number[];
  }
  const pages = new Set<number>([1, total]);
  for (let p = Math.max(1, current - 2); p <= Math.min(total, current + 2); p++) {
    pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | '...')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...');
    result.push(sorted[i]);
  }
  return result;
}

// ── Skeleton row ───────────────────────────────────────────────────────────

const SKELETON_WIDTHS = ['60%', '75%', '50%', '65%', '55%', '70%', '45%', '80%'];

function SkeletonRow({ cols, hasBulk }: { cols: number; hasBulk: boolean }) {
  return (
    <tr>
      {hasBulk && (
        <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div className="skeleton" style={{ width: 18, height: 18, borderRadius: 4 }} />
        </td>
      )}
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div className="skeleton" style={{ height: 14, width: SKELETON_WIDTHS[i % SKELETON_WIDTHS.length] }} />
        </td>
      ))}
    </tr>
  );
}

// ── PageButton ─────────────────────────────────────────────────────────────

function PageButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 32,
        height: 32,
        padding: '0 6px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? '#fff' : disabled ? 'var(--text-faint)' : 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 150ms ease',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'var(--accent-light)';
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'var(--surface)';
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-muted)';
        }
      }}
    >
      {label}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  emptyMessage = 'No data found',
  emptyIcon: EmptyIcon,
  selectable,
  selectedIds = [],
  onSelectionChange,
  page,
  size,
  totalItems,
  onPageChange,
  onSizeChange,
  onRowClick,
  activeRowId,
  expandedRowId,
  renderExpanded,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const startItem = totalItems === 0 ? 0 : (page - 1) * size + 1;
  const endItem = Math.min(page * size, totalItems);

  const hasBulk = selectable && !!onSelectionChange;
  const allIds = data.map(rowKey);
  const allSelected = hasBulk && allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const someSelected = hasBulk && allIds.some((id) => selectedIds.includes(id));

  function toggleRow(id: string, checked: boolean) {
    if (!onSelectionChange) return;
    onSelectionChange(checked ? [...selectedIds, id] : selectedIds.filter((s) => s !== id));
  }

  function toggleAll(checked: boolean) {
    if (!onSelectionChange) return;
    if (checked) {
      const merged = Array.from(new Set([...selectedIds, ...allIds]));
      onSelectionChange(merged);
    } else {
      onSelectionChange(selectedIds.filter((id) => !allIds.includes(id)));
    }
  }

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>

          {/* Header */}
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
              {hasBulk && (
                <th style={{ width: 40, padding: '12px 16px', textAlign: 'left' }}>
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && !!someSelected;
                    }}
                    onChange={(e) => toggleAll(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                    whiteSpace: 'nowrap',
                    width: col.width,
                  }}
                >
                  {col.sortable ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'default' }}>
                      {col.header}
                      <ChevronsUpDown size={14} color="var(--text-faint)" />
                    </span>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} hasBulk={!!hasBulk} />
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (hasBulk ? 1 : 0)}
                  style={{ padding: '48px 16px', textAlign: 'center', minHeight: 200 }}
                >
                  {EmptyIcon && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                      <EmptyIcon size={48} color="var(--text-faint)" />
                    </div>
                  )}
                  <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {emptyMessage}
                  </p>
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const id = rowKey(row);
                const isActive = activeRowId === id;
                const isExpanded = expandedRowId === id;
                const isSelected = selectedIds.includes(id);
                const delay = `${Math.min(index + 1, 8) * 30}ms`;
                const colCount = columns.length + (hasBulk ? 1 : 0);

                return (
                  <Fragment key={id}>
                    <tr
                      className="animate-fade-in"
                      onClick={() => onRowClick?.(row)}
                      style={{
                        borderBottom: (!isExpanded && index < data.length - 1) ? '1px solid var(--border)' : 'none',
                        background: isActive
                          ? 'var(--accent-light)'
                          : isSelected
                            ? 'rgba(99,102,241,0.05)'
                            : 'transparent',
                        cursor: onRowClick ? 'pointer' : 'default',
                        transition: 'background 100ms',
                        animationDelay: delay,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'var(--bg-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive)
                          e.currentTarget.style.background = isSelected ? 'rgba(99,102,241,0.05)' : 'transparent';
                      }}
                    >
                      {hasBulk && (
                        <td
                          style={{ padding: '14px 16px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleRow(id, e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          style={{
                            padding: '14px 16px',
                            fontSize: 14,
                            color: 'var(--text)',
                            verticalAlign: 'middle',
                          }}
                        >
                          {col.render
                            ? col.render(row)
                            : String((row as Record<string, unknown>)[col.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && renderExpanded && (
                      <tr>
                        <td
                          colSpan={colCount}
                          style={{ padding: 0, borderBottom: index < data.length - 1 ? '1px solid var(--border)' : 'none' }}
                        >
                          {renderExpanded(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        {/* Left: showing count */}
        <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {totalItems === 0
            ? 'No results'
            : `Showing ${startItem}–${endItem} of ${totalItems} results`}
        </span>

        {/* Right: size selector + page buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Rows-per-page selector */}
          {onSizeChange && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Rows:</span>
              <select
                value={size}
                onChange={(e) => onSizeChange(Number(e.target.value))}
                style={{
                  fontSize: 13,
                  color: 'var(--text)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          )}

          {/* Page buttons */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Previous */}
              <PageButton
                label="‹"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              />

              {/* Numbered pages with ellipsis */}
              {pageNumbers.map((p, i) =>
                p === '...' ? (
                  <span
                    key={`ellipsis-${i}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 32,
                      height: 32,
                      fontSize: 13,
                      color: 'var(--text-faint)',
                      userSelect: 'none',
                    }}
                  >
                    …
                  </span>
                ) : (
                  <PageButton
                    key={p}
                    label={p}
                    active={p === page}
                    onClick={() => onPageChange(p as number)}
                  />
                )
              )}

              {/* Next */}
              <PageButton
                label="›"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
