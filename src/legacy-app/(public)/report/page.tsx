import { Flag, Mail, Phone } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Report a listing',
  description: 'Tell us about a listing that looks wrong, and what happens after you do.',
};

const REASONS = [
  { title: 'The property does not exist', body: 'You visited and there is nothing there, or it is not what the photos showed.' },
  { title: 'It is already sold', body: 'The listing is still live but the property has changed hands.' },
  { title: 'The photos are not theirs', body: 'You have seen the same pictures on another listing or another site.' },
  { title: 'The seller is not the owner', body: 'Somebody is listing a property they have no right to sell.' },
  { title: 'The price is a bait', body: 'The advertised price is not the price you were quoted on the phone.' },
  { title: 'Something else', body: 'Anything that made you think this listing should not be here.' },
];

/**
 * Reporting happens from the listing itself, where we already know which
 * property is being reported. This page exists because the footer links to it,
 * and it explains the route rather than pretending to be a second one.
 */
export default function ReportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="flex size-12 items-center justify-center rounded-full bg-crimson-50 text-crimson-600">
        <Flag aria-hidden className="size-5" />
      </span>

      <h1 className="mt-6 text-display-md text-ink-900">Report a listing</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink-600">
        Open the listing you are worried about and use <strong>Report this listing</strong> at the
        bottom of the page. Reporting from there tells us which property you mean, which is what
        lets us act on it the same day.
      </p>

      <h2 className="mt-12 text-lg font-semibold text-ink-900">Worth reporting</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {REASONS.map((reason) => (
          <li key={reason.title} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft">
            <h3 className="text-sm font-semibold text-ink-900">{reason.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{reason.body}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-lg font-semibold text-ink-900">What happens next</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        A report goes into a queue a person works through. If the listing is wrong we take it down
        and write what happened into the property&rsquo;s public record, so the next buyer can see
        it. We do not tell the seller who reported them.
      </p>

      <div className="mt-10 rounded-2xl border border-ink-100 bg-ink-50/60 p-6">
        <p className="text-sm font-semibold text-ink-900">If it cannot wait</p>
        <div className="mt-3 flex flex-col gap-2 text-sm text-ink-600 sm:flex-row sm:gap-6">
          <a
            href="tel:+9779801234567"
            className="flex items-center gap-2 hover:text-crimson-700"
          >
            <Phone aria-hidden className="size-4 text-crimson-600" />
            <span className="nums">+977 9801234567</span>
          </a>
          <a
            href="mailto:report@kitta.com.np"
            className="flex items-center gap-2 hover:text-crimson-700"
          >
            <Mail aria-hidden className="size-4 text-crimson-600" />
            report@kitta.com.np
          </a>
        </div>
      </div>
    </div>
  );
}
