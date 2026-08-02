'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { authedAction } from '@/lib/auth/action';

/**
 * Message writes.
 *
 * Opening a conversation goes through start_property_conversation() rather than
 * inserting rows here, because adding the *owner* to the thread is something no
 * client-side policy allows: "participants: join" deliberately only lets a
 * caller add themselves, or anyone could pull a stranger into a thread. The
 * function is the one audited place where both participants are written.
 */

export const startConversation = authedAction({
  schema: z.object({ propertyId: z.string().uuid() }),
  handler: async ({ input, supabase }) => {
    const { data, error } = await supabase.rpc('start_property_conversation', {
      p_property_id: input.propertyId,
    });

    if (error) throw error;

    revalidatePath('/dashboard/messages');
    return { threadId: data as unknown as string };
  },
});

export const sendMessage = authedAction({
  schema: z.object({
    threadId: z.string().uuid(),
    body: z
      .string()
      .trim()
      .min(1, 'Write a message first')
      .max(4000, 'That message is too long'),
  }),
  handler: async ({ input, supabase, user }) => {
    // The insert policy re-checks participation, so a forged thread id here is
    // rejected by the database rather than by this line.
    const { data, error } = await supabase
      .from('messages')
      .insert({ thread_id: input.threadId, sender_id: user.id, body: input.body })
      .select('id, body, sender_id, created_at')
      .single();

    if (error) throw error;

    revalidatePath('/dashboard/messages');
    revalidatePath(`/dashboard/messages/${input.threadId}`);

    return {
      id: data.id,
      body: data.body,
      senderId: data.sender_id,
      createdAt: data.created_at,
    };
  },
});

export const markThreadRead = authedAction({
  schema: z.object({ threadId: z.string().uuid() }),
  handler: async ({ input, supabase }) => {
    const { error } = await supabase.rpc('mark_thread_read', { p_thread_id: input.threadId });
    if (error) throw error;

    revalidatePath('/dashboard/messages');
    return { read: true };
  },
});
