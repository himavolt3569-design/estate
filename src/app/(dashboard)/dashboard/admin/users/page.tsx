import type { Metadata } from 'next';

import { Badge, EmptyState } from '@/components/ui/primitives';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import type { Role } from '@/lib/auth/session';
import { formatRelative } from '@/lib/format';
import { UserRowActions } from '@/modules/admin/components/UserRowActions';
import { getUsers } from '@/modules/admin/queries';

export const metadata: Metadata = { title: 'Users', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  active: 'verified',
  pending_verification: 'pending',
  suspended: 'rejected',
  banned: 'rejected',
} as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const users = await getUsers({
    search: pick('q'),
    role: pick('role'),
    status: pick('status'),
  });

  return (
    <div className="space-y-5">
      {/* A plain GET form: the filters live in the URL, so a filtered view is
          shareable and the back button behaves. No JavaScript needed. */}
      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="q"
          type="search"
          defaultValue={pick('q') ?? ''}
          placeholder="Search by name"
          aria-label="Search by name"
          className="h-10 min-w-48 flex-1 rounded-sm border border-ink-200 px-3 text-sm focus-visible:border-royal-700 focus-visible:outline-none"
        />
        <select
          name="role"
          defaultValue={pick('role') ?? ''}
          aria-label="Role"
          className="h-10 rounded-sm border border-ink-200 bg-white px-3 text-sm"
        >
          <option value="">Any role</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={pick('status') ?? ''}
          aria-label="Status"
          className="h-10 rounded-sm border border-ink-200 bg-white px-3 text-sm"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="pending_verification">Email not confirmed</option>
          <option value="suspended">Suspended</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-sm border border-ink-900 bg-ink-900 px-4 text-sm font-medium text-white"
        >
          Filter
        </button>
      </form>

      {users.length === 0 ? (
        <EmptyState
          title="Nobody matches those filters"
          description="Clear the search or pick a different role to see more people."
        />
      ) : (
        <div className="overflow-x-auto border border-ink-200">
          <table className="w-full min-w-3xl border-collapse bg-white text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th>Last seen</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{user.full_name ?? 'No name given'}</p>
                    {user.phone && <p className="nums text-2xs text-ink-400">{user.phone}</p>}
                    {user.suspended_reason && (
                      <p className="mt-1 text-2xs text-clay-700">{user.suspended_reason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {ROLE_LABELS[user.role as Role] ?? user.role}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[user.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                      {user.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="nums px-4 py-3 text-2xs text-ink-500">
                    {formatRelative(user.created_at)}
                  </td>
                  <td className="nums px-4 py-3 text-2xs text-ink-500">
                    {user.last_seen_at ? formatRelative(user.last_seen_at) : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <UserRowActions
                      userId={user.id}
                      name={user.full_name ?? 'this person'}
                      role={user.role}
                      status={user.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-2xs tracking-wide text-ink-400 uppercase ${className}`}>{children}</th>;
}
