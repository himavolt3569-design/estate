'use client';

import { AlertCircle, ArrowLeft, Loader2, Send, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Avatar } from '@/components/media/Avatar';
import { PropertyImage } from '@/components/media/PropertyImage';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { markThreadRead, sendMessage } from '../actions';
import type { Conversation, ConversationMessage } from '../types';

type Status = 'connecting' | 'live' | 'offline';

/**
 * One conversation, kept current over Realtime.
 *
 * The subscription carries a signal, not a payload: an INSERT on this thread
 * triggers a refetch through get_conversation(), which runs the participant
 * check again. That is deliberate — a message is never rendered because a
 * websocket frame said so, only because the database returned it to this user.
 *
 * The optimistic echo is separate. A sent message appears immediately with a
 * temporary id and is reconciled when the real row arrives, so the thread does
 * not feel like it is waiting on a round trip. Reconciliation is by id, so the
 * realtime copy of your own message replaces the echo instead of doubling it.
 */
export function ConversationView({
  conversation,
  viewerId,
}: {
  conversation: Conversation;
  viewerId: string;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>(conversation.messages);
  const [pendingBody, setPendingBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('connecting');

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const refetch = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('get_conversation', {
      p_thread_id: conversation.id,
    });
    if (rpcError || !data) return;
    const fresh = data as unknown as Conversation;
    setMessages(fresh.messages);
  }, [conversation.id, supabase]);

  /* ---------------------------------------------------------------------- */
  /* Realtime                                                                */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const channel = supabase
      .channel(`thread:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${conversation.id}`,
        },
        () => {
          void refetch();
        },
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') setStatus('live');
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setStatus('offline');
        }
      });

    /*
     * Removing the channel on unmount is what stops a user who walks three
     * threads from holding three subscriptions and receiving the same insert
     * three times. Without it every navigation adds a listener that never goes
     * away, and the message list starts duplicating rows.
     */
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id, refetch, supabase]);

  /* Mark read on open, and whenever a new message lands while open. */
  useEffect(() => {
    void markThreadRead({ threadId: conversation.id });
  }, [conversation.id, messages.length]);

  /* Keep the newest message in view. */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = pendingBody.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);

    const echoId = `pending-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      { id: echoId, body, senderId: viewerId, createdAt: new Date().toISOString() },
    ]);
    setPendingBody('');

    const result = await sendMessage({ threadId: conversation.id, body });

    if (!result.ok) {
      // Put the text back rather than losing it, and take the echo out so the
      // thread does not claim to have sent something it did not.
      setMessages((prev) => prev.filter((message) => message.id !== echoId));
      setPendingBody(body);
      setError(result.error);
      setSending(false);
      return;
    }

    setMessages((prev) => {
      const withoutEcho = prev.filter((message) => message.id !== echoId);
      if (withoutEcho.some((message) => message.id === result.data.id)) return withoutEcho;
      return [...withoutEcho, result.data];
    });
    setSending(false);
  }

  const property = conversation.property;
  const other = conversation.other;
  const propertyHref = property
    ? `/properties/${property.provinceSlug ?? 'nepal'}/${property.locationSlug}/${property.slug}`
    : null;

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col rounded-2xl border border-ink-100 bg-white shadow-soft">
      {/* -------------------- Header with the listing preview -------------------- */}
      <header className="shrink-0 border-b border-ink-100 p-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 shrink-0 lg:hidden">
            <Link href="/dashboard/messages" aria-label="Back to all messages">
              <ArrowLeft aria-hidden className="size-4" />
            </Link>
          </Button>

          <Avatar src={other?.avatarUrl} name={other?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-900">
              {other?.name ?? 'Kitta user'}
            </p>
            <ConnectionLabel status={status} />
          </div>
        </div>

        {property && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/60 p-2.5">
            <PropertyImage
              renditions={property.cover?.renditions ?? undefined}
              storagePath={property.cover?.storagePath}
              alt={property.title}
              width={80}
              height={60}
              sizes="64px"
              wrapperClassName="w-16 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{property.title}</p>
              <p className="nums mt-0.5 text-xs text-ink-500">
                {formatPrice(property.price, { period: property.pricePeriod })} · {property.locality}
              </p>
            </div>
            {propertyHref && (
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href={propertyHref} target="_blank">
                  View
                </Link>
              </Button>
            )}
          </div>
        )}
      </header>

      {/* -------------------- Messages -------------------- */}
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="max-w-xs text-sm text-ink-500">
              No messages yet. Ask about the price, the paperwork, or when you could visit.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === viewerId;
            const optimistic = message.id.startsWith('pending-');

            return (
              <div
                key={message.id}
                className={cn('flex', mine ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[70%]',
                    mine
                      ? 'bg-royal-600 text-white'
                      : 'border border-ink-200 bg-white text-ink-900',
                    optimistic && 'opacity-70',
                  )}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {message.body}
                  </p>
                  <time
                    dateTime={message.createdAt}
                    className={cn(
                      'nums mt-1 block text-2xs',
                      mine ? 'text-white/70' : 'text-ink-400',
                    )}
                  >
                    {optimistic
                      ? 'Sending…'
                      : new Date(message.createdAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                  </time>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* -------------------- Composer -------------------- */}
      <form onSubmit={submit} className="shrink-0 border-t border-ink-100 p-3">
        {error && (
          <p
            role="alert"
            className="mb-2 flex items-start gap-2 rounded-lg bg-clay-50 px-3 py-2 text-xs text-clay-800"
          >
            <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex items-end gap-2">
          <label htmlFor="message-body" className="sr-only">
            Your message
          </label>
          <textarea
            id="message-body"
            value={pendingBody}
            onChange={(event) => setPendingBody(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter makes a new line. On a touch keyboard
              // Enter is a newline, which is why the button is always present.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit(event as unknown as React.FormEvent);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Write a message"
            className="max-h-32 min-h-11 w-full resize-y rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm outline-none focus:border-royal-500"
          />
          <Button type="submit" disabled={sending || pendingBody.trim().length === 0} size="lg">
            {sending ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden className="size-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

function ConnectionLabel({ status }: { status: Status }) {
  if (status === 'live') {
    return (
      <p className="flex items-center gap-1.5 text-2xs text-emerald-700">
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-600" />
        Live
      </p>
    );
  }

  if (status === 'connecting') {
    return <p className="text-2xs text-ink-400">Connecting…</p>;
  }

  return (
    <p className="flex items-center gap-1.5 text-2xs text-clay-700">
      <WifiOff aria-hidden className="size-3" />
      Reconnecting. Messages you send still go through.
    </p>
  );
}
