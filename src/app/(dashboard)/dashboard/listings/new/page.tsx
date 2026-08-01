import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { ListingWizard } from '@/modules/listings/components/ListingWizard';
import {
  getFeatureOptions,
  getLocationOptions,
  getPostableOwners,
} from '@/modules/listings/queries';

export const metadata: Metadata = { title: 'Add a property', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function NewListingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/dashboard/listings/new');

  const admin = user.role === 'platform_admin';

  /*
   * A customer who reaches this page is not doing anything wrong — they simply
   * have not said yet that they want to sell. Bouncing them to /dashboard with
   * no explanation was the reason "the list property page does not work" came
   * up so often. They now get the page, and a way to become a seller.
   */
  if (!isVendor(user.role) && !admin) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="thread-top overflow-hidden rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-soft">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            Your account is set up for buying
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
            To put a property on Kitta, switch your account to a seller account. It takes one tap
            and you keep everything you have saved.
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/settings?become=seller">Switch to a seller account</Link>
          </Button>
        </div>
      </div>
    );
  }

  const [{ provinces, districts }, features, owners] = await Promise.all([
    getLocationOptions(),
    getFeatureOptions(),
    admin ? getPostableOwners() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-7 pb-16">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard/listings">
            <ArrowLeft aria-hidden /> My properties
          </Link>
        </Button>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900">
          Put a property on Kitta
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          Six short steps. Your answers are saved as you go, so you can stop and come back.
        </p>
      </div>

      <ListingWizard
        provinces={provinces}
        districts={districts}
        features={features}
        owners={owners}
        isAdmin={admin}
      />
    </div>
  );
}
