import type { Metadata } from 'next';

import { getTranslation } from '@/i18n';
import { EmiCalculator } from '@/modules/finance/components/EmiCalculator';

export const metadata: Metadata = {
  title: 'EMI',
  description:
    'Work out the monthly instalment on a home loan in Nepal: the deposit, the interest over the whole loan, and what changes if you pay a little extra.',
};

export default async function EmiPage() {
  const { t } = await getTranslation();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="label mb-3 text-crimson-600">{t.emi.eyebrow}</p>
      <h1 className="text-display-md text-ink-900">{t.emi.title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-600">{t.emi.intro}</p>

      <div className="mt-8">
        <EmiCalculator t={t.emi} />
      </div>
    </div>
  );
}
