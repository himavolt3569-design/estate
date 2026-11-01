'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { Check, Copy, ImagePlus, Megaphone, MousePointerClick, Eye, Settings2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Surface, Textarea } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/select-menu';
import { uploadImages } from '@/lib/firebase/actions';
import { db } from '@/lib/firebase/client';
import { useDocs } from '@/lib/firebase/hooks';
import { campaignState, normalizeAdSettings, partnerAds, partnerArtwork, sponsorHref, type AdSettings, type SponsorAd } from '@/lib/ads';
import type { Listing } from '@/lib/firebase/types';
import { listingCampaign } from '@/lib/sponsored-listings';
import { SponsoredListingPicker } from './sponsored-listing-picker';
import { timestampMillis } from '@/lib/listing-search';
import { SponsorCard } from './sponsor-card';
import { useCampaigns } from './ad-provider';
import { useAuth } from './auth-provider';

const placements = [ { value: 'all', label: 'Every placement' }, { value: 'landing', label: 'Homepage banner' }, { value: 'home', label: 'Between listings' }, { value: 'details', label: 'Property description' } ];
const devices = [ { value: 'all', label: 'All devices' }, { value: 'mobile', label: 'Mobile only' }, { value: 'desktop', label: 'Desktop only' } ];
const localDate = (value: unknown) => {
  const millis = timestampMillis(value);
  if (!millis) return '';
  const date = new Date(millis);
  return new Date(millis - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
type Editor = { id: string; title: string; subtitle: string; sponsorName: string; externalUrl: string; listingId: string; placement: string; device: 'all' | 'mobile' | 'desktop'; linkType: string; status: string; ctaLabel: string; priority: number; starts: string; ends: string; imageUrls: string[]; mobileImageUrl: string };
const fresh = (): Editor => ({ id: '', title: '', subtitle: '', sponsorName: '', externalUrl: '', listingId: '', placement: 'all', device: 'all', linkType: 'external', status: 'active', ctaLabel: 'Visit website', priority: 0, starts: '', ends: '', imageUrls: [], mobileImageUrl: '' });

export function AdminAds() {
  const { profile } = useAuth();
  const { ads, settings, error } = useCampaigns('landing');
  const { items: stats, error: statsError } = useDocs<{ id: string; adId: string; impressions?: number; clicks?: number }>(profile?.role === 'superAdmin' ? 'adStats' : '');
  const { items: listings, loading: listingsLoading, error: listingsError } = useDocs<Listing>(profile?.role === 'superAdmin' ? 'listings' : '', 'status', 'active');
  const [editor, setEditor] = useState<Editor>(fresh);
  const [files, setFiles] = useState<File[]>([]);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [mobilePreview, setMobilePreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [draft, setDraft] = useState<AdSettings>(settings);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file)); setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  useEffect(() => { if (!mobileFile) { setMobilePreview(''); return; } const url = URL.createObjectURL(mobileFile); setMobilePreview(url); return () => URL.revokeObjectURL(url); }, [mobileFile]);
  const field = <K extends keyof Editor>(key: K, value: Editor[K]) => setEditor(current => ({ ...current, [key]: value }));
  const reset = () => { setEditor(fresh()); setFiles([]); setMobileFile(null); setPreviewIndex(0); };
  const edit = (ad: SponsorAd, duplicate = false) => {
    const existingImages = ad.imageUrls?.length ? ad.imageUrls : ad.imageUrl ? [ad.imageUrl] : [];
    const imageUrls = duplicate ? existingImages : existingImages.filter(url => url !== partnerArtwork[ad.id] && !(ad.id === 'partner-himavolt' && url === '/images/partners/himavolt.png'));
    setEditor({ ...fresh(), id: duplicate ? '' : ad.id, title: `${ad.title || ''}${duplicate ? ' (copy)' : ''}`, subtitle: ad.subtitle || '', sponsorName: ad.sponsorName || '', externalUrl: ad.externalUrl || '', listingId: ad.listingId || '', placement: ad.placement === 'listings' ? 'home' : ad.placement || 'all', device: ad.device || 'all', linkType: ad.linkType || 'external', status: duplicate ? 'paused' : ad.status || 'paused', ctaLabel: ad.ctaLabel || 'Visit website', priority: Number(ad.priority || 0), starts: localDate(ad.startsAt), ends: localDate(ad.endsAt), imageUrls, mobileImageUrl: ad.mobileImageUrl || '' });
    setFiles([]); setMobileFile(null); setPreviewIndex(0);
    document.getElementById('sponsor-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true);
    try {
      const start = editor.starts ? new Date(editor.starts) : null;
      const end = editor.ends ? new Date(editor.ends) : null;
      if (start && end && end <= start) throw new Error('The end date must be after the start date.');
      let ad: SponsorAd = { ...editor, id: editor.id || (editor.linkType === 'listing' ? `listing-${editor.listingId}` : crypto.randomUUID()) };
      if (!sponsorHref(ad)) throw new Error('Enter a valid website URL or an active listing ID.');
      if (editor.linkType === 'listing') {
        const listing = await getDoc(doc(db(), 'listings', editor.listingId.trim()));
        if (!listing.exists() || listing.data().status !== 'active') throw new Error('Choose an active listing.');
        ad = listingCampaign(ad, { ...listing.data(), id: listing.id } as Listing);
      }
      for (const file of [...files, ...(mobileFile ? [mobileFile] : [])]) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Use JPG, PNG, WebP or GIF images under 5 MB each.');
      }
      if (files.length + editor.imageUrls.length > 8) throw new Error('Use up to eight sliding images per campaign.');
      const uploaded = files.length ? await uploadImages('ads', files) : [];
      const imageUrls = editor.linkType === 'listing' ? ad.imageUrls || [] : [...editor.imageUrls, ...uploaded];
      const mobileImageUrl = mobileFile ? (await uploadImages('ads', [mobileFile]))[0] : editor.mobileImageUrl;
      const data = { title: String(ad.title || '').trim(), subtitle: String(ad.subtitle || '').trim(), sponsorName: String(ad.sponsorName || '').trim(), placement: editor.placement, device: editor.device, linkType: editor.linkType, status: editor.status, ctaLabel: String(ad.ctaLabel || '').trim(), priority: editor.priority, externalUrl: editor.linkType === 'external' ? editor.externalUrl.trim() : null, listingId: editor.linkType === 'listing' ? editor.listingId.trim() : null, imageUrl: imageUrls[0] || '', imageUrls, mobileImageUrl: editor.linkType === 'listing' ? '' : mobileImageUrl || '', startsAt: start ? Timestamp.fromDate(start) : null, endsAt: end ? Timestamp.fromDate(end) : null, updatedAt: serverTimestamp() };
      await setDoc(doc(db(), 'ads', ad.id), { ...data, ...(!editor.id ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
      toast.success('Campaign saved. Changes sync across devices.'); reset();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save campaign.'); }
    finally { setBusy(false); }
  };
  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault(); setSettingsBusy(true);
    try { await setDoc(doc(db(), 'adSettings', 'public'), { ...normalizeAdSettings(draft), updatedAt: serverTimestamp() }); toast.success('Ad settings saved'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save settings'); }
    finally { setSettingsBusy(false); }
  };
  if (profile?.role !== 'superAdmin') return null;
  const totals = stats.reduce((total, row) => ({ impressions: total.impressions + Number(row.impressions || 0), clicks: total.clicks + Number(row.clicks || 0) }), { impressions: 0, clicks: 0 });
  const selectedListing = listings.find(listing => listing.id === editor.listingId);
  const images = editor.linkType === 'listing' ? selectedListing?.photoUrls?.slice(0, 1) || [] : [...editor.imageUrls, ...previews];
  const basePreview: SponsorAd = { ...editor, id: editor.id || 'preview', title: editor.title || 'Your next campaign starts here', subtitle: editor.subtitle || 'Add a headline, your images and a destination.', externalUrl: editor.externalUrl || 'https://example.com', imageUrls: previewMobile && (mobilePreview || editor.mobileImageUrl) ? [mobilePreview || editor.mobileImageUrl] : images, imageUrl: images[0], mobileImageUrl: '' };
  const preview = editor.linkType === 'listing' && selectedListing ? listingCampaign(basePreview, selectedListing) : basePreview;
  return <section className="space-y-6" aria-labelledby="sponsors-admin-heading">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h3 id="sponsors-admin-heading" className="flex items-center gap-2 text-2xl font-semibold"><Megaphone aria-hidden className="size-6 text-royal-700" /> Advertising</h3><p className="mt-2 max-w-2xl text-sm text-ink-600">Promote your websites or sponsor a property. Choose where, when and on which devices each ad appears.</p></div><div className="flex gap-5 text-sm"><span><Eye aria-hidden className="mr-1 inline size-4" /><strong className="tabular-nums">{totals.impressions.toLocaleString()}</strong> impressions</span><span><MousePointerClick aria-hidden className="mr-1 inline size-4" /><strong className="tabular-nums">{totals.clicks.toLocaleString()}</strong> clicks</span></div></div>
    {(error || statsError) && <p role="alert" className="rounded-xl bg-clay-50 p-4 text-sm text-clay-700">{error || 'Campaign reporting could not be loaded. Check the Firebase permissions and try again.'}</p>}
    <Surface className="p-5 sm:p-6"><form onSubmit={saveSettings} className="space-y-5"><h4 className="flex items-center gap-2 font-semibold"><Settings2 aria-hidden className="size-4" /> Display settings</h4><p className="text-sm text-ink-600">Each campaign appears once on the homepage. Ads in the top section are not repeated between listings.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{([['enabled', 'Show advertisements'], ['partnerAdsEnabled', 'Include partner presets'], ['heroEnabled', 'Homepage carousel'], ['feedEnabled', 'Between listings'], ['detailsEnabled', 'Property description']] as const).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-royal-700" checked={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}</div><div className="grid items-end gap-4 sm:grid-cols-3"><Field label="Show an ad after" htmlFor="ad-interval"><SelectMenu id="ad-interval" value={String(draft.feedInterval)} onValueChange={value => setDraft(current => ({ ...current, feedInterval: Number(value) }))} options={[3, 4, 5].map(value => ({ value: String(value), label: `${value} listings` }))} /></Field><Field label="Slide duration" htmlFor="ad-duration"><Input id="ad-duration" type="number" min={4} max={15} value={draft.rotationSeconds} onChange={event => setDraft(current => ({ ...current, rotationSeconds: Number(event.target.value) }))} /></Field><Button disabled={settingsBusy} variant="royal">{settingsBusy ? 'Saving…' : 'Save display settings'}</Button></div></form></Surface>
    <div className="flex flex-wrap items-center gap-2"><span className="mr-2 text-sm font-medium">Start with a partner:</span>{partnerAds.map(ad => <Button key={ad.id} size="sm" variant="secondary" onClick={() => edit(ads.find(item => item.id === ad.id) || ad)}>{ad.sponsorName}</Button>)}</div>
    <Surface id="sponsor-editor" className="scroll-mt-24 p-5 sm:p-6"><div className="mb-5 flex items-center justify-between gap-2"><h4 className="text-lg font-semibold">{editor.id ? 'Edit campaign' : 'New campaign'}</h4>{editor.id && <Button type="button" size="sm" variant="ghost" onClick={reset}>Cancel edit</Button>}</div><div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={save} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field label="Campaign type" htmlFor="ad-link" className="sm:col-span-2"><SelectMenu id="ad-link" value={editor.linkType} onValueChange={value => { field('linkType', value); setFiles([]); setMobileFile(null); }} options={[{ value: 'external', label: 'Website advertisement' }, { value: 'listing', label: 'Sponsored property' }]} /></Field>
        {editor.linkType === 'listing' && <SponsoredListingPicker listings={listings} loading={listingsLoading} error={listingsError} value={editor.listingId} onSelect={listing => { const ad = listingCampaign({ ...editor, listingId: listing.id }, listing); setEditor(current => ({ ...current, listingId: listing.id, title: ad.title || '', subtitle: ad.subtitle || '', sponsorName: ad.sponsorName || '', ctaLabel: 'View property', imageUrls: [], mobileImageUrl: '' })); }} />}
        {editor.linkType === 'external' && <>

        <Field label="Brand name" htmlFor="ad-brand"><Input id="ad-brand" maxLength={80} value={editor.sponsorName} onChange={event => field('sponsorName', event.target.value)} /></Field>
        <Field label="Headline" htmlFor="ad-title" required><Input id="ad-title" required maxLength={120} value={editor.title} onChange={event => field('title', event.target.value)} /></Field>
        <Field label="Description" htmlFor="ad-subtitle" className="sm:col-span-2"><Textarea id="ad-subtitle" maxLength={240} value={editor.subtitle} onChange={event => field('subtitle', event.target.value)} className="min-h-20" /></Field>
        </>}
        <Field label="Placement" htmlFor="ad-placement"><SelectMenu id="ad-placement" value={editor.placement} onValueChange={value => field('placement', value)} options={placements} /></Field>
        <Field label="Devices" htmlFor="ad-device"><SelectMenu id="ad-device" value={editor.device} onValueChange={value => field('device', value as Editor['device'])} options={devices} /></Field>
        <Field label="Status" htmlFor="ad-status"><SelectMenu id="ad-status" value={editor.status} onValueChange={value => field('status', value)} options={[{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }]} /></Field>
        {editor.linkType === 'external' && <><Field label="Website URL" htmlFor="ad-url" className="sm:col-span-2" required><Input id="ad-url" type="url" required value={editor.externalUrl} onChange={event => field('externalUrl', event.target.value)} placeholder="https://" /></Field>
        <Field label="Button text" htmlFor="ad-cta"><Input id="ad-cta" maxLength={40} value={editor.ctaLabel} onChange={event => field('ctaLabel', event.target.value)} /></Field></>}
        <Field label="Priority" htmlFor="ad-priority" hint="Higher appears first"><Input id="ad-priority" type="number" value={editor.priority} onChange={event => field('priority', Number(event.target.value))} /></Field>
        <Field label="Starts (your local time)" htmlFor="ad-start"><Input id="ad-start" type="datetime-local" value={editor.starts} onChange={event => field('starts', event.target.value)} /></Field>
        <Field label="Ends (your local time)" htmlFor="ad-end"><Input id="ad-end" type="datetime-local" value={editor.ends} onChange={event => field('ends', event.target.value)} /></Field>
        {editor.linkType === 'external' && <>
        <Field label="Campaign images" htmlFor="ad-images" hint="Up to 8 images; JPG, PNG, WebP or GIF, under 5 MB each. The first image appears on the homepage; extra images rotate on property pages. Your uploads replace the temporary partner artwork. Other ads use a brand card when no image is provided." className="sm:col-span-2"><Input key={`images-${editor.id}-${files.length ? 'selected' : 'empty'}`} id="ad-images" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => setFiles(Array.from(event.target.files || []))} /></Field>
        {editor.imageUrls.length > 0 && <div className="flex flex-wrap gap-2 sm:col-span-2">{editor.imageUrls.map((url, index) => <div key={`${url}-${index}`} className="relative"><img src={url} alt={`Campaign image ${index + 1}`} className="h-16 w-24 rounded-lg object-cover" /><button type="button" className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-white text-ink-800 shadow-sm" aria-label={`Remove image ${index + 1}`} onClick={() => field('imageUrls', editor.imageUrls.filter((_, i) => i !== index))}><X aria-hidden className="size-4" /></button></div>)}</div>}
        <Field label="Optional mobile image" htmlFor="ad-mobile-image" className="sm:col-span-2"><Input id="ad-mobile-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => setMobileFile(event.target.files?.[0] || null)} />{editor.mobileImageUrl && <button type="button" className="mt-2 text-sm text-crimson-700 underline" onClick={() => field('mobileImageUrl', '')}>Remove current mobile image</button>}</Field>
        </>}
        <div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={busy || editor.linkType === 'listing' && !selectedListing}><Check aria-hidden className="size-4" />{busy ? 'Saving campaign…' : 'Save campaign'}</Button><Button type="button" variant="secondary" onClick={reset}>Clear</Button></div>
      </form>
      <div className="min-w-0 self-start xl:sticky xl:top-24"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Live preview</p><button type="button" className="text-xs font-semibold text-royal-700 underline" onClick={() => setPreviewMobile(value => !value)}>{previewMobile ? 'Desktop preview' : 'Mobile preview'}</button></div><div className={previewMobile ? 'mx-auto max-w-[280px]' : ''}><div className="pointer-events-none">{editor.linkType === 'listing' && !selectedListing ? <p className="rounded-xl bg-ink-50 p-5 text-sm leading-relaxed text-ink-600">Choose a property to preview its sponsored ad.</p> : <SponsorCard ad={preview} compact imageIndex={previewIndex} track={false} mobilePreview={previewMobile || editor.linkType === 'listing'} />}</div></div>{images.length > 1 && <div className="mt-2 flex flex-wrap gap-2">{images.map((_, index) => <button key={index} type="button" className="carousel-button text-xs" aria-label={`Preview image ${index + 1}`} aria-pressed={previewIndex === index} onClick={() => setPreviewIndex(index)}>{index + 1}</button>)}</div>}<p className="mt-3 text-xs leading-relaxed text-ink-500">All ads are labeled. Scheduled times sync through Firebase; mobile-only campaigns stay on mobile.</p></div>
    </div></Surface>
    <div className="space-y-3">{[...ads].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)).map(ad => {
      const linkedListing = listings.find(listing => listing.id === ad.listingId);
      const displayed = ad.linkType === 'listing' && linkedListing ? listingCampaign(ad, linkedListing) : ad;
      const state = ad.linkType === 'listing' && !linkedListing && !listingsLoading ? 'Property unavailable' : campaignState(ad);
      const rows = stats.filter(row => row.adId === ad.id);
      const impressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
      const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
      return <Surface key={ad.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-royal-50">{displayed.imageUrl ? <img src={displayed.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImagePlus aria-hidden className="size-6 text-royal-700" />}</div><div className="min-w-0"><p className="break-words font-semibold">{displayed.title}</p><p className="mt-1 text-xs text-ink-600">{placements.find(option => option.value === ad.placement)?.label || ad.placement} · {ad.device || 'all'} · {state}</p><p className="mt-1 text-xs tabular-nums text-ink-500">{impressions} impressions · {clicks} unique clicks · {impressions ? (clicks / impressions * 100).toFixed(1) : '0.0'}% CTR</p></div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => edit(ad)}>Edit</Button><Button size="sm" variant="secondary" onClick={() => edit(ad, true)} aria-label={`Duplicate ${ad.title}`}><Copy aria-hidden className="size-4" />Copy</Button><Button size="sm" variant="secondary" onClick={async () => { try { await setDoc(doc(db(), 'ads', ad.id), { ...ad, status: ad.status === 'active' ? 'paused' : 'active', updatedAt: serverTimestamp() }, { merge: true }); toast.success('Campaign status updated'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update campaign'); } }}>{ad.status === 'active' ? 'Pause' : 'Activate'}</Button></div></Surface>;
    })}</div>
    <p className="text-xs leading-relaxed text-ink-500">Reporting counts visible impressions and unique session clicks, deduplicated within 30 minutes. Totals appear after campaign reporting is enabled on Firebase.</p>
  </section>;
}
