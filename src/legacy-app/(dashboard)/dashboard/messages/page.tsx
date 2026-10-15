import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth/session';
import { ConversationList } from '@/modules/messaging/components/ConversationList';
import { listConversations } from '@/modules/messaging/queries';

import { PageHeader } from '../components/PageHeader';

export const metadata: Metadata = { title: 'Messages', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/dashboard/messages');

  const conversations = await listConversations();

  return (
    <div className="max-w-3xl space-y-6 pb-10">
      <PageHeader
        eyebrow="Your account"
        title="Messages"
        subtitle="Conversations about listings, with the people on the other end of them."
      />
      <ConversationList initial={conversations} viewerId={user.id} />
    </div>
  );
}
