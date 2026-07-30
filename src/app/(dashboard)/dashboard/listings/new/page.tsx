import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getTranslation } from '@/i18n';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { NewListingForm } from './components/NewListingForm';

export const metadata: Metadata = { title: 'Add Property', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function NewListingPage() {
  const [user] = await Promise.all([getSessionUser(), getTranslation()]);
  if (!user) redirect('/login');

  const vendor = isVendor(user.role);
  const admin = user.role === 'platform_admin';
  if (!vendor && !admin) redirect('/dashboard');

  const supabase = await createClient();

  // Master Admin can list on behalf of someone else, so we need users to choose from
  let owners: any[] = [];
  if (admin) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['property_owner', 'agent', 'agency_manager'])
      .is('deleted_at', null);
    owners = data ?? [];
  }

  // Fetch existing features to allow selection
  const { data: featuresData } = await supabase
    .from('features')
    .select('id, key, label_en')
    .eq('is_active', true)
    .order('label_en');
  const features = featuresData ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard/listings">
            <ArrowLeft aria-hidden /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          List a New Property
        </h1>
      </div>

      <div className="bg-white p-6 border border-ink-200">
        <NewListingForm admin={admin} owners={owners} features={features} />
      </div>
    </div>
  );
}
