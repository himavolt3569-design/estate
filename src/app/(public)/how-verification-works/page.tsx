import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Seal } from '@/components/brand/Seal';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'How checking works',
  description:
    'What happens between putting a property on Kitta and it going live, and what the checked seal does and does not mean.',
};

/*
 * The footer has always linked here. The sequence below genuinely is a sequence
 * — each step waits on the one before it — which is the only reason it carries
 * numbers.
 */
const STEPS = [
  {
    title: 'You send it in',
    body: 'You fill in six short steps and add at least five photos. Nothing is public yet, and you can keep editing.',
  },
  {
    title: 'We read the paperwork',
    body: 'We check the lalpurja against the person listing it. If the name does not match, we come back to you before anything goes further.',
  },
  {
    title: 'We check the place is real',
    body: 'The pin is compared with the parcel, and the photos are checked against listings already on the site.',
  },
  {
    title: 'It goes live, or it comes back',
    body: 'Most listings are decided within a day. A rejection always says why, and you can fix it and send it again.',
  },
];

export default function HowVerificationWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="label mb-3 text-crimson-600">Before it goes live</p>
      <h1 className="text-display-md text-ink-900">How checking works</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-600">
        Every listing on Kitta is looked at by a person before a buyer can see it. Here is what that
        involves, in order.
      </p>

      <ol className="mt-12 space-y-px overflow-hidden rounded-2xl border border-ink-100 bg-ink-100 shadow-soft">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-5 bg-white p-6">
            <span
              aria-hidden
              className="nums thin shrink-0 text-3xl leading-none text-crimson-300"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-900">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="flex items-center gap-2.5 text-base font-semibold text-emerald-900">
          <Seal size={20} /> What the seal means
        </p>
        <p className="mt-3 text-sm leading-relaxed text-emerald-900/80">
          The seal says somebody went and confirmed the ownership document and the location. It does
          not say the property is a good buy, that the price is fair, or that nothing will change
          after you visit. Those remain yours to judge — and a seal can be withdrawn, which is also
          written into the public record.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/listings/new">
            Put a property up <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/search">Browse what is live</Link>
        </Button>
      </div>
    </div>
  );
}
