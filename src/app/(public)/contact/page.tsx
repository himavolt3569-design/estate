import { ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { getLocale } from '@/i18n';
import { getLegalContent } from '@/i18n/legal';

export async function generateMetadata(): Promise<Metadata> {
  const { contact } = getLegalContent(await getLocale());
  return { title: contact.title, description: contact.intro };
}

/**
 * Contact details and the three things people actually arrive here to do.
 *
 * Deliberately no contact form. A form that posts nowhere is worse than an
 * email address, and there is no inbox behind it yet. When there is a real
 * destination and a place to store submissions, a form can replace this.
 */
export default async function ContactPage() {
  const { contact } = getLegalContent(await getLocale());

  const icons = [Mail, Mail, Phone, MapPin];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <header className="max-w-2xl border-b border-ink-900 pb-6">
        <h1 className="text-display-md text-ink-900">{contact.title}</h1>
        <p className="mt-5 text-base leading-relaxed text-ink-600">{contact.intro}</p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_1fr]">
        <section>
          <ul className="grid gap-px bg-ink-200">
            {contact.channels.map((channel, index) => {
              const Icon = icons[index] ?? Mail;
              return (
                <li key={channel.label} className="bg-white p-5">
                  <div className="flex items-start gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ink-200 text-ink-500">
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="label">{channel.label}</p>
                      <p className="mt-2 text-base text-ink-900">
                        {channel.href ? (
                          <a
                            href={channel.href}
                            className="underline underline-offset-4 hover:text-royal-700"
                          >
                            {channel.value}
                          </a>
                        ) : (
                          channel.value
                        )}
                      </p>
                      {channel.note && (
                        <p className="mt-1 text-xs text-ink-500">{channel.note}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 border-l-2 border-emerald-600 pl-4 text-sm leading-relaxed text-ink-600">
            {contact.responseNote}
          </p>
        </section>

        <section>
          <h2 className="label border-b border-ink-200 pb-3">{contact.quickTitle}</h2>
          <ul className="mt-px grid gap-px bg-ink-200">
            {contact.quick.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex items-start gap-4 bg-white p-5 transition-colors hover:bg-royal-900"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium text-ink-900 transition-colors group-hover:text-white">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-ink-500 transition-colors group-hover:text-royal-200">
                      {item.note}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="mt-1 size-4 shrink-0 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-300"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
