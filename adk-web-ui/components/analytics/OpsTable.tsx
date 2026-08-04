'use client';

import { useMemo, useState, type ReactNode } from 'react';

export type OpsTableColumn<T> = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  sortValue?: (row: T) => string | number | null;
  render: (row: T) => ReactNode;
};

type Props<T> = {
  rows: T[];
  columns: OpsTableColumn<T>[];
  filterPlaceholder?: string;
  rowKey: (row: T) => string;
  filterText?: (row: T) => string;
};

export default function OpsTable<T>({
  rows,
  columns,
  filterPlaceholder = 'Filter…',
  rowKey,
  filterText,
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !filterText) return rows;
    return rows.filter((row) => filterText(row).toLowerCase().includes(q));
  }, [rows, query, filterText]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return copy;
  }, [filtered, sortKey, sortDir, columns]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={filterPlaceholder}
        className="w-full max-w-sm rounded-lg border border-md-outline/50 bg-md-surface px-3 py-2 text-sm text-md-on-surface placeholder:text-md-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-md-primary/40"
      />
      <div className="overflow-x-auto rounded-xl border border-md-outline/40">
        <table className="w-full text-left text-sm">
          <thead className="bg-md-surface-container/60 text-label-small text-md-on-surface-variant">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 font-medium ${
                    col.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="hover:text-md-on-surface"
                    >
                      {col.header}
                      {sortKey === col.key
                        ? sortDir === 'asc'
                          ? ' ↑'
                          : ' ↓'
                        : ''}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-md-on-surface-variant"
                >
                  No rows match.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-t border-md-outline/30 text-md-on-surface"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-2.5 ${
                        col.align === 'right' ? 'text-right tabular-nums' : ''
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-label-small text-md-on-surface-variant">
        {sorted.length} row{sorted.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}
