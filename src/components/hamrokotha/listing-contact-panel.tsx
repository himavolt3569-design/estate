'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight, Check, MailCheck, MessageCircle, MessageSquareText, Phone, Send, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/primitives';
import { sendInquiry } from '@/lib/firebase/actions';
import type { Listing } from '@/lib/firebase/types';
import { listingContact, whatsAppNumber } from '@/lib/contact';
import { isForSale } from '@/lib/listing-commerce';
import { useAuth } from './auth-provider';
import { useSiteLanguage } from './site-language';

export function ListingContactPanel({ listing }: { listing: Listing }) {
  const { user, profile, loading } = useAuth();
  const { ui, locale } = useSiteLanguage();
  const tr = (en: string, ne: string) => locale === 'ne' ? ne : en;
  const contact = listingContact(listing);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const returnUrl = `/listing/${listing.id}`;

  if (loading) return <section className="rounded-2xl bg-royal-50 p-5 sm:p-6" aria-busy="true"><h2 className="text-lg font-semibold text-royal-950">{tr('Contact the lister', 'विज्ञापनदातासँग सम्पर्क')}</h2><p role="status" className="mt-2 text-sm text-royal-800">{tr('Loading contact options…', 'सम्पर्क विकल्पहरू लोड हुँदैछ…')}</p></section>;

  if (user?.uid === listing.ownerId) return <section aria-labelledby="listing-owner-actions" className="rounded-2xl bg-royal-50 p-5 text-royal-950 sm:p-6">
    <div className="flex items-center gap-2.5"><Settings2 aria-hidden className="size-5 shrink-0 text-royal-700" /><h2 id="listing-owner-actions" className="text-lg font-semibold">{tr('Manage this listing', 'यो विज्ञापन व्यवस्थापन गर्नुहोस्')}</h2></div>
    <p className="mt-3 text-sm leading-relaxed text-royal-800">{tr('Choose how people reach you. Add a public phone or WhatsApp number, or keep inquiries in HamroKotha.', 'मानिसहरूले तपाईंलाई कसरी सम्पर्क गर्ने छनोट गर्नुहोस्। सार्वजनिक फोन वा WhatsApp नम्बर थप्नुहोस्, वा HamroKotha मै सोधपुछ प्राप्त गर्नुहोस्।')}</p>
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-royal-800">
      <span className="inline-flex items-center gap-1.5"><Check aria-hidden className="size-3.5" />{tr('Inquiries in your dashboard', 'ड्यासबोर्डमा सोधपुछ')}</span>
      {(contact.call || contact.whatsapp) && <span className="inline-flex items-center gap-1.5"><Phone aria-hidden className="size-3.5" />{tr('Public contact added', 'सार्वजनिक सम्पर्क थपिएको छ')}</span>}
    </div>
    <Button asChild variant="royal" className="mt-5 w-full !whitespace-normal text-center"><Link href={`/listing/${encodeURIComponent(listing.id)}/edit#edit-call`}>{tr('Edit contact options', 'सम्पर्क विकल्प सम्पादन गर्नुहोस्')}<ArrowRight aria-hidden /></Link></Button>
    <Link href="/dashboard?tab=inquiries" className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-royal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-700"><MessageSquareText aria-hidden className="size-4 shrink-0" />{tr('View inquiries', 'सोधपुछ हेर्नुहोस्')}</Link>
  </section>;

  const questions = [
    { label: tr('Availability', 'उपलब्धता'), text: tr('Hi, is this property still available?', 'नमस्ते, यो घरजग्गा अझै उपलब्ध छ?') },
    { label: tr('Arrange a viewing', 'हेर्ने समय मिलाउनुहोस्'), text: tr('Hi, I would like to view this property. What times work for you?', 'नमस्ते, म यो घरजग्गा हेर्न चाहन्छु। तपाईंलाई कुन समय उपयुक्त हुन्छ?') },
  ];
  const addQuestion = (text: string) => {
    if (!message.includes(text)) {
      const next = message.trim() ? `${message}\n\n${text}` : text;
      if (next.length > 1000) { toast.error(tr('Keep your message under 1,000 characters.', 'सन्देश १,००० अक्षरभन्दा छोटो राख्नुहोस्।')); return; }
      setMessage(next);
    }
    messageInput.current?.focus();
  };

  return <section aria-labelledby="listing-contact-heading" className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6">
    <div className="flex items-start gap-2.5"><MessageSquareText aria-hidden className="mt-0.5 size-5 shrink-0 text-royal-700" /><h2 id="listing-contact-heading" className="text-xl font-semibold leading-snug text-ink-900">{tr('Ask about this property', 'यो घरजग्गाबारे सोध्नुहोस्')}</h2></div>
    <p className="mt-3 text-sm leading-relaxed text-ink-600">{tr('Check availability, ask a question, or arrange a viewing with the lister.', 'विज्ञापनदातासँग उपलब्धता बुझ्नुहोस्, प्रश्न सोध्नुहोस् वा हेर्ने समय मिलाउनुहोस्।')}</p>

    {(contact.call || contact.whatsapp) && <div className="mt-4 grid gap-2">
      {contact.call && <a className="flex min-h-11 items-center gap-3 rounded-lg bg-royal-50 px-3 py-2.5 text-sm font-semibold text-royal-800 hover:bg-royal-100" href={`tel:${contact.call.replace(/[^+\d]/g, '')}`}><Phone aria-hidden className="size-4 shrink-0" /><span className="min-w-0 break-all">{ui.call}: {contact.call}</span></a>}
      {contact.whatsapp && <a className="flex min-h-11 items-center gap-3 rounded-lg bg-royal-50 px-3 py-2.5 text-sm font-semibold text-royal-800 hover:bg-royal-100" href={`https://wa.me/${whatsAppNumber(contact.whatsapp)}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden className="size-4 shrink-0" /><span className="min-w-0 break-all">WhatsApp: {contact.whatsapp}</span></a>}
    </div>}

    {sent ? <div className="mt-5 border-t border-ink-100 pt-5">
      <div role="status" className="flex items-start gap-2 text-sm font-semibold text-emerald-800"><MailCheck aria-hidden className="mt-0.5 size-5 shrink-0" />{tr('Your inquiry has been sent.', 'तपाईंको सोधपुछ पठाइयो।')}</div>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{tr('You can find it in your dashboard and check for updates there.', 'यसलाई ड्यासबोर्डमा हेर्न र अद्यावधिक जानकारी जाँच गर्न सक्नुहुन्छ।')}</p>
      <Button asChild variant="royal" className="mt-4 w-full"><Link href="/dashboard?tab=inquiries">{tr('View my inquiry', 'मेरो सोधपुछ हेर्नुहोस्')}<ArrowRight aria-hidden /></Link></Button>
      <button type="button" onClick={() => { setSent(false); requestAnimationFrame(() => messageInput.current?.focus()); }} className="mt-2 min-h-11 w-full text-sm font-medium text-royal-700 hover:underline">{tr('Write another inquiry', 'अर्को सोधपुछ लेख्नुहोस्')}</button>
    </div> : !user ? <div className="mt-5">
      <p className="text-sm text-ink-600">{tr('Sign in to send an inquiry and keep track of it in your account.', 'सोधपुछ पठाउन र आफ्नो खाताबाट हेर्न साइन इन गर्नुहोस्।')}</p>
      <Button asChild className="mt-4 w-full hover:bg-crimson-700"><Link href={`/sign-in?next=${encodeURIComponent(returnUrl)}`}>{ui.signInInquire}<ArrowRight aria-hidden /></Link></Button>
    </div> : !profile ? <Button asChild className="mt-5 w-full hover:bg-crimson-700"><Link href="/dashboard">{ui.completeProfile}<ArrowRight aria-hidden /></Link></Button> : <form className="mt-5 space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (busy || profile.isBanned) return;
      if (!message.trim()) { toast.error(tr('Write a message before sending your inquiry.', 'सोधपुछ पठाउनुअघि सन्देश लेख्नुहोस्।')); messageInput.current?.focus(); return; }
      setBusy(true);
      try {
        await sendInquiry(listing, user, profile.name, message.trim(), new Date(date));
        setSent(true); setMessage(''); setDate('');
      } catch (error) { toast.error(error instanceof Error ? error.message : tr('Could not send your inquiry. Please try again.', 'सोधपुछ पठाउन सकिएन। फेरि प्रयास गर्नुहोस्।')); }
      finally { setBusy(false); }
    }}>
      <div><p className="mb-2 text-xs font-medium text-ink-600">{tr('Start with a question', 'प्रश्नबाट सुरु गर्नुहोस्')}</p><div className="flex flex-wrap gap-2">{questions.map(question => <button key={question.label} type="button" disabled={busy} onClick={() => addQuestion(question.text)} className="min-h-11 rounded-lg border border-royal-200 bg-royal-50 px-3 py-2 text-xs font-medium text-royal-800 hover:bg-royal-100 disabled:opacity-50">{question.label}</button>)}</div></div>
      <Field label={ui.message} htmlFor="message"><Textarea ref={messageInput} id="message" name="message" required maxLength={1000} rows={4} value={message} disabled={busy} onChange={event => setMessage(event.target.value)} placeholder={tr('What would you like to know?', 'तपाईं के बुझ्न चाहनुहुन्छ?')} /></Field>
      <Field label={isForSale(listing) ? tr('Preferred viewing date', 'हेर्न चाहेको मिति') : ui.moveInDate} htmlFor="moveInDate"><Input id="moveInDate" name="moveInDate" type="date" required value={date} disabled={busy} onChange={event => setDate(event.target.value)} /></Field>
      <Button className="w-full hover:bg-crimson-700" disabled={busy || profile.isBanned}><Send aria-hidden />{busy ? tr('Sending inquiry…', 'सोधपुछ पठाउँदै…') : ui.sendInquiry}</Button>
    </form>}
  </section>;
}
