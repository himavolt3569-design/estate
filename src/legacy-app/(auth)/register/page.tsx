import type { Metadata } from 'next';

import { getDictionary } from '@/i18n';

import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a Kitta account to search, save and list property in Nepal.',
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params['next']) ? params['next'][0] : params['next'];
  const next = raw?.startsWith('/') && !raw.startsWith('//') ? raw : undefined;

  const t = await getDictionary();

  return <RegisterForm next={next} t={t.auth} />;
}
