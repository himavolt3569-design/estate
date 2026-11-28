'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Input, Surface } from '@/components/ui/primitives';
import { useAuth } from '@/components/hamrokotha/auth-provider';
import { useSignedInText } from '@/components/hamrokotha/signed-in-copy';
import { adminDeleteChatMessage } from '@/lib/firebase/actions';
import { configured, db, storage } from '@/lib/firebase/client';
import type { Chat, RecordDoc } from '@/lib/firebase/types';

type Message = RecordDoc & {
  senderId: string;
  text: string;
  imageUrl?: string;
  isRead: boolean;
  createdAt?: { toDate?: () => Date };
};

export default function ChatPage() {
  const tr = useSignedInText();
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const isSuperAdmin = profile?.role === 'superAdmin';
  const isParticipant = Boolean(
    chat && user && (chat.ownerId === user.uid || chat.customerId === user.uid),
  );

  useEffect(() => {
    if (!configured || !id || !user) return;
    const stopChat = onSnapshot(
      doc(db(), 'chats', id),
      (s) => setChat(s.exists() ? ({ id: s.id, ...s.data() } as Chat) : null),
      (e) => toast.error(e.message),
    );
    const stopMessages = onSnapshot(
      query(collection(db(), 'chats', id, 'messages'), orderBy('createdAt', 'asc')),
      (s) => setMessages(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Message)),
      (e) => toast.error(e.message),
    );
    return () => {
      stopChat();
      stopMessages();
    };
  }, [id, user]);

  useEffect(() => {
    if (!chat || !user || !isParticipant) return;
    const ownCounter = chat.ownerId === user.uid ? 'unreadOwner' : 'unreadCustomer';
    if (chat[ownCounter]) void updateDoc(doc(db(), 'chats', id), { [ownCounter]: 0 }).catch(() => {});
    const unread = messages.filter((m) => m.senderId !== user.uid && !m.isRead).slice(0, 300);
    if (unread.length) {
      const batch = writeBatch(db());
      unread.forEach((m) => batch.update(doc(db(), 'chats', id, 'messages', m.id), { isRead: true }));
      void batch.commit().catch(() => {});
    }
  }, [chat, messages, user, id, isParticipant]);

  if (!user || !profile) {
    return <Surface className="p-8">Sign in and complete your profile to use chat.</Surface>;
  }
  if (!chat) return <Surface className="p-8">{tr('This chat is unavailable.')}</Surface>;
  if (!isParticipant && !isSuperAdmin) {
    return <Surface className="p-8">{tr('You cannot access this conversation.')}</Surface>;
  }

  const inspectingAsAdmin = isSuperAdmin && !isParticipant;
  const senderLabel = (senderId: string) => {
    if (senderId === chat.ownerId) return `${chat.ownerName || 'Owner'} (Owner / Agent)`;
    if (senderId === chat.customerId) return `${chat.customerName || 'Customer'} (Customer)`;
    return senderId;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={inspectingAsAdmin ? '/dashboard?tab=admin' : '/dashboard?tab=chats'}
          className="text-sm font-medium text-royal-700 hover:underline"
        >
          ← {inspectingAsAdmin ? 'Back to Superadmin Workspace' : 'Back to chats'}
        </Link>
        {chat.listingId && (
          <Link
            href={`/listing/${chat.listingId}`}
            className="text-sm font-medium text-royal-700 hover:underline"
          >
            View property →
          </Link>
        )}
      </div>

      <Surface className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{chat.listingTitle}</h1>
            <p className="mt-1 text-sm text-ink-600">
              {inspectingAsAdmin
                ? `${chat.customerName || 'Customer'} (Customer) ↔ ${chat.ownerName || 'Owner'} (Owner / Agent)`
                : `${tr('Talking with')} ${chat.ownerId === user.uid ? chat.customerName : chat.ownerName}`}
            </p>
          </div>
          {inspectingAsAdmin && <Badge tone="royal">Superadmin View</Badge>}
        </div>
      </Surface>

      <Surface className="flex min-h-96 flex-col gap-3 p-5">
        {messages.length === 0 && (
          <p className="my-auto text-center text-sm text-ink-500">No messages in this thread yet.</p>
        )}
        {messages.map((message) => {
          const isMine = message.senderId === user.uid;
          const isOwnerMessage = message.senderId === chat.ownerId;
          const timeText = message.createdAt?.toDate?.()?.toLocaleString() || '';
          return (
            <div
              key={message.id}
              className={`max-w-[82%] rounded-xl p-3 text-sm ${
                inspectingAsAdmin
                  ? isOwnerMessage
                    ? 'ml-auto border border-royal-200 bg-royal-50 text-ink-900'
                    : 'border border-ink-200 bg-ink-50 text-ink-900'
                  : isMine
                    ? 'ml-auto bg-royal-700 text-white'
                    : 'bg-ink-100 text-ink-900'
              }`}
            >
              {inspectingAsAdmin && (
                <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold text-ink-600">
                  <span>{senderLabel(message.senderId)}</span>
                  <button
                    type="button"
                    aria-label="Delete message"
                    className="inline-flex items-center gap-1 text-clay-700 hover:underline"
                    onClick={() => {
                      if (!window.confirm('Delete this message permanently?')) return;
                      void adminDeleteChatMessage(id, message.id)
                        .then(() => toast.success('Message deleted'))
                        .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not delete'));
                    }}
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                    Delete
                  </button>
                </div>
              )}
              {message.imageUrl && (
                <img
                  src={message.imageUrl}
                  alt={tr('Chat attachment')}
                  className="mb-2 max-h-72 rounded-lg object-contain"
                />
              )}
              {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
              {(isMine || inspectingAsAdmin) && (
                <span className="mt-1 block text-right text-xs opacity-70">
                  {timeText ? `${timeText} · ` : ''}
                  {message.isRead ? 'Read' : 'Sent'}
                </span>
              )}
            </div>
          );
        })}
      </Surface>

      {isParticipant && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || (!text.trim() && !file)) return;
            setBusy(true);
            try {
              if (file && (!file.type.startsWith('image/') || file.size >= 5 * 1024 * 1024)) {
                throw new Error('Chat image must be under 5 MB.');
              }
              let imageUrl: string | null = null;
              if (file) {
                const item = ref(
                  storage(),
                  `chats/${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
                );
                await uploadBytes(item, file, {
                  contentType: file.type,
                  customMetadata: { uploadedBy: user.uid },
                });
                imageUrl = await getDownloadURL(item);
              }
              const batch = writeBatch(db());
              const target = doc(collection(db(), 'chats', id, 'messages'));
              batch.set(target, {
                senderId: user.uid,
                text: text.trim(),
                imageUrl,
                isRead: false,
                createdAt: serverTimestamp(),
              });
              batch.update(doc(db(), 'chats', id), {
                lastMessage: text.trim() || 'Photo',
                lastMessageAt: serverTimestamp(),
                lastMessageSenderId: user.uid,
                [chat.ownerId === user.uid ? 'unreadCustomer' : 'unreadOwner']: increment(1),
              });
              await batch.commit();
              setText('');
              setFile(null);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not send');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Input
            className="min-w-48 flex-1"
            aria-label={tr('Message')}
            placeholder={tr('Write a message')}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
          />
          <Input
            className="max-w-52"
            aria-label={tr('Attach image')}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button disabled={busy || profile.isBanned}>{tr('Send')}</Button>
        </form>
      )}
    </div>
  );
}
