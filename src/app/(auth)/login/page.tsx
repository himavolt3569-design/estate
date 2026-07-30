import type { Metadata } from 'next';

import { getDictionary } from '@/i18n';

import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Kitta account.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextParam = Array.isArray(params['next']) ? params['next'][0] : params['next'];
  const errorParam = Array.isArray(params['error']) ? params['error'][0] : params['error'];

  // Only same-origin relative paths survive. Anything else would make this an
  // open redirect once it is handed to router.push().
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : undefined;

  const t = await getDictionary();

  return <LoginForm next={next} initialError={errorParam} t={t.auth} />;
}
