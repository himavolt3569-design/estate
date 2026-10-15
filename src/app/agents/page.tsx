'use client';

import Link from 'next/link';
import { BadgeCheck, MapPin, UserRound } from 'lucide-react';
import { Badge, Input, Surface } from '@/components/ui/primitives';
import { useSignedInText } from '@/components/merokotha/signed-in-copy';
import { useDocs } from '@/lib/firebase/hooks';
import type { PublicAgent } from '@/lib/firebase/types';
import { useState } from 'react';
import { useAuth } from '@/components/merokotha/auth-provider';

export default function AgentsPage() {
  const tr = useSignedInText();
  const { user } = useAuth();
  const agents = useDocs<PublicAgent>('agentsPublic');
  const [search, setSearch] = useState('');
  const visible = agents.items.filter(agent => `${agent.name} ${agent.location || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6"><div><p className="label text-crimson-700">{tr('People you can meet')}</p><h1 className="mt-2 text-3xl font-semibold">{tr('Verified agents')}</h1><p className="mt-2 max-w-2xl text-sm text-ink-500">{tr('These agents were approved to post rentals for property owners. Contact options are shown on each rental listing.')}</p></div><Input aria-label="Search agents" value={search} onChange={event => setSearch(event.target.value)} placeholder={tr('Search agent or area')} className="max-w-md" />{agents.error && <Surface role="alert" className="p-4 text-sm text-clay-700">Could not load agents: {agents.error}</Surface>}{agents.loading && <p className="text-sm text-ink-500">Loading agents…</p>}{!agents.loading && visible.length === 0 && !agents.error && <p className="text-sm text-ink-500">{tr('No agents match this search yet.')}</p>}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(agent => <Link key={agent.id} href={`/agents/${agent.id}`}><Surface className="h-full p-5 transition-shadow hover:shadow-md"><div className="flex items-start gap-4"><div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-royal-50 text-royal-700">{user && agent.photoUrl ? <img src={agent.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound aria-hidden className="size-8" />}</div><div className="min-w-0"><h2 className="font-semibold">{agent.name}</h2><Badge tone="verified" className="mt-1"><BadgeCheck aria-hidden className="size-3" /> {tr('Verified agent')}</Badge>{agent.location && <p className="mt-2 flex items-center gap-1 text-sm text-ink-500"><MapPin aria-hidden className="size-4" />{agent.location}</p>}</div></div>{agent.bio && <p className="mt-4 line-clamp-3 text-sm text-ink-600">{agent.bio}</p>}</Surface></Link>)}</div></div>;
}
