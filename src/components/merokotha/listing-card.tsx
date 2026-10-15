'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, MapPin, Layers3, Wallet } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/primitives';
import { toggleFavorite } from '@/lib/firebase/actions';
import { db } from '@/lib/firebase/client';
import type { Listing } from '@/lib/firebase/types';
import { useAuth } from './auth-provider';
import { useSiteLanguage } from './site-language';

export const money = (value: number) => `Rs. ${new Intl.NumberFormat('en-NP').format(value)}`;

export function ListingCard({ listing }: { listing: Listing }) {
  const { ui } = useSiteLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setSaved(false); return; }
    let current = true;
    void getDoc(doc(db(), 'users', user.uid, 'favourites', listing.id))
      .then(snapshot => { if (current) setSaved(snapshot.exists()); })
      .catch(() => {});
    return () => { current = false; };
  }, [user, listing.id]);

  const onSave = async () => {
    if (!user) { router.push(`/sign-in?next=${encodeURIComponent('/')}`); return; }
    if (saving) return;
    setSaving(true);
    try {
      await toggleFavorite(user.uid, listing.id, saved);
      setSaved(!saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this rental');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="listing-card-media relative w-full overflow-hidden bg-ink-100">
        {listing.photoUrls?.[0] ? (
          <img src={listing.photoUrls[0]} alt={listing.title} className="h-full w-full object-cover transition-transform duration-[600ms] group-hover:scale-[1.04]" />
        ) : <div className="flex h-full items-center justify-center text-sm text-ink-400">{ui.noPhoto}</div>}
        <span className="absolute left-3 top-3 z-10 rounded bg-royal-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">{ui.listingLabel}</span>
        <button type="button" aria-label={`${saved ? ui.removeSave : ui.save}: ${listing.title}`} aria-pressed={saved} disabled={saving} onClick={() => void onSave()} className={`absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:text-crimson-600 ${saved ? 'text-crimson-600' : 'text-ink-600'}`}>
          <Heart aria-hidden className={`size-4.5 ${saved ? 'fill-current' : ''}`} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {listing.verificationStatus === 'verified' && <Badge tone="verified">{ui.verified}</Badge>}
          {listing.agentId && <Badge tone="royal">{ui.agent}</Badge>}
          <span className="text-xs font-medium capitalize text-ink-400">{listing.roomType || 'Rental'}</span>
        </div>
        <h3 className="line-clamp-1 text-base font-bold text-ink-900 group-hover:text-royal-700 sm:text-lg">
          <Link href={`/listing/${listing.id}`} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-royal-700">{listing.title}</Link>
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500"><MapPin aria-hidden className="size-4 shrink-0" /><span className="truncate">{listing.address || 'See rental details'}</span></p>
        <p className="mt-3 text-lg font-bold text-royal-600 sm:text-xl">{money(listing.rentPerMonth)} <span className="text-sm font-normal text-ink-500">{ui.month}</span></p>
        <div className="mt-auto flex flex-wrap items-center gap-4 border-t border-ink-100 pt-4 text-sm text-ink-600">
          {listing.floor != null && <span className="flex items-center gap-1.5"><Layers3 aria-hidden className="size-4 text-ink-400" /><span className="font-medium text-ink-900">{listing.floor}</span> {ui.floor}</span>}
          {listing.depositAmount != null && <span className="flex items-center gap-1.5"><Wallet aria-hidden className="size-4 text-ink-400" /><span className="font-medium text-ink-900">{money(listing.depositAmount)}</span> {ui.deposit}</span>}
          {listing.floor == null && listing.depositAmount == null && <span className="capitalize">{listing.furnishing || listing.roomType || 'Rental home'}</span>}
        </div>
      </div>
    </article>
  );
}
