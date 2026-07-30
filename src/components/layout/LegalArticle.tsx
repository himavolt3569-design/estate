import type { LegalPage } from '@/i18n/legal';

/**
 * Long-form prose layout.
 *
 * Measure is capped near 68 characters. Terms and privacy pages are the two
 * documents people are most likely to give up on, and an over-wide line is one
 * of the reliable reasons they do. Headings are numbered because these are
 * clauses people need to refer back to ("point 4 says…"), which is a real use
 * for numbering rather than decoration.
 */
export function LegalArticle({ page }: { page: LegalPage }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <header className="border-b border-ink-900 pb-6">
        <h1 className="text-display-md text-ink-900">{page.title}</h1>
        <p className="mt-5 text-base leading-relaxed text-ink-600">{page.intro}</p>
        <p className="label mt-6">{page.updated}</p>
      </header>

      <div className="mt-12 space-y-12">
        {page.sections.map((section, index) => (
          <section key={section.heading}>
            <div className="flex items-baseline gap-4">
              <span aria-hidden className="nums shrink-0 text-lg font-extralight text-ink-300">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink-900">
                {section.heading}
              </h2>
            </div>
            <div className="mt-4 space-y-4 pl-0 sm:pl-10">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-base leading-relaxed text-ink-600">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
