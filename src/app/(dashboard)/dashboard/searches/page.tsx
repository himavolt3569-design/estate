import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          Saved Searches
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Manage your saved property searches
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title="No saved searches"
          description="When you save a search query, it will appear here."
          action={
            <Button asChild>
              <Link href="/search">Start searching</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto border border-ink-200">
          <table className="w-full min-w-3xl border-collapse bg-white text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <Th>Search Name</Th>
                <Th>Notifications</Th>
                <Th>Frequency</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((search: any) => (
                <tr key={search.id} className="group hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{search.name}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {search.notify ? 'Enabled' : 'Disabled'}
                  </td>
                  <td className="px-4 py-3 text-ink-600 capitalize">
                    {search.frequency}
                  </td>
                  <td className="nums px-4 py-3 text-2xs text-ink-500">
                    {formatRelative(search.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
                      <Link href="/search">
                        View Results
                      </Link>
                    </Button>
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
