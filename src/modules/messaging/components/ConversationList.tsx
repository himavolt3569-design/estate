'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Avatar } from '@/components/media/Avatar';
import { PropertyImage } from '@/components/media/PropertyImage';
import { formatRelative } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import type { ConversationSummary } from '../types';

/**
 * The inbox.
 *
 * Subscribed to every message rather than to one thread, because the point of an
 * inbox is to react to a conversation you are not currently looking at. The
 * filter is done by the refetch, which runs through list_conversations() under
 * RLS: an INSERT on a thread this user is not in produces a refetch that returns
 * the same list, not a leak.
 */
export function ConversationList({
  initial,
  viewerId,
}: {
  initial: ConversationSummary[];
  viewerId: string;
}) {
  const [conversations, setConversations] = useState(initial);
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setConversations(initial);
  }, [initial]);

  useEffect(() => {
    const refetch = async () => {
      const { data, error } = await supabase.rpc('list_conversations');
      if (error || !data) return;
      setConversations(data as unknown as ConversationSummary[]);
    };

    const channel = supabase
      .channel('inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        void refetch();
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'thread_participants' },
        () => {
          // Another tab marked something read; the badge here has to follow.
          void refetch();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
        <p className="text-sm font-medium text-ink-900">No conversations yet</p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-ink-500">
          When you message a seller, or somebody asks about one of your listings, the conversation
          appears here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
      {conversations.map((conversation) => {
        const active = pathname === `/dashboard/messages/${conversation.id}`;
        const last = conversation.lastMessage;
        const unread = conversation.unread > 0;

        return (
          <li key={conversation.id}>
            <Link
              href={`/dashboard/messages/${conversation.id}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                active ? 'bg-royal-50/70' : 'hover:bg-ink-50/70',
              )}
            >
              <Avatar
                src={conversation.other?.avatarUrl}
                name={conversation.other?.name}
                size="md"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      'truncate text-sm text-ink-900',
                      unread ? 'font-semibold' : 'font-medium',
                    )}
                  >
                    {conversation.other?.name ?? 'Kitta user'}
                  </p>
                  <time
                    dateTime={conversation.updatedAt}
                    className="nums shrink-0 text-2xs text-ink-400"
                  >
                    {formatRelative(conversation.updatedAt)}
                  </time>
                </div>

                <p className="mt-0.5 truncate text-xs text-ink-500">
                  {conversation.property?.title ?? 'Listing removed'}
                </p>

                {last && (
                  <p
                    className={cn(
                      'mt-1 truncate text-xs',
                      unread ? 'text-ink-800' : 'text-ink-400',
                    )}
                  >
                    {last.senderId === viewerId ? 'You: ' : ''}
                    {last.body}
                  </p>
                )}
              </div>

              {conversation.property?.cover && (
                <PropertyImage
                  renditions={conversation.property.cover.renditions ?? undefined}
                  storagePath={conversation.property.cover.storagePath}
                  alt=""
                  width={64}
                  height={64}
                  sizes="48px"
                  wrapperClassName="hidden w-12 shrink-0 rounded-lg sm:block"
                />
              )}

              {unread && (
                <span className="nums flex size-5 shrink-0 items-center justify-center rounded-full bg-crimson-600 text-2xs font-semibold text-white">
                  {conversation.unread > 9 ? '9+' : conversation.unread}
                  <span className="sr-only">unread messages</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
