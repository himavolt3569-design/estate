import type { Metadata } from 'next';

import { PageHeader } from '../components/PageHeader';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

import { ProfileForm } from './ProfileForm';

export const metadata: Metadata = { title: 'Profile settings', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, bio, preferred_locale, preferred_area_unit, avatar_url')
    .eq('id', user.id)
    .single();

  return (
    <div className="max-w-2xl space-y-7 pb-10">
      <PageHeader
        eyebrow="Your account"
        title="My details"
        subtitle="Your name and picture are shown on the properties you list. Nothing else here is public."
      />

      <ProfileForm
        userId={user.id}
        email={user.email ?? ''}
        defaults={{
          fullName: profile?.full_name ?? '',
          phone: profile?.phone ?? '',
          bio: profile?.bio ?? '',
          preferredLocale: (profile?.preferred_locale ?? 'en') as 'en' | 'ne',
          preferredAreaUnit: (profile?.preferred_area_unit ?? 'ropani') as 'ropani' | 'bigha',
          avatarUrl: profile?.avatar_url ?? '',
        }}
      />
    </div>
  );
}
