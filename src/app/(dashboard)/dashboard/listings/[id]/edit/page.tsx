import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getTranslation } from '@/i18n';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { EditListingForm } from './components/EditListingForm';

export const metadata: Metadata = { title: 'Edit Property', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user] = await Promise.all([getSessionUser(), getTranslation()]);
  if (!user) redirect('/login');

  const vendor = isVendor(user.role);
  const admin = user.role === 'platform_admin';
  if (!vendor && !admin) redirect('/dashboard');

  const supabase = await createClient();

  const { data: property } = await supabase
    .from('properties')
    .select(`
      *,
      property_features ( feature_id )
    `)
    .eq('id', id)
    .single();

  if (!property) {
    return (
      <div className="p-8 text-center text-ink-600">
        Property not found.
      </div>
    );
  }

  // Fetch existing features to allow selection
  const { data: featuresData } = await supabase
    .from('features')
    .select('id, key, label_en')
    .eq('is_active', true)
    .order('label_en');
  const features = featuresData ?? [];
  const selectedFeatureIds = property.property_features?.map((pf: any) => pf.feature_id) || [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard/listings">
            <ArrowLeft aria-hidden /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          Edit Property: {property.title}
        </h1>
      </div>

      <div className="bg-white p-6 border border-ink-200">
        <EditListingForm 
          id={id} 
          property={property} 
          features={features} 
          selectedFeatureIds={selectedFeatureIds} 
        />
      </div>
    </div>
  );
}
