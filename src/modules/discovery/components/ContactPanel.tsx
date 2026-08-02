'use client';

// Client boundary: revealing a contact detail is an authenticated, rate-limited
// round trip that must not happen during render. The numbers are never in the
// page payload, not even hidden behind a class, which scrapers read straight out
// of the DOM (threat 3 in docs/03-security-model.md).

import { Loader2, Mail, MessageCircle, MessagesSquare, Phone } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatNepaliPhone, telLink, whatsappLink } from '@/lib/phone/nepal';
import { createClient } from '@/lib/supabase/client';

type RevealedNumber = {
  id: string;
  phone: string;
  label: string | null;
  isWhatsapp: boolean;
};

type Revealed = {
  numbers: RevealedNumber[];
  email: string | null;
};

/**
 * One reveal, then every way to make contact.
 *
 * This used to be three buttons — "Show phone number", "Show WhatsApp", "Show
 * email" — each of which was its own round trip and its own charge against the
 * 30-a-day budget, for what a buyer experiences as one decision. It is now a
 * single call that returns the listing's whole contact set, after which the
 * numbers are shown plainly with their own Call and WhatsApp actions.
 *
 * The reveal stays. It is the rate limit and the disclosure ledger that let the
 * platform promise a seller their number will not be harvested, and dropping it
 * to save one tap would quietly break that promise.
 */
export function ContactPanel({
  propertyId,
  available,
  propertyTitle,
  ownerId,
}: {
  propertyId: string;
  available: { phone: boolean; email: boolean; whatsapp: boolean };
  propertyTitle: string;
  ownerId: string | null;
}) {
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [pending, setPending] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  /*
   * Resolved here rather than on the server because this page is ISR-cached for
   * search engines. The only thing it decides is whether the seller sees a
   * "message yourself" button on their own listing; the messaging route enforces
   * that rule again, so a stale value here cannot create a self-thread.
   */
  useEffect(() => {
    let active = true;
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setViewerId(data.user?.id ?? null);
      });
    return () => {
      active = false;
    };
  }, []);

  const anyChannel = available.phone || available.email || available.whatsapp;
  const canChat = Boolean(ownerId);
  const isOwnListing = Boolean(viewerId && ownerId && viewerId === ownerId);

  async function reveal() {
    setPending(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('reveal_property_contacts', {
        p_property_id: propertyId,
      });

      if (error) {
        // The database raises with a message written for a person: a disabled
        // channel, a daily limit, or a prompt to sign in.
        toast.error(error.message.replace(/^.*?:\s*/, ''));
        return;
      }

      const payload = data as unknown as Revealed | null;
      if (!payload || (payload.numbers.length === 0 && !payload.email)) {
        toast.error('The lister has not added contact details yet.');
        return;
      }

      setRevealed(payload);
    } catch {
      toast.error('Could not reach the server. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Messaging does not need a reveal: it never exposes a number, and the
          thread is the channel the platform can actually stand behind. */}
      {canChat && !isOwnListing && (
        <Button asChild className="w-full justify-start">
          <Link href={`/dashboard/messages/new?property=${propertyId}`}>
            <MessagesSquare aria-hidden />
            Message the owner
          </Link>
        </Button>
      )}

      {!anyChannel ? (
        <p className="text-sm text-ink-500">
          The lister has not shared direct contact details.
          {canChat && !isOwnListing ? ' Send them a message instead.' : ''}
        </p>
      ) : !revealed ? (
        <>
          <Button
            variant="secondary"
            className="w-full justify-start"
            disabled={pending}
            onClick={() => void reveal()}
          >
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Phone aria-hidden />}
            {pending ? 'Checking…' : 'Show contact details'}
          </Button>
          <p className="pt-1 text-2xs leading-relaxed text-ink-400">
            The lister is shown that you viewed their details, and when. Reveals are limited to 30 a
            day per account.
          </p>
        </>
      ) : (
        <div className="space-y-3">
          {revealed.numbers.length > 0 && (
            <ul className="space-y-2">
              {revealed.numbers.map((number) => (
                <li key={number.id} className="rounded-lg border border-ink-200 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="nums text-sm font-medium text-ink-900">
                      {formatNepaliPhone(number.phone)}
                    </p>
                    {number.label && (
                      <span className="text-2xs tracking-wide text-ink-400 uppercase">
                        {number.label}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <a href={telLink(number.phone)}>
                        <Phone aria-hidden className="size-3.5" /> Call
                      </a>
                    </Button>

                    {number.isWhatsapp && (
                      <Button asChild size="sm" variant="secondary">
                        <a
                          href={whatsappLink(
                            number.phone,
                            `Hello, I am interested in "${propertyTitle}" on Kitta.`,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle aria-hidden className="size-3.5" /> WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {revealed.email && (
            <Button asChild variant="secondary" className="w-full justify-start">
              <a href={`mailto:${revealed.email}?subject=${encodeURIComponent(propertyTitle)}`}>
                <Mail aria-hidden />
                <span className="truncate">{revealed.email}</span>
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
