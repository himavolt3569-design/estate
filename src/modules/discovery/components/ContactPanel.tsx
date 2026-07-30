'use client';

// Client boundary: revealing a contact detail is an authenticated, rate-limited
// round trip that must not happen during render. The number is never in the page
// payload, not even hidden behind a class, which scrapers read straight out of
// the DOM (threat 3 in docs/03-security-model.md).

import { Mail, MessageCircle, Phone } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

type Channel = 'phone' | 'email' | 'whatsapp';

const CHANNEL_META: Record<Channel, { label: string; icon: React.ReactNode; href: (v: string) => string }> = {
  phone: {
    label: 'Show phone number',
    icon: <Phone aria-hidden />,
    href: (v) => `tel:${v}`,
  },
  whatsapp: {
    label: 'Show WhatsApp',
    icon: <MessageCircle aria-hidden />,
    href: (v) => `https://wa.me/${v.replace(/[^0-9]/g, '')}`,
  },
  email: {
    label: 'Show email',
    icon: <Mail aria-hidden />,
    href: (v) => `mailto:${v}`,
  },
};

export function ContactPanel({
  propertyId,
  available,
}: {
  propertyId: string;
  available: { phone: boolean; email: boolean; whatsapp: boolean };
}) {
  const [revealed, setRevealed] = useState<Partial<Record<Channel, string>>>({});
  const [pending, setPending] = useState<Channel | null>(null);

  const channels = (Object.keys(CHANNEL_META) as Channel[]).filter((c) => available[c]);

  async function reveal(channel: Channel) {
    setPending(channel);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('reveal_contact', {
        p_property_id: propertyId,
        p_channel: channel,
      });

      if (error) {
        // The database raises with a message written for a person: a disabled
        // channel, a daily limit, or a prompt to sign in.
        toast.error(error.message.replace(/^.*?:\s*/, ''));
        return;
      }

      if (!data) {
        toast.error('The lister has not added this yet.');
        return;
      }

      setRevealed((prev) => ({ ...prev, [channel]: data as string }));
    } catch {
      toast.error('Could not reach the server. Try again.');
    } finally {
      setPending(null);
    }
  }

  if (channels.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        The lister has not shared direct contact details. Send an enquiry instead.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {channels.map((channel) => {
        const meta = CHANNEL_META[channel];
        const value = revealed[channel];

        if (value) {
          return (
            <Button key={channel} asChild variant="secondary" className="w-full justify-start">
              <a href={meta.href(value)} className="nums">
                {meta.icon}
                {value}
              </a>
            </Button>
          );
        }

        return (
          <Button
            key={channel}
            variant="secondary"
            className="w-full justify-start"
            disabled={pending === channel}
            onClick={() => void reveal(channel)}
          >
            {meta.icon}
            {pending === channel ? 'Checking…' : meta.label}
          </Button>
        );
      })}

      <p className="pt-1 text-2xs leading-relaxed text-ink-400">
        The lister is shown that you viewed their details, and when. Reveals are limited to 30 a
        day per account.
      </p>
    </div>
  );
}
