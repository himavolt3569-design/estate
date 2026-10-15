import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { EmptyState, Field, Select } from '@/components/ui/primitives';
import { formatRelative } from '@/lib/format';
import { getAuditLog } from '@/modules/admin/queries';

import { PageHeader } from '../../components/PageHeader';

export const metadata: Metadata = { title: 'Audit log', robots: { index: false } };
export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  update: 'Changed',
  delete: 'Deleted',
  status_change: 'Status changed',
  role_change: 'Role changed',
  permission_change: 'Permissions changed',
  contact_reveal: 'Contact details shown',
  verification: 'Verification decision',
  payment_review: 'Payment reviewed',
  login: 'Signed in',
  logout: 'Signed out',
  suspend: 'Account suspended',
  service_role_write: 'System write',
};

const ENTITY_TYPES = ['properties', 'profiles', 'payments', 'reports', 'reviews', 'agencies'];

/**
 * The audit log browser.
 *
 * The table is append-only for every role including admins, enforced by a
 * trigger rather than a policy, so nothing on this screen can be edited or
 * cleared from anywhere in the product. Only the columns that actually changed
 * are stored, which is what makes a diff readable instead of a wall of
 * unchanged fields.
 *
 * Sensitive keys are already redacted by audit_redact() before storage, so an
 * account number cannot appear here even if it was part of the change.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const entries = await getAuditLog({
    entityType: pick('entity'),
    action: pick('action'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Audit log"
        subtitle="Everything consequential that has happened, written by the database itself. This log cannot be edited or cleared by anyone, including you."
      />

      {/*
        The filters were two bare `<select>`s and a hand-rolled black button, in
        a row that ran off the side of a phone. They use the same primitives as
        every other form on the site now, and stack rather than overflow.
      */}
      <form
        method="get"
        className="grid gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      >
        <Field label="Record type" htmlFor="entity">
          <Select id="entity" name="entity" defaultValue={pick('entity') ?? ''}>
            <option value="">Anything</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Action" htmlFor="action">
          <Select id="action" name="action" defaultValue={pick('action') ?? ''}>
            <option value="">Any action</option>
            {Object.entries(ACTION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" size="lg" className="w-full sm:w-auto">
          Filter
        </Button>
      </form>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Approvals, role changes, suspensions and payment decisions all appear here as they happen."
        />
      ) : (
        <ol className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
          {entries.map((entry) => (
            <li key={entry.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-ink-900">
                  {ACTION_LABEL[entry.action] ?? entry.action}{' '}
                  <span className="font-normal text-ink-500">in {entry.entity_type}</span>
                </p>
                <time
                  dateTime={entry.created_at}
                  className="nums text-2xs font-extralight text-ink-400"
                >
                  {formatRelative(entry.created_at)}
                </time>
              </div>

              <p className="nums mt-1 text-2xs break-all text-ink-400">
                {entry.actor_role ?? 'system'}
                {entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}` : ''}
                {entry.ip ? ` · ${String(entry.ip)}` : ''}
              </p>

              {entry.summary && <p className="mt-2 text-sm text-ink-600">{entry.summary}</p>}

              {entry.new_value && Object.keys(entry.new_value).length > 0 && (
                <dl className="mt-3 space-y-1 border-l-2 border-ink-200 pl-3">
                  {Object.entries(entry.new_value).map(([key, next]) => {
                    const before = entry.previous_value?.[key];
                    return (
                      <div key={key} className="flex flex-wrap items-baseline gap-2 text-2xs">
                        <dt className="tracking-wide text-ink-400 uppercase">{key}</dt>
                        <dd className="nums text-ink-700">
                          {before !== undefined && (
                            <>
                              <span className="text-clay-700 line-through">{render(before)}</span>
                              <span aria-hidden className="mx-1.5 text-ink-300">
                                &rarr;
                              </span>
                            </>
                          )}
                          <span className="text-emerald-800">{render(next)}</span>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Values arrive as JSONB, so they can be any shape. Keep them short and flat. */
function render(value: unknown): string {
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'string') return value.length > 60 ? `${value.slice(0, 60)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value).slice(0, 60);
}
