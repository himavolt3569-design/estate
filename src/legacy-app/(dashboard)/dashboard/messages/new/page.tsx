import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'New message', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * The landing point for "Message the owner" on a listing page.
 *
 * A route rather than a button action, because the listing page is ISR-cached
 * and anonymous: sending the visitor here lets the proxy bounce them through
 * sign-in first and return them, with the property id intact, instead of the
 * button failing silently for a signed-out reader.
 *
 * start_property_conversation() is idempotent, so arriving here twice for the
 * same listing lands in the same thread rather than making a second one.
 */
export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const { property } = await searchParams;

  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/dashboard/messages/new?property=${property ?? ''}`)}`,
    );
  }

  if (!property) redirect('/dashboard/messages');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_property_conversation', {
    p_property_id: property,
  });

  if (error || !data) {
    return (
      <div className="max-w-md space-y-4 py-12">
        <h1 className="text-xl font-semibold text-ink-900">This conversation could not be opened</h1>
        <p className="text-sm text-ink-600">
          {error?.message?.replace(/^.*?:\s*/, '') ??
            'The listing may no longer be available.'}
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/dashboard/messages">
            <ArrowLeft aria-hidden /> All messages
          </Link>
        </Button>
      </div>
    );
  }

  redirect(`/dashboard/messages/${data as unknown as string}`);
}
