'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { GeoPoint } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Camera, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Surface, Textarea } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/select-menu';
import { createListing } from '@/lib/firebase/actions';
import { cleanContactNumber, validContactNumber } from '@/lib/contact';
import { ListingPhotoPicker } from './listing-photo-picker';
import { useAuth } from './auth-provider';
import { useSiteText } from './site-language';

const LocationPickerMap = dynamic(() => import('@/components/map/LocationPickerMap'), { ssr: false });
const types = ['room', 'flat', 'apartment', 'house', 'office', 'shop', 'land'];

export function ListingForm() {
  const t = useSiteText();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const submissionId = useRef<string | null>(null);
  const [agent, setAgent] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState({ title: '', rent: '', address: '', type: 'room' });

  if (!user || !profile) return <Surface className="p-6">{t('Sign in and complete your profile to post a rental.', 'घरजग्गा राख्न साइन इन गरी प्रोफाइल पूरा गर्नुहोस्।')}</Surface>;
  if (profile.isBanned) return <Surface className="p-6">{t('This account cannot post listings.', 'यो खाताबाट विज्ञापन राख्न मिल्दैन।')}</Surface>;
  const verifiedAgent = profile.agentStatus === 'verified';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const number = (key: string) => Number(form.get(key) || 0);
      const title = String(form.get('title') || '').trim();
      const rent = number('rentPerMonth');
      if (!title || rent <= 0) throw new Error('Enter a title and monthly rent greater than zero.');
      if (files.some(file => !file.type.startsWith('image/') || file.size >= 5 * 1024 * 1024)) {
        throw new Error('Each photo must be an image smaller than 5 MB.');
      }
      if (agent && (!String(form.get('contactName') || '').trim() || !String(form.get('contactPhone') || '').trim())) {
        throw new Error('The real owner name and phone are required for agent listings.');
      }
      const publicCallNumber = cleanContactNumber(String(form.get('publicCallNumber') || ''));
      const publicWhatsAppNumber = cleanContactNumber(String(form.get('publicWhatsAppNumber') || ''));
      if (!validContactNumber(publicCallNumber) || !validContactNumber(publicWhatsAppNumber)) {
        throw new Error('Enter a valid contact or WhatsApp number.');
      }

      submissionId.current ||= crypto.randomUUID();
      const id = await createListing(submissionId.current, user.uid, form.get('contactIsAnonymous') === 'on' ? 'Private lister' : profile.name, {
        title,
        roomType: String(form.get('roomType')),
        rentPerMonth: rent,
        depositAmount: number('depositAmount'),
        floor: number('floor'),
        totalFloors: number('totalFloors'),
        furnishing: String(form.get('furnishing')),
        facilities: String(form.get('facilities') || '').split(',').map(value => value.trim()).filter(Boolean),
        description: String(form.get('description') || ''),
        address: String(form.get('address') || ''),
        nearbyLandmarks: String(form.get('nearbyLandmarks') || ''),
        availableFrom: new Date(String(form.get('availableFrom') || new Date().toISOString().slice(0, 10))),
        geoPoint: point ? new GeoPoint(point.lat, point.lng) : null,
        agentId: agent ? user.uid : null,
        verificationStatus: 'pending',
        publicCallNumber,
        publicWhatsAppNumber,
        contactIsAnonymous: form.get('contactIsAnonymous') === 'on',
      }, files, agent ? { name: String(form.get('contactName')), phone: String(form.get('contactPhone')) } : undefined);
      toast.success(t('Rental posted', 'घरजग्गा राखियो'));
      router.push(`/listing/${id}`);
    } catch (error) {
      submitting.current = false;
      toast.error(error instanceof Error ? error.message : 'Could not post listing');
    } finally {
      if (!submitting.current) setBusy(false);
    }
  };

  return (
    <Surface className="overflow-visible p-5 sm:p-7 xl:p-8">
      <div className="mb-7 flex flex-wrap items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-crimson-50 text-crimson-700"><Camera aria-hidden className="size-5" /></span>
        <div><h2 className="text-2xl font-semibold tracking-tight text-ink-900">{t('Post a rental', 'घरजग्गा राख्नुहोस्')}</h2><p className="mt-1 text-sm text-ink-500">{t('Add the details and photos. Your preview updates as you go.', 'विवरण र फोटो थप्नुहोस्। पूर्वावलोकन तुरुन्तै बदलिन्छ।')}</p><p className="mt-1 text-xs text-ink-500">{t('Your listing becomes active immediately and enters the admin verification queue.', 'विज्ञापन तुरुन्त सक्रिय हुन्छ र प्रशासकको समीक्षामा जान्छ।')}</p></div>
      </div>

      <form onSubmit={submit} className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
        <div className="order-2 min-w-0 space-y-6 xl:order-1">
          <section aria-labelledby="property-details-heading" className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6">
            <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">01 / {t('Property', 'घरजग्गा')}</p><h3 id="property-details-heading" className="mt-1 text-lg font-semibold text-ink-900">{t('Tell people about the place', 'ठाउँबारे जानकारी दिनुहोस्')}</h3></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('Title', 'शीर्षक')} htmlFor="title" required className="sm:col-span-2"><Input id="title" name="title" required placeholder={t('e.g. Sunny two bedroom flat in Patan', 'जस्तै: पाटनमा दुई कोठाको फ्ल्याट')} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></Field>
              <Field label={t('Type', 'प्रकार')} htmlFor="roomType"><SelectMenu id="roomType" name="roomType" value={draft.type} onValueChange={value => setDraft(current => ({ ...current, type: value }))} options={types.map(type => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) }))} /></Field>
              <Field label={t('Monthly rent (Rs.)', 'मासिक भाडा (रु.)')} htmlFor="rentPerMonth" required><Input id="rentPerMonth" name="rentPerMonth" type="number" min="1" required placeholder="25,000" onChange={event => setDraft(current => ({ ...current, rent: event.target.value }))} /></Field>
              <Field label={t('Deposit (Rs.)', 'धरौटी (रु.)')} htmlFor="depositAmount"><Input id="depositAmount" name="depositAmount" type="number" min="0" defaultValue="0" /></Field>
              <Field label={t('Furnishing', 'फर्निसिङ')} htmlFor="furnishing"><SelectMenu id="furnishing" name="furnishing" defaultValue="unfurnished" options={[{ value: 'unfurnished', label: t('Unfurnished', 'फर्निसिङ नभएको') }, { value: 'semiFurnished', label: t('Semi furnished', 'आंशिक फर्निसिङ') }, { value: 'furnished', label: t('Furnished', 'फर्निसिङ भएको') }]} /></Field>
              <Field label={t('Floor', 'तला')} htmlFor="floor"><Input id="floor" name="floor" type="number" defaultValue="0" /></Field>
              <Field label={t('Total floors', 'जम्मा तला')} htmlFor="totalFloors"><Input id="totalFloors" name="totalFloors" type="number" min="1" defaultValue="1" /></Field>
              <Field label={t('Available from', 'उपलब्ध हुने मिति')} htmlFor="availableFrom" className="sm:col-span-2"><Input id="availableFrom" name="availableFrom" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
            </div>
          </section>

          <section aria-labelledby="location-heading" className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-2"><MapPin aria-hidden className="mt-0.5 size-5 text-crimson-700" /><div><p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">02 / {t('Location', 'स्थान')}</p><h3 id="location-heading" className="mt-1 text-lg font-semibold text-ink-900">{t('Help people find it', 'ठाउँ पत्ता लगाउन सहयोग गर्नुहोस्')}</h3></div></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('Address', 'ठेगाना')} htmlFor="address"><Input id="address" name="address" placeholder={t('Street, area, city', 'सडक, टोल, शहर')} onChange={event => setDraft(current => ({ ...current, address: event.target.value }))} /></Field>
              <Field label={t('Nearby landmarks', 'नजिकका चिनारी')} htmlFor="nearbyLandmarks"><Input id="nearbyLandmarks" name="nearbyLandmarks" /></Field>
            </div>
            <p className="mb-2 mt-5 text-sm font-medium text-ink-800">{t('Choose a map location', 'नक्सामा स्थान छान्नुहोस्')}</p>
            <LocationPickerMap onChange={setPoint} className="h-72 rounded-xl" />
          </section>

          <section aria-labelledby="extra-details-heading" className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6">
            <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">03 / {t('Details', 'विवरण')}</p><h3 id="extra-details-heading" className="mt-1 text-lg font-semibold text-ink-900">{t('Make the listing useful', 'उपयोगी जानकारी थप्नुहोस्')}</h3></div>
            <div className="space-y-5"><Field label={t('Facilities, separated by commas', 'सुविधाहरू, अल्पविरामले छुट्याएर')} htmlFor="facilities"><Input id="facilities" name="facilities" placeholder={t('Water, parking, Wi-Fi', 'पानी, पार्किङ, वाइफाइ')} /></Field><Field label={t('Description', 'विवरण')} htmlFor="description"><Textarea id="description" name="description" placeholder={t('Describe the space and what makes it a good fit', 'ठाउँ र यसको विशेषताबारे लेख्नुहोस्')} className="min-h-32" /></Field></div>
          </section>

          {verifiedAgent && <section className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6"><label className="flex items-center gap-2 text-sm font-medium text-ink-800"><input type="checkbox" checked={agent} onChange={event => setAgent(event.target.checked)} />{t('Post on behalf of a property owner', 'घरधनीको तर्फबाट विज्ञापन राख्नुहोस्')}</label>{agent && <div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label={t('Real owner name', 'वास्तविक घरधनीको नाम')} htmlFor="contactName"><Input id="contactName" name="contactName" required /></Field><Field label={t('Real owner phone (private)', 'घरधनीको फोन (गोप्य)')} htmlFor="contactPhone"><Input id="contactPhone" name="contactPhone" required /></Field></div>}</section>}

          <section className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-widest text-crimson-700">04 / {t('Contact', 'सम्पर्क')}</p><h3 className="mt-1 text-lg font-semibold">{t('How should renters reach you?', 'भाडामा बस्न चाहनेले कसरी सम्पर्क गर्ने?')}</h3><p className="mt-2 text-sm text-ink-500">{t('Choose either public contact method, both, or neither. Renters can always send an inquiry here. Agents should use their own numbers; the real owner number above stays private.', 'फोन वा व्हाट्सएप नम्बर राख्न वा खाली छोड्न सक्नुहुन्छ। यहाँबाट सोधपुछ सधैं पठाउन मिल्छ। एजेन्टले आफ्नो नम्बर राख्नुपर्छ; घरधनीको नम्बर गोप्य रहन्छ।')}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={t('Call number (optional)', 'फोन नम्बर (वैकल्पिक)')} htmlFor="publicCallNumber"><Input id="publicCallNumber" name="publicCallNumber" type="tel" autoComplete="tel" placeholder="+977 98XXXXXXXX" /></Field><Field label={t('WhatsApp number (optional)', 'व्हाट्सएप नम्बर (वैकल्पिक)')} htmlFor="publicWhatsAppNumber"><Input id="publicWhatsAppNumber" name="publicWhatsAppNumber" type="tel" placeholder="+977 98XXXXXXXX" /></Field></div><label className="mt-4 flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" name="contactIsAnonymous" /> {t('Hide my display name on the public listing', 'सार्वजनिक विज्ञापनमा मेरो नाम लुकाउनुहोस्')}</label></section>

          <Button disabled={busy} className="w-full sm:w-auto">{busy ? t('Posting…', 'राखिँदैछ…') : t('Publish rental', 'घरजग्गा प्रकाशित गर्नुहोस्')}</Button>
        </div>

        <div className="order-1 min-w-0 xl:order-2"><ListingPhotoPicker onChange={setFiles} draft={draft} disabled={busy} /></div>
      </form>
    </Surface>
  );
}
