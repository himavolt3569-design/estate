import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * One dataset, two presentations.
 *
 * Every list in the dashboard was a `min-w-3xl` table inside an
 * `overflow-x-auto` div. That is not "responsive" — it is a 768px table with a
 * scrollbar bolted on, and on a 375px phone it means the reader can see two
 * columns at a time and has to swipe sideways to find out which row they are
 * looking at, with the row identity scrolled off the left edge. Sideways
 * scrolling inside a vertically scrolling page is also the single most
 * frustrating gesture on a touchscreen, because the two compete.
 *
 * So the columns declare what they are for, and the same rows render as a table
 * on a wide screen and as a stack of cards on a narrow one. The data is
 * declared once; only the arrangement changes.
 *
 *   title   the row's identity. The card's heading, always first.
 *   badge   a status chip. Sits opposite the title.
 *   meta    a labelled fact. Becomes a label/value pair in the card body.
 *   action  a control. Moves to the card's footer, full width and tappable.
 *   hide    desktop only — a column that is noise once space is tight.
 */
export type ColumnRole = 'title' | 'badge' | 'meta' | 'action' | 'hide';

export type Column<T> = {
  /** Stable key. Also the visible column header unless `header` is given. */
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** How this column behaves once the table becomes a card. Default 'meta'. */
  role?: ColumnRole;
  /** A 'meta' column that needs the card's full width — a message body, say. */
  wide?: boolean;
  align?: 'left' | 'right';
  /** Applied to the `<td>` only. */
  className?: string;
  /** Applied to the header cell only. */
  headerClassName?: string;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  /** Optional per-row link. Makes the whole mobile card tappable. */
  caption,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  caption?: string;
  className?: string;
}) {
  const titleColumns = columns.filter((column) => column.role === 'title');
  const badgeColumns = columns.filter((column) => column.role === 'badge');
  const actionColumns = columns.filter((column) => column.role === 'action');
  const metaColumns = columns.filter(
    (column) => column.role !== 'title' && column.role !== 'badge' && column.role !== 'action' && column.role !== 'hide',
  );

  return (
    <div className={className}>
      {/* ---------------------------------------------------------------- */}
      {/* Cards — phones and small tablets                                  */}
      {/* ---------------------------------------------------------------- */}
      <ul className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {titleColumns.map((column) => (
                  <div key={column.key} className="min-w-0">
                    {column.cell(row)}
                  </div>
                ))}
              </div>
              {badgeColumns.length > 0 && (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {badgeColumns.map((column) => (
                    <div key={column.key}>{column.cell(row)}</div>
                  ))}
                </div>
              )}
            </div>

            {metaColumns.length > 0 && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-ink-100 pt-3">
                {metaColumns.map((column) => (
                  <div key={column.key} className={cn('min-w-0', column.wide && 'col-span-2')}>
                    <dt className="text-2xs tracking-wide text-ink-400 uppercase">
                      {column.header}
                    </dt>
                    <dd className="mt-0.5 min-w-0 text-sm text-ink-800">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {actionColumns.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
                {actionColumns.map((column) => (
                  <div key={column.key} className="min-w-0">
                    {column.cell(row)}
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* ---------------------------------------------------------------- */}
      {/* Table — from lg up, where the columns genuinely fit               */}
      {/* ---------------------------------------------------------------- */}
      <div className="hidden overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft lg:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/70 text-left">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'px-4 py-3 text-2xs tracking-wide text-ink-400 uppercase',
                      column.align === 'right' && 'text-right',
                      column.headerClassName,
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((row) => (
                <tr key={rowKey(row)} className="transition-colors hover:bg-ink-50/60">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3 align-top',
                        column.align === 'right' && 'text-right',
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
