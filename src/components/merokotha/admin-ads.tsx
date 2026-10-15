'use client';

import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ImagePlus, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Surface, Textarea } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/select-menu';
import { uploadImages } from '@/lib/firebase/actions';
import { db } from '@/lib/firebase/client';
import { useDocs } from '@/lib/firebase/hooks';
import { sponsorHref, type SponsorAd } from './sponsor-card';
import { useAuth } from './auth-provider';
import { useSignedInText } from './signed-in-copy';

const placementOptions = [
  { value: 'landing', label: 'Landing sponsor section' },
  { value: 'home', label: 'Available listings section' },
  { value: 'all', label: 'Both sections' },
];
const linkOptions = [
  { value: 'external', label: 'Sponsor website' },
  { value: 'listing', label: 'Property listing' },
  { value: 'none', label: 'No link (paused only)' },
];
const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
];

export function AdminAds() {
  const tr = useSignedInText();
  const { profile } = useAuth();
  const { items, error } = useDocs<SponsorAd>('ads');
  const [editing, setEditing] = useState<SponsorAd | null>(null);
  const [busy, setBusy] = useState(false);
  const [placement, setPlacement] = useState('landing');
  const [linkType, setLinkType] = useState('external');
  const [status, setStatus] = useState('active');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!imageFile) { setPreviewUrl(String(editing?.imageUrl || '')); return; }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile, editing?.imageUrl]);

  const clearEditor = () => {
    setEditing(null);
    setPlacement('landing');
    setLinkType('external');
    setStatus('active');
    setTitle('');
    setSubtitle('');
    setSponsorName('');
    setImageFile(null);
  };

  const startEdit = (ad: SponsorAd) => {
    setEditing(ad);
    setPlacement(ad.placement === 'listings' ? 'home' : ad.placement || 'landing');
    setLinkType(ad.linkType || 'none');
    setStatus(ad.status || 'paused');
    setTitle(ad.title || '');
    setSubtitle(ad.subtitle || '');
    setSponsorName(ad.sponsorName || '');
    setImageFile(null);
    document.getElementById('sponsor-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const externalUrl = String(form.get('externalUrl') || '').trim();
      const listingId = String(form.get('listingId') || '').trim();
      if (!title.trim()) throw new Error('Enter a sponsor title.');
      if (status === 'active' && linkType === 'none') throw new Error('Active sponsors need a destination link.');
      if (linkType === 'external' && !/^https?:\/\//i.test(externalUrl)) throw new Error('Enter a full http or https sponsor URL.');
      if (linkType === 'listing' && !listingId) throw new Error('Enter a listing ID.');
      if (linkType === 'listing') {
        const listing = await getDoc(doc(db(), 'listings', listingId));
        if (!listing.exists() || listing.data().status !== 'active') throw new Error('Choose an active listing ID.');
      }
      if (imageFile && (!imageFile.type.startsWith('image/') || imageFile.size >= 5 * 1024 * 1024)) throw new Error('Sponsor image must be under 5 MB.');
      let imageUrl = String(editing?.imageUrl || '');
      if (imageFile) imageUrl = (await uploadImages('ads', [imageFile]))[0] || '';
      if (!imageUrl) throw new Error('Choose a sponsor image.');

      const data = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        sponsorName: sponsorName.trim(),
        imageUrl,
        placement,
        priority: Number(form.get('priority') || 0),
        linkType,
        externalUrl: linkType === 'external' ? externalUrl : null,
        listingId: linkType === 'listing' ? listingId : null,
        status,
        updatedAt: serverTimestamp(),
      };
      if (editing) await updateDoc(doc(db(), 'ads', editing.id), data);
      else await addDoc(collection(db(), 'ads'), { ...data, createdAt: serverTimestamp() });
      toast.success(editing ? 'Sponsor updated' : 'Sponsor created');
      formElement.reset();
      clearEditor();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save sponsor');
    } finally {
      setBusy(false);
    }
  };

  if (profile?.role !== 'superAdmin') return null;

  return <section className="space-y-5" aria-labelledby="sponsors-admin-heading">
    <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-sand-700"><Megaphone aria-hidden className="size-5" /></span><div><h3 id="sponsors-admin-heading" className="text-xl font-semibold">{tr('Ads & sponsors')}</h3><p className="mt-1 text-sm text-ink-500">{tr('Only superadmins can publish, pause, and place sponsor cards.')}</p></div></div>

    <Surface id="sponsor-editor" className="scroll-mt-24 p-5 sm:p-6">
      <h4 className="text-lg font-semibold">{editing ? tr('Edit sponsor') : tr('Create sponsor')}</h4>
      <p className="mt-1 text-sm text-ink-500">{tr('Active cards appear in the selected landing page section and link to a listing or sponsor website.')}</p>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <form key={editing?.id || 'new'} className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
          <Field label={tr('Sponsor name')} htmlFor="sponsorName"><Input id="sponsorName" name="sponsorName" value={sponsorName} onChange={event => setSponsorName(event.target.value)} placeholder="Company or brand" /></Field>
          <Field label={tr('Title')} htmlFor="adTitle" required><Input id="adTitle" name="title" value={title} onChange={event => setTitle(event.target.value)} required placeholder="Short campaign headline" /></Field>
          <Field label={tr('Subtitle')} htmlFor="adSubtitle" className="sm:col-span-2"><Textarea id="adSubtitle" name="subtitle" value={subtitle} onChange={event => setSubtitle(event.target.value)} className="min-h-20" placeholder="A useful sentence about the offer" /></Field>
          <Field label={tr('Placement')} htmlFor="adPlacement"><SelectMenu id="adPlacement" name="placement" value={placement} onValueChange={setPlacement} options={placementOptions.map(option => ({...option,label:tr(option.label)}))} /></Field>
          <Field label={tr('Priority')} htmlFor="adPriority" hint={tr('Higher appears first')}><Input id="adPriority" name="priority" type="number" defaultValue={Number(editing?.priority || 0)} /></Field>
          <Field label={tr('Link destination')} htmlFor="adLinkType"><SelectMenu id="adLinkType" name="linkType" value={linkType} onValueChange={setLinkType} options={linkOptions.map(option => ({...option,label:tr(option.label)}))} /></Field>
          <Field label={tr('Status')} htmlFor="adStatus"><SelectMenu id="adStatus" name="status" value={status} onValueChange={setStatus} options={statusOptions.map(option => ({...option,label:tr(option.label)}))} /></Field>
          {linkType === 'listing' && <Field label={tr('Listing ID')} htmlFor="adListing" className="sm:col-span-2"><Input id="adListing" name="listingId" defaultValue={String(editing?.listingId || '')} required /></Field>}
          {linkType === 'external' && <Field label={tr('Sponsor URL')} htmlFor="adUrl" className="sm:col-span-2"><Input id="adUrl" name="externalUrl" type="url" defaultValue={String(editing?.externalUrl || '')} placeholder="https://example.com" required /></Field>}
          <Field label={tr('Sponsor image')} htmlFor="adImage" hint={tr('Under 5 MB')} className="sm:col-span-2"><Input id="adImage" name="image" type="file" accept="image/*" onChange={event => setImageFile(event.target.files?.[0] || null)} /></Field>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><Button disabled={busy}>{busy ? 'Saving…' : editing ? 'Save sponsor' : 'Publish sponsor'}</Button>{editing && <Button type="button" variant="secondary" onClick={clearEditor}>{tr('Cancel')}</Button>}</div>
        </form>
        <div className="self-start overflow-hidden rounded-xl border border-ink-100 bg-sand-50"><div className="flex aspect-[16/10] items-center justify-center bg-sand-100">{previewUrl ? <img src={previewUrl} alt="Sponsor preview" className="h-full w-full object-cover" /> : <ImagePlus aria-hidden className="size-10 text-sand-400" />}</div><div className="p-4"><p className="text-xs font-semibold uppercase tracking-widest text-sand-700">Sponsored{ sponsorName ? ` · ${sponsorName}` : '' }</p><p className="mt-2 font-semibold text-ink-900">{title || 'Your sponsor headline'}</p><p className="mt-1 text-xs text-ink-500">{subtitle || 'The supporting description will appear here.'}</p></div></div>
      </div>
    </Surface>

    {error && <p role="alert" className="text-sm text-clay-700">Could not load sponsors: {error}</p>}
    <div className="space-y-3">{[...items].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)).map(ad => <Surface key={ad.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-center gap-4"><div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-ink-100">{ad.imageUrl && <img src={ad.imageUrl} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0"><p className="truncate font-semibold text-ink-900">{ad.title || 'Untitled sponsor'}</p><p className="text-xs text-ink-500">{ad.sponsorName ? `${ad.sponsorName} · ` : ''}{ad.placement === 'home' || ad.placement === 'listings' ? 'Available listings' : ad.placement === 'all' ? 'Both sections' : 'Landing'} · priority {ad.priority || 0}</p><p className={`mt-1 text-xs font-semibold ${ad.status === 'active' && sponsorHref(ad) ? 'text-emerald-700' : 'text-ink-500'}`}>{ad.status === 'active' && sponsorHref(ad) ? 'Active' : ad.status === 'active' ? 'Needs a link' : 'Paused'}</p></div></div><div className="flex gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => startEdit(ad)}>{tr('Edit')}</Button><Button type="button" size="sm" variant="secondary" onClick={() => { if (ad.status === 'paused' && (!sponsorHref(ad) || !ad.imageUrl || !ad.title)) { toast.error('Add an image, title, and destination before activating.'); startEdit(ad); return; } void updateDoc(doc(db(), 'ads', ad.id), { status: ad.status === 'paused' ? 'active' : 'paused', updatedAt: serverTimestamp() }).then(() => toast.success(ad.status === 'paused' ? 'Sponsor activated' : 'Sponsor paused')).catch(error => toast.error(error.message)); }}>{ad.status === 'paused' ? tr('Activate') : tr('Pause')}</Button><Button type="button" size="sm" variant="destructive" onClick={() => { if (window.confirm('Delete this sponsor?')) void deleteDoc(doc(db(), 'ads', ad.id)).then(() => toast.success('Sponsor deleted')).catch(error => toast.error(error.message)); }}>{tr('Delete')}</Button></div></Surface>)}</div>
  </section>;
}
