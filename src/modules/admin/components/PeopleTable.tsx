'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/select-menu';
import { formatDate } from '@/lib/format';

import { PersonSheet, type Person } from './PersonSheet';

const ROLE_LABEL: Record<string, string> = {
  platform_admin: 'Master admin',
  agency_manager: 'Agency manager',
  agent: 'Agent',
  property_owner: 'Owner',
  customer: 'Customer',
};

const STATUS_TONE = {
  active: 'verified',
  pending_verification: 'pending',
  suspended: 'rejected',
  banned: 'rejected',
} as const;

/**
 * Everyone on the platform, filtered in the browser.
 *
 * Client-side filtering is the right call while the list is small: it makes
 * search instant and costs one query. It stops being right somewhere in the low
 * thousands of accounts, at which point this needs to move to a server query
 * with a keyset cursor, the way the property search already works.
 */
export function PeopleTable({ people }: { people: Person[] }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Person | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return people.filter((person) => {
      if (role && person.role !== role) return false;
      if (status && person.status !== status) return false;
      if (!needle) return true;

      return [person.full_name, person.email, person.phone]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });
  }, [people, query, role, status]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <div className="relative">
          <Search
            aria-hidden
            className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email or phone"
            aria-label="Search people"
            className="h-12 w-full rounded-lg border border-ink-200 bg-white pr-4 pl-10 text-sm shadow-sm transition-colors hover:border-ink-300 focus-visible:border-royal-500 focus-visible:ring-2 focus-visible:ring-royal-500/20 focus-visible:outline-none"
          />
        </div>

        <SelectMenu
          value={role}
          onValueChange={setRole}
          ariaLabel="Filter by role"
          options={[
            { value: '', label: 'Any role' },
            { value: 'customer', label: 'Customers' },
            { value: 'property_owner', label: 'Owners' },
            { value: 'agent', label: 'Agents' },
            { value: 'agency_manager', label: 'Agency managers' },
            { value: 'platform_admin', label: 'Master admin' },
          ]}
        />

        <SelectMenu
          value={status}
          onValueChange={setStatus}
          ariaLabel="Filter by status"
          options={[
            { value: '', label: 'Any status' },
            { value: 'active', label: 'Active' },
            { value: 'pending_verification', label: 'Unconfirmed' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'banned', label: 'Banned' },
          ]}
        />
      </div>

      {selected && <PersonSheet person={selected} onDone={() => setSelected(null)} />}

      <p className="nums text-sm text-ink-500">
        {filtered.length} of {people.length} {people.length === 1 ? 'account' : 'accounts'}
      </p>

      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/70 text-left">
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th className="text-right">Manage</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((person) => (
                <tr key={person.id} className="transition-colors hover:bg-ink-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">
                      {person.full_name || 'Unnamed account'}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {person.email ?? '—'}
                      {person.phone ? ` · ${person.phone}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {ROLE_LABEL[person.role] ?? person.role}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[person.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                      {person.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="nums px-4 py-3 text-xs text-ink-500">
                    {formatDate(person.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(person)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-crimson-700 transition-colors hover:bg-crimson-50"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-500">
                    Nobody matches that.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-2xs tracking-wide text-ink-400 uppercase ${className}`}>
      {children}
    </th>
  );
}
