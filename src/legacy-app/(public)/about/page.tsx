import { ArrowRight, FileCheck2, MapPinned, ScrollText, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal } from '@/components/motion/Motion';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'About Kitta',
  description:
    'Why Kitta exists: property in Nepal, with the paperwork in the open. Who we are, what we check, and what we will not do.',
};

/*
 * Linked from the home page and from the footer, and it 404'd. Written to
 * answer the question a Nepali buyer actually arrives with — "can I trust a
 * listing on this site" — rather than to describe the company.
 */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="label mb-3 text-crimson-600">About us</p>
        <h1 className="text-display-lg text-ink-900">
          Property in Nepal, with the paperwork in the open.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-600">
          Buying land or a house here usually means trusting a stranger&rsquo;s word about a
          document you have not seen. Kitta exists to shrink how much of that you have to do. Every
          listing carries a public record of who put it there, when, and what has actually been
          checked.
        </p>
      </div>

      <section className="mt-16">
        <SectionHeading eyebrow="How it works" title="What we check before a listing goes live" />

        <Reveal className="mt-8" stagger={0.05}>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: ScrollText,
                title: 'The lalpurja',
                body: 'We look at the ownership certificate and confirm the person listing the property is on it.',
              },
              {
                icon: MapPinned,
                title: 'The location',
                body: 'The pin on the map is checked against the parcel, so what you visit is what you searched for.',
              },
              {
                icon: FileCheck2,
                title: 'The photos',
                body: 'Photos are checked for reuse from other listings, which is the most common way a fake listing is built.',
              },
              {
                icon: Users,
                title: 'The seller',
                body: 'Owner, agent or agency — the listing says which, and that comes from the account, not from a claim.',
              },
            ].map((item) => (
              <li
                key={item.title}
                className="reveal rounded-2xl border border-ink-100 bg-white p-6 shadow-soft"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-crimson-50 text-crimson-600">
                  <item.icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{item.body}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section className="mt-16">
        <SectionHeading eyebrow="Being straight with you" title="What we do not do" />

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {[
            {
              title: 'We do not value your property',
              body: 'The asking price is the seller’s. We show what has been listed, not what we think it is worth.',
            },
            {
              title: 'We do not take a cut of the sale',
              body: 'Kitta is not a party to the deal. Whatever you agree with the seller stays between you.',
            },
            {
              title: 'We do not hide the failures',
              body: 'When a listing is rejected or a seal is withdrawn, that goes on the public record too.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-ink-100 bg-ink-50/50 p-6">
              <h3 className="text-base font-semibold text-ink-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="thread-top mt-16 overflow-hidden rounded-2xl border border-ink-100 bg-white p-8 shadow-raised sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              Have something to sell?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Putting a property on Kitta takes six short steps, and you can stop halfway and come
              back. There is no charge to list.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Put a property up <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
