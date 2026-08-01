import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
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
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-soft">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/70 text-left">
                <Th>Search</Th>
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
