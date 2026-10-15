import type { Metadata } from 'next';
import { getTranslation } from '@/i18n';
import { AreaConverter } from '@/modules/discovery/components/AreaConverter';

export const metadata: Metadata = { title: 'Land size | MeroKotha', description: 'Convert Nepali land units and square measurements.' };

export default async function LandSizePage() {
  const { t } = await getTranslation();
  return <div className="mx-auto max-w-5xl py-4 sm:py-8"><p className="label mb-3 text-crimson-600">{t.converter.eyebrow}</p><h1 className="text-display-md text-ink-900">{t.converter.title}</h1><p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-600">{t.converter.intro}</p><div className="mt-8"><AreaConverter t={t.converter} /></div></div>;
}
