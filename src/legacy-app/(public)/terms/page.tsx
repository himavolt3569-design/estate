import type { Metadata } from 'next';

import { LegalArticle } from '@/components/layout/LegalArticle';
import { getLocale } from '@/i18n';
import { getLegalContent } from '@/i18n/legal';

export async function generateMetadata(): Promise<Metadata> {
  const { terms } = getLegalContent(await getLocale());
  return { title: terms.title, description: terms.intro };
}

export default async function TermsPage() {
  const { terms } = getLegalContent(await getLocale());
  return <LegalArticle page={terms} />;
}
