import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/lib/auth/session';
import { ConversationView } from '@/modules/messaging/components/ConversationView';
import { getConversation } from '@/modules/messaging/queries';

export const metadata: Metadata = { title: 'Conversation', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;

  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/dashboard/messages/${threadId}`);

  const conversation = await getConversation(threadId);

  /*
   * get_conversation() raises for a non-participant rather than returning an
   * empty thread, so a null here means "not yours or not there". Both get the
   * same answer: naming which one it is would confirm the thread exists to
   * somebody probing ids.
   */
  if (!conversation) {
    return (
      <div className="max-w-md space-y-4 py-12">
        <h1 className="text-xl font-semibold text-ink-900">This conversation is not available</h1>
        <p className="text-sm text-ink-600">
          It may have been removed, or it may belong to somebody else.
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/dashboard/messages">
            <ArrowLeft aria-hidden /> All messages
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl pb-10">
      <ConversationView conversation={conversation} viewerId={user.id} />
    </div>
  );
}
