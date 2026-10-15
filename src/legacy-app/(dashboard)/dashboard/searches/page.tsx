import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { PageHeader } from '../components/PageHeader';
import { getTranslation } from '@/i18n';
import { getSessionUser } from '@/lib/auth/session';
import { formatRelative } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Saved Searches', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardSearchesPage() {
  const [user] = await Promise.all([getSessionUser(), getTranslation()]);
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: searches } = await supabase
    .from('saved_searches')
    .select('*')
    .order('created_at', { ascending: false });

  const rows = searches ?? [];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Your account"
        title="Saved searches"
        subtitle="Searches you asked us to keep an eye on. We tell you when something new matches."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title="No saved searches yet"
          description="Run a search you like, then save it, and we will tell you when a new property matches it."
          action={
            <Button asChild>
              <Link href="/search">Start searching</Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          caption="Saved searches"
          rows={rows as SavedSearch[]}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'name',
              header: 'Search',
              role: 'title',
              cell: (row) => <p className="font-medium text-ink-900">{row.name}</p>,
            },
            {
              key: 'notify',
              header: 'Notifications',
              role: 'badge',
              cell: (row) => (
                <Badge tone={row.notify ? 'verified' : 'neutral'}>
                  {row.notify ? 'On' : 'Off'}
                </Badge>
              ),
            },
            {
              key: 'frequency',
              header: 'Frequency',
              cell: (row) => <span className="text-ink-600 capitalize">{row.frequency}</span>,
            },
            {
              key: 'created',
              header: 'Created',
              cell: (row) => (
                <span className="nums text-xs text-ink-500">{formatRelative(row.created_at)}</span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              role: 'action',
              align: 'right',
              cell: (row) => (
                <Button asChild variant="secondary" size="sm">
                  {/* The saved query is stored on the row, so the link can
                      reopen the actual search rather than a blank one. */}
                  <Link href={searchHref(row)}>See results</Link>
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

type SavedSearch = {
  id: string;
  name: string;
  notify: boolean | null;
  frequency: string | null;
  created_at: string;
  filters: Record<string, unknown> | null;
};

/**
 * Turns the stored filter object back into a /search URL.
 *
 * "View Results" used to link at `/search` with nothing on it, so every saved
 * search opened the same unfiltered list — the row's whole purpose thrown away
 * at the last step. saved_searches.filters holds the same object the search
 * form serialises, so it round-trips; the one key that does not is `subtypes`,
 * which the page reads back as a single `subtype`.
 */
function searchHref(row: SavedSearch): string {
  const filters = row.filters;
  if (!filters || typeof filters !== 'object') return '/search';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params.set(key === 'subtypes' ? 'subtype' : key, String(value[0]));
      continue;
    }
    params.set(key, String(value));
  }

  const search = params.toString();
  return search ? `/search?${search}` : '/search';
}
