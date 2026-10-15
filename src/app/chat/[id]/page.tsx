'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { collection, doc, increment, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Surface } from '@/components/ui/primitives';
import { useAuth } from '@/components/merokotha/auth-provider';
import { useSignedInText } from '@/components/merokotha/signed-in-copy';
import { configured, db, storage } from '@/lib/firebase/client';
import type { Chat, RecordDoc } from '@/lib/firebase/types';

type Message = RecordDoc & { senderId: string; text: string; imageUrl?: string; isRead: boolean };
export default function ChatPage() {
  const tr = useSignedInText();
  const { id } = useParams<{id:string}>(); const { user, profile } = useAuth();
  const [chat,setChat] = useState<Chat|null>(null); const [messages,setMessages] = useState<Message[]>([]);
  const [text,setText] = useState(''); const [file,setFile] = useState<File|null>(null); const [busy,setBusy] = useState(false);
  useEffect(() => {
    if (!configured || !id || !user) return;
    const stopChat = onSnapshot(doc(db(),'chats',id), s => setChat(s.exists() ? {id:s.id,...s.data()} as Chat : null),e => toast.error(e.message));
    const stopMessages = onSnapshot(query(collection(db(),'chats',id,'messages'),orderBy('createdAt','asc')),s => setMessages(s.docs.map(d => ({id:d.id,...d.data()}) as Message)),e => toast.error(e.message));
    return () => {stopChat();stopMessages();};
  },[id,user]);
  useEffect(() => {
    if (!chat || !user || (chat.ownerId !== user.uid && chat.customerId !== user.uid)) return;
    const ownCounter = chat.ownerId === user.uid ? 'unreadOwner' : 'unreadCustomer';
    if (chat[ownCounter]) void updateDoc(doc(db(),'chats',id),{[ownCounter]:0}).catch(() => {});
    const unread=messages.filter(m => m.senderId !== user.uid && !m.isRead).slice(0,300);
    if (unread.length) { const batch=writeBatch(db()); unread.forEach(m => batch.update(doc(db(),'chats',id,'messages',m.id),{isRead:true})); void batch.commit().catch(() => {}); }
  },[chat,messages,user,id]);
  if (!user || !profile) return <Surface className="p-8">Sign in and complete your profile to use chat.</Surface>;
  if (!chat) return <Surface className="p-8">{tr('This chat is unavailable.')}</Surface>;
  if (chat.ownerId !== user.uid && chat.customerId !== user.uid) return <Surface className="p-8">{tr('You cannot access this conversation.')}</Surface>;
  return <div className="mx-auto max-w-3xl space-y-5"><Link href="/dashboard?tab=chats" className="text-sm text-royal-700">← Back to chats</Link><Surface className="p-5"><h1 className="text-xl font-semibold">{chat.listingTitle}</h1><p className="text-sm text-ink-500">{tr('Talking with')} {chat.ownerId === user.uid ? chat.customerName : chat.ownerName}</p></Surface><Surface className="flex min-h-96 flex-col gap-3 p-5">{messages.map(message => <div key={message.id} className={`max-w-[80%] rounded-xl p-3 text-sm ${message.senderId === user.uid ? 'ml-auto bg-royal-700 text-white' : 'bg-ink-100 text-ink-900'}`}>{message.imageUrl && <img src={message.imageUrl} alt={tr('Chat attachment')} className="mb-2 max-h-72 rounded-lg object-contain" />}{message.text && <p>{message.text}</p>}{message.senderId === user.uid && <span className="mt-1 block text-right text-xs opacity-70">{message.isRead ? 'Read' : 'Sent'}</span>}</div>)}</Surface><form className="flex flex-wrap gap-2" onSubmit={async e => {e.preventDefault(); if(busy || (!text.trim() && !file)) return; setBusy(true); try {if(file && (!file.type.startsWith('image/') || file.size>=5*1024*1024)) throw new Error('Chat image must be under 5 MB.'); let imageUrl:string|null=null; if(file){const item=ref(storage(),`chats/${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`);await uploadBytes(item,file,{contentType:file.type,customMetadata:{uploadedBy:user.uid}});imageUrl=await getDownloadURL(item);}const batch=writeBatch(db());const target=doc(collection(db(),'chats',id,'messages'));batch.set(target,{senderId:user.uid,text:text.trim(),imageUrl,isRead:false,createdAt:serverTimestamp()});batch.update(doc(db(),'chats',id),{lastMessage:text.trim() || 'Photo',lastMessageAt:serverTimestamp(),lastMessageSenderId:user.uid,[chat.ownerId === user.uid ? 'unreadCustomer' : 'unreadOwner']:increment(1)});await batch.commit();setText('');setFile(null);}catch(error){toast.error(error instanceof Error ? error.message : 'Could not send');}finally{setBusy(false);}}}><Input className="min-w-48 flex-1" aria-label={tr('Message')} placeholder={tr('Write a message')} value={text} maxLength={1000} onChange={e => setText(e.target.value)} /><Input className="max-w-52" aria-label={tr('Attach image')} type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} /><Button disabled={busy || profile.isBanned}>{tr('Send')}</Button></form></div>;
}
