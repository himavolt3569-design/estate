import type { Metadata } from 'next';

import { LegalArticle } from '@/components/layout/LegalArticle';
import { getLocale } from '@/i18n';
import { getLegalContent } from '@/i18n/legal';

export async function generateMetadata(): Promise<Metadata> {
  const { privacy } = getLegalContent(await getLocale());
  return { title: privacy.title, description: privacy.intro };
}

export default async function PrivacyPage() {
  const { privacy } = getLegalContent(await getLocale());
  return <LegalArticle page={privacy} />;
}
