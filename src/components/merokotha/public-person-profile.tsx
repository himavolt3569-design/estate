'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { BadgeCheck, MapPin, Phone, UserRound } from 'lucide-react';
import { Badge, Surface } from '@/components/ui/primitives';
import { useSignedInText } from '@/components/merokotha/signed-in-copy';
import { ListingCard } from '@/components/merokotha/listing-card';
import { usePublicLister } from '@/components/merokotha/agent-summary';
import { useAuth } from '@/components/merokotha/auth-provider';
import { listingListerName, listingsForPerson } from '@/lib/public-lister';
import { DetailAd } from '@/components/merokotha/detail-ad';
import { useSiteLanguage } from '@/components/merokotha/site-language';
import { whatsAppNumber } from '@/lib/contact';
import { useDocs } from '@/lib/firebase/hooks';
import type { Listing } from '@/lib/firebase/types';

export function PublicPersonProfile() {
  const tr = useSignedInText();
  const { locale, ui } = useSiteLanguage();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { person: agent, loading, unavailable, error } = usePublicLister(id);
  const [failedPhoto, setFailedPhoto] = useState('');
  const listings = useDocs<Listing>('listings', 'status', 'active');
  const rentals = listingsForPerson(listings.items, id);
  const fallbackName = rentals.map(listing => listingListerName(listing, id)).find(Boolean);
  if (loading || !agent && listings.loading) return <Surface role="status" className="p-8 text-sm text-ink-500">{locale === 'ne' ? 'प्रोफाइल लोड हुँदैछ…' : 'Loading profile…'}</Surface>;
  if (unavailable || !agent && !rentals.length) return <Surface className="p-8"><h1 className="text-xl font-semibold">{locale === 'ne' ? 'प्रोफाइल उपलब्ध छैन' : 'Profile unavailable'}</h1>{error && <p role="alert" className="mt-2 text-sm text-ink-600">{locale === 'ne' ? 'प्रोफाइल लोड भएन। फेरि प्रयास गर्नुहोस्।' : 'This profile could not be loaded. Please try again.'}</p>}<Link href="/" className="mt-3 inline-block text-sm text-royal-700">{ui.browse}</Link></Surface>;
  const name = agent?.hideDisplayName ? ui.privateLister : agent?.name || fallbackName || (locale === 'ne' ? 'विज्ञापनदाता' : 'Property lister');
  const verified = agent?.verifiedAgent === true;
  const profileLabel = verified ? tr('Verified agent') : (locale === 'ne' ? 'विज्ञापनदाता' : 'Property lister');
  return <div className="space-y-8">
    <Link href={verified ? '/agents' : '/'} className="text-sm text-royal-700">{verified ? (locale === 'ne' ? 'सबै एजेन्टहरू' : 'All agents') : ui.browse}</Link>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Surface className="min-w-0 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-royal-50 text-royal-700">{agent?.photoUrl && failedPhoto !== agent.photoUrl ? <img src={agent.photoUrl} alt={name} className="h-full w-full object-cover" onError={() => setFailedPhoto(agent.photoUrl || '')} /> : <UserRound aria-hidden className="size-10" />}</div>
          <div className="min-w-0"><Badge tone={verified ? 'verified' : 'royal'}>{verified && <BadgeCheck aria-hidden className="size-3" />} {profileLabel}</Badge><h1 className="mt-2 break-words text-3xl font-semibold">{name}</h1>{agent?.location && <p className="mt-2 flex items-start gap-1 text-sm text-ink-600"><MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />{agent.location}</p>}</div>
        </div>
        {agent?.bio && <div className="mt-6"><h2 className="text-lg font-semibold">{locale === 'ne' ? 'परिचय' : verified ? 'About the agent' : 'About this person'}</h2><p className="mt-3 max-w-2xl whitespace-pre-line break-words text-sm leading-relaxed text-ink-700">{agent.bio}</p></div>}
        {!agent && !user && <p className="mt-5 text-sm leading-relaxed text-ink-600">{locale === 'ne' ? 'यस व्यक्तिले साझा गरेका थप विवरण हेर्न साइन इन गर्नुहोस्।' : 'Sign in to view any additional profile details this person has shared.'}<Link href={`/sign-in?next=${encodeURIComponent(`/profile/${id}`)}`} className="ml-2 inline-flex min-h-11 items-center font-semibold text-royal-700 underline underline-offset-4">{ui.signIn}</Link></p>}
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t border-ink-100 pt-5 text-sm">{verified && <div><dt className="text-ink-600">{locale === 'ne' ? 'प्रमाणिकरण' : 'Verification'}</dt><dd className="mt-1 font-semibold text-emerald-800">{profileLabel}</dd></div>}<div><dt className="text-ink-600">{locale === 'ne' ? 'सक्रिय घरजग्गा' : 'Active properties'}</dt><dd className="mt-1 font-semibold tabular-nums">{listings.loading || listings.error ? '…' : rentals.length}</dd></div></dl>
        {(agent?.publicPhone || agent?.whatsappNumber) && <div className="mt-6 flex flex-wrap gap-3">
          {agent.publicPhone && <a href={`tel:${agent.publicPhone.replace(/[^+\d]/g, '')}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-royal-700 px-4 text-sm font-semibold text-white hover:bg-royal-800"><Phone aria-hidden className="size-4" />{agent.publicPhone}</a>}
          {agent.whatsappNumber && <a href={`https://wa.me/${whatsAppNumber(agent.whatsappNumber)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-royal-50 px-4 text-sm font-semibold text-royal-800 hover:bg-royal-100">WhatsApp: {agent.whatsappNumber}</a>}
        </div>}
      </Surface>
      <DetailAd key={id} slot="agent" dismissKey={id} />
    </div>
    <section><h2 className="text-2xl font-semibold">{locale === 'ne' ? 'यस व्यक्तिका सक्रिय घरजग्गा' : verified ? 'Properties from this agent' : 'Properties from this person'}</h2>{listings.loading ? <p role="status" className="mt-4 text-sm text-ink-600">{locale === 'ne' ? 'लोड हुँदैछ…' : 'Loading properties…'}</p> : listings.error ? <p role="alert" className="mt-4 text-sm text-clay-700">{locale === 'ne' ? 'घरजग्गा लोड भएन। फेरि प्रयास गर्नुहोस्।' : 'Properties could not be loaded. Please try again.'}</p> : rentals.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rentals.map(item => <ListingCard key={item.id} listing={item} />)}</div> : <p className="mt-4 text-sm text-ink-600">{locale === 'ne' ? 'अहिले कुनै सक्रिय घरजग्गा छैन।' : 'No active properties right now.'}</p>}</section>
  </div>;
}
