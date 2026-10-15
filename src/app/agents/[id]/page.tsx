'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { BadgeCheck, MapPin, UserRound } from 'lucide-react';
import { Badge, Surface } from '@/components/ui/primitives';
import { useSignedInText } from '@/components/merokotha/signed-in-copy';
import { ListingCard } from '@/components/merokotha/listing-card';
import { useAuth } from '@/components/merokotha/auth-provider';
import { configured, db } from '@/lib/firebase/client';
import { useDocs } from '@/lib/firebase/hooks';
import type { Listing, PublicAgent } from '@/lib/firebase/types';

export default function AgentProfilePage() {
  const tr = useSignedInText();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const listings = useDocs<Listing>('listings', 'status', 'active');
  useEffect(() => {
    if (!configured || !id) { setLoading(false); return; }
    return onSnapshot(doc(db(), 'agentsPublic', id), snapshot => { setAgent(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as PublicAgent : null); setLoading(false); }, () => setLoading(false));
  }, [id]);
  if (loading) return <Surface className="p-8 text-sm text-ink-500">Loading agent…</Surface>;
  if (!agent) return <Surface className="p-8"><h1 className="text-xl font-semibold">{tr('Agent unavailable')}</h1><Link href="/agents" className="mt-3 inline-block text-sm text-royal-700">{tr('Browse agents')}</Link></Surface>;
  const rentals = listings.items.filter(item => item.agentId === id);
  return <div className="space-y-8"><Link href="/agents" className="text-sm text-royal-700">← {tr('All agents')}</Link><Surface className="flex flex-wrap gap-5 p-6"><div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-royal-50 text-royal-700">{user && agent.photoUrl ? <img src={agent.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound aria-hidden className="size-10" />}</div><div><Badge tone="verified"><BadgeCheck aria-hidden className="size-3" /> {tr('Verified agent')}</Badge><h1 className="mt-2 text-3xl font-semibold">{agent.name}</h1>{agent.location && <p className="mt-2 flex items-center gap-1 text-sm text-ink-500"><MapPin aria-hidden className="size-4" />{agent.location}</p>}{agent.bio && <p className="mt-4 max-w-2xl whitespace-pre-line text-sm text-ink-700">{agent.bio}</p>}</div></Surface><section><h2 className="text-2xl font-semibold">{tr('Active rentals from this agent')}</h2>{rentals.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rentals.map(item => <ListingCard key={item.id} listing={item} />)}</div> : <p className="mt-4 text-sm text-ink-500">{tr('No active rentals right now.')}</p>}</section></div>;
}
