'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowUpRight, BadgeCheck, MapPin, Phone, UserRound } from 'lucide-react';
import { configured, db } from '@/lib/firebase/client';
import { whatsAppNumber } from '@/lib/contact';
import { useSiteLanguage } from './site-language';
import { useAuth } from './auth-provider';
import { publicListerRecord, type PublicLister } from '@/lib/public-lister';

export function usePublicLister(id?: string | null) {
  const { user, loading: authLoading } = useAuth();
  const viewer = user?.uid || '';
  const [state, setState] = useState<{ key: string; person: PublicLister | null; loading: boolean; unavailable: boolean; error: boolean }>({ key: '', person: null, loading: Boolean(id), unavailable: false, error: false });
  const key = `${id || ''}:${viewer}`;
  useEffect(() => {
    let current = true;
    let directory: Record<string, unknown> | null | undefined;
    let shared: Record<string, unknown> | null | undefined = viewer ? undefined : null;
    let failed = false;
    const publish = () => {
      if (!current) return;
      const unavailable = Boolean(directory && directory.status && directory.status !== 'active');
      const record = unavailable ? null : directory || shared;
      setState({ key, person: record && id ? publicListerRecord(id, record, Boolean(directory)) : null, loading: directory === undefined || !directory && shared === undefined, unavailable, error: failed });
    };
    if (!id || !configured) { setState({ key, person: null, loading: false, unavailable: false, error: false }); return; }
    setState({ key, person: null, loading: true, unavailable: false, error: false });
    const stopDirectory = onSnapshot(doc(db(), 'agentsPublic', id), snapshot => { directory = snapshot.exists() ? snapshot.data() : null; publish(); }, () => { directory = null; failed = true; publish(); });
    // Existing rules allow display projections to signed-in visitors. Never
    // read the private users collection or broaden its permissions.
    const stopShared = viewer ? onSnapshot(doc(db(), 'usersPublic', id), snapshot => { shared = snapshot.exists() ? snapshot.data() : null; publish(); }, () => { shared = null; failed = true; publish(); }) : () => {};
    return () => { current = false; stopDirectory(); stopShared(); };
  }, [id, key, viewer]);
  return state.key === key ? { ...state, loading: state.loading || Boolean(id && authLoading) } : { person: null, loading: Boolean(id), unavailable: false, error: false };
}

export function AgentSummary({ agent, loading, fallbackName, profileId, listingId }: { agent: PublicLister | null; loading?: boolean; fallbackName: string; profileId?: string | null; listingId?: string }) {
  const { ui, locale } = useSiteLanguage();
  const [failedPhoto, setFailedPhoto] = useState('');
  const name = agent?.hideDisplayName ? ui.privateLister : agent?.name || fallbackName;
  const href = profileId ? `/profile/${encodeURIComponent(profileId)}${listingId ? `?listing=${encodeURIComponent(listingId)}` : ''}` : null;
  return <div className="agent-summary">
    <p className="text-sm text-ink-600">{ui.listedBy}</p>
    {href ? <Link href={href} aria-label={locale === 'ne' ? `${name} को प्रोफाइल हेर्नुहोस्` : `View ${name}'s profile`} className="mt-3 flex min-h-14 items-center gap-3 rounded-xl hover:bg-royal-50">
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-royal-50 text-royal-700">{agent?.photoUrl && failedPhoto !== agent.photoUrl ? <img src={agent.photoUrl} alt="" className="h-full w-full object-cover" onError={() => setFailedPhoto(agent.photoUrl || '')} /> : <UserRound aria-hidden className="size-6" />}</div>
      <div className="min-w-0 flex-1"><p className="break-words font-semibold text-royal-800">{name}</p>{agent?.verifiedAgent && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-800"><BadgeCheck aria-hidden className="size-4 shrink-0" />{locale === 'ne' ? 'प्रमाणित एजेन्ट' : 'Verified agent'}</p>}{loading && <p role="status" className="mt-1 text-xs text-ink-500">{locale === 'ne' ? 'प्रोफाइल लोड हुँदैछ…' : 'Loading profile…'}</p>}</div>
      <ArrowUpRight aria-hidden className="mr-2 size-4 shrink-0 text-royal-700" />
    </Link> : <div className="mt-3 flex items-center gap-3">
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-royal-50 text-royal-700">{agent?.photoUrl && failedPhoto !== agent.photoUrl ? <img src={agent.photoUrl} alt={name} className="h-full w-full object-cover" onError={() => setFailedPhoto(agent.photoUrl || '')} /> : <UserRound aria-hidden className="size-6" />}</div>
      <div className="min-w-0"><p className="break-words font-semibold text-ink-900">{name}</p></div>
    </div>}
    {agent?.location && <p className="mt-3 flex items-start gap-1.5 text-sm text-ink-600"><MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />{agent.location}</p>}
    {agent?.bio && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-ink-700">{agent.bio}</p>}
    {agent?.publicPhone && <a href={`tel:${agent.publicPhone.replace(/[^+\d]/g, '')}`} className="mt-3 flex min-h-11 items-center gap-2 break-all text-sm font-semibold text-royal-800"><Phone aria-hidden className="size-4 shrink-0" />{agent.publicPhone}</a>}
    {agent?.whatsappNumber && <a href={`https://wa.me/${whatsAppNumber(agent.whatsappNumber)}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-royal-800">WhatsApp: {agent.whatsappNumber}</a>}
    {href && <Link href={href} className="mt-3 flex min-h-11 items-center justify-between gap-2 rounded-lg bg-royal-50 px-3 text-sm font-semibold text-royal-800 hover:bg-royal-100">{locale === 'ne' ? 'पूरा प्रोफाइल हेर्नुहोस्' : 'View complete profile'}<ArrowUpRight aria-hidden className="size-4 shrink-0" /></Link>}
  </div>;
}
