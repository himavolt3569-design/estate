import 'server-only';

import { createClient } from '@/lib/supabase/server';

import type { Conversation, ConversationSummary } from './types';

/**
 * Reads for the inbox and the thread view.
 *
 * Every one of these is a SECURITY DEFINER function that asserts participation
 * itself, rather than a table read that leans on RLS alone. The difference
 * matters for the failure mode: a policy denial returns zero rows, which renders
 * as an empty conversation and reads to the user as data loss. The functions
 * raise, and the caller can say "this conversation is not yours".
 */

export async function listConversations(): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_conversations');

  if (error) {
    console.error('[list_conversations]', error.message);
    return [];
  }

  return (data ?? []) as unknown as ConversationSummary[];
}

export async function getConversation(threadId: string): Promise<Conversation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_conversation', { p_thread_id: threadId });

  if (error || !data) {
    if (error) console.error('[get_conversation]', error.message);
    return null;
  }

  return data as unknown as Conversation;
}

export async function getUnreadMessageCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('unread_message_count');

  if (error) {
    console.error('[unread_message_count]', error.message);
    return 0;
  }

  return (data as unknown as number) ?? 0;
}
