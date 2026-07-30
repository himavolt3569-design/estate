import {
  ArrowRight,
  Building2,
  Eye,
  Heart,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { getTranslation } from '@/i18n';
import { getSessionUser, isVendor } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [user, { locale, t }] = await Promise.all([getSessionUser(), getTranslation()]);
  if (!user) return null;

  const d = t.dashboard;
  const vendor = isVendor(user.role);
  const admin = user.role === 'platform_admin';
  const supabase = await createClient();

  /*
   * Every count below is scoped by RLS, not by a WHERE clause we wrote here. A
   * vendor's `properties` query returns their own rows because the policy says
   * so, which means a bug in this file cannot leak another vendor's numbers.
   * Master admin bypasses RLS for properties (via 'admin reads all' policy).
   */
  const [listings, enquiries, favourites, allUsersCount] = await Promise.all([
    vendor || admin
      ? supabase
          .from('properties')
          .select('id, status, view_count, enquiry_count', { count: 'exact' })
          .is('deleted_at', null)
      : Promise.resolve({ data: null, count: 0 }),
    vendor || admin
      ? supabase.from('enquiries').select('id, status', { count: 'exact' })
      : Promise.resolve({ data: null, count: 0 }),
    !vendor && !admin
      ? supabase.from('favorites').select('property_id', { count: 'exact' })
      : Promise.resolve({ data: null, count: 0 }),
    admin
      ? supabase.from('profiles').select('id', { count: 'exact', head: true })
      : Promise.resolve({ data: null, count: 0 }),
  ]);

  const rows = (listings.data ?? []) as Array<{
    status: string;
    view_count: number;
    enquiry_count: number;
  }>;
  const published = rows.filter((r) => r.status === 'published').length;
  const pending = rows.filter((r) => r.status === 'pending_review').length;
  const drafts = rows.filter((r) => r.status === 'draft').length;
  const sold = rows.filter((r) => r.status === 'sold' || r.status === 'rented').length;
  const views = rows.reduce((sum, r) => sum + (r.view_count ?? 0), 0);
  const newEnquiries = ((enquiries.data ?? []) as Array<{ status: string }>).filter(
    (e) => e.status === 'new',
  ).length;

  const firstName = user.fullName?.split(' ')[0];

  return (
    <div className="space-y-8 pb-10">
      {/* A royal field, matching the public hero. The dashboard used to open on
          a plain heading over white, which read as an empty page rather than a
          place of work. The primary action lives up here so it is never a
          scroll away. */}
      <header className="relative overflow-hidden bg-royal-900 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
          <div>
            <p className="label label-light">
              {new Date().toLocaleDateString(locale === 'ne' ? 'ne-NP' : 'en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
              {d.greeting}
              {firstName ? `, ${firstName}` : ''}
            </h1>
          </div>

          <Button asChild variant="inverse" size="lg">
            <Link href={vendor ? '/dashboard/listings/new' : '/search'}>
              {vendor ? <Plus aria-hidden /> : <Search aria-hidden />}
              {vendor ? d.addProperty : d.startCta}
            </Link>
          </Button>
        </div>
      </header>

      {/* Shown until a second factor exists, because an account that can publish
          listings is worth stealing. */}
      {!user.hasMfa && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-royal-700 bg-royal-50/50 py-4 pr-4 pl-5">
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-royal-700" />
            <div>
              <p className="text-sm font-medium text-ink-900">{d.secureTitle}</p>
              <p className="mt-0.5 max-w-xl text-sm text-ink-600">{d.secureBody}</p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/settings/security">
              {d.secureCta} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      )}

      {admin ? (
        <>
          <section>
            <h2 className="label mb-4">Platform Overview (Master Admin)</h2>
            <div className="grid gap-px bg-ink-200 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total Active Listings" value={published} icon={Building2} tone="good" href="/dashboard/listings" />
              <Stat label="Total Sold/Rented" value={sold} tone="good" href="/dashboard/listings" />
              <Stat label="Total Users" value={allUsersCount.count ?? 0} icon={Users} tone="flat" href="/dashboard/admin/users" />
              <Stat label="Total Properties View" value={views} icon={Eye} tone="flat" href="/dashboard/listings/analytics" />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="label">Platform Enquiries</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/enquiries">
                  {d.openInbox} <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>

            <div className="grid gap-px bg-ink-200 sm:grid-cols-2">
              <Stat label={d.totalMessages} value={enquiries.count ?? 0} tone="flat" href="/dashboard/enquiries" />
              <Stat
                label={d.newMessages}
                value={newEnquiries}
                tone={newEnquiries > 0 ? 'pending' : 'flat'}
                href="/dashboard/enquiries"
              />
            </div>
          </section>
        </>
      ) : vendor ? (
        <>
          <section>
            <h2 className="label mb-4">{d.yourProperties}</h2>
            <div className="grid gap-px bg-ink-200 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={d.liveNow} value={published} icon={Building2} tone="good" href="/dashboard/listings" />
              <Stat label={d.beingChecked} value={pending} tone={pending > 0 ? 'pending' : 'flat'} href="/dashboard/listings" />
              <Stat label={d.notFinished} value={drafts} tone="flat" href="/dashboard/listings" />
              <Stat label={d.peopleLooked} value={views} icon={Eye} tone="flat" href="/dashboard/listings/analytics" />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="label">{d.messagesTitle}</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/enquiries">
                  {d.openInbox} <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>

            {(enquiries.count ?? 0) === 0 ? (
              <EmptyState
                icon={<MessageSquare className="size-6" />}
                title={d.noMessagesTitle}
                description={d.noMessagesBody}
              />
            ) : (
              <div className="grid gap-px bg-ink-200 sm:grid-cols-2">
                <Stat label={d.totalMessages} value={enquiries.count ?? 0} tone="flat" href="/dashboard/enquiries" />
                <Stat
                  label={d.newMessages}
                  value={newEnquiries}
                  tone={newEnquiries > 0 ? 'pending' : 'flat'}
                  href="/dashboard/enquiries"
                />
              </div>
            )}
          </section>

          {rows.length === 0 && (
            <EmptyState
              icon={<Building2 className="size-6" />}
              title={d.noListingsTitle}
              description={d.noListingsBody}
              action={
                <Button asChild>
                  <Link href="/dashboard/listings/new">{d.addFirst}</Link>
                </Button>
              }
            />
          )}
        </>
      ) : (
        <>
          <section>
            <h2 className="label mb-4">{d.quickActions}</h2>
            <div className="grid gap-px bg-ink-200 sm:grid-cols-2">
              <Stat label={d.savedProperties} value={favourites.count ?? 0} icon={Heart} tone="flat" />
              <Stat label={d.savedSearches} value={0} icon={Search} tone="flat" />
            </div>
          </section>

          <EmptyState
            icon={<Search className="size-6" />}
            title={d.startTitle}
            description={d.startBody}
            action={
              <Button asChild>
                <Link href="/search">{d.startCta}</Link>
              </Button>
            }
          />

          {/* A customer can become a seller at any time. Surfacing it here beats
              hiding it in settings, since most people only realise later. */}
          <div className="ticked border border-ink-900 bg-sand-50 p-6">
            <p className="label">{d.sellingTitle}</p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">{d.sellingBody}</p>
            <Button asChild variant="secondary" size="sm" className="mt-5">
              <Link href="/dashboard/listings/new">
                {d.addProperty} <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The figure is set extra-light and large against a small uppercase label: the
 * same weight-contrast pairing the property cards and the land calculator use,
 * so a number reads the same way everywhere in the product.
 */
function Stat({
  label,
  value,
  icon: Icon,
  tone = 'flat',
  href,
}: {
  label: string;
  value: number;
  icon?: React.ElementType;
  tone?: 'good' | 'pending' | 'flat';
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-ink-400">
        {Icon && <Icon aria-hidden className="size-3.5" />}
        <p className="label">{label}</p>
      </div>
      <p
        className={cn(
          'nums mt-3 text-4xl leading-none font-extralight',
          tone === 'pending' && 'text-ochre-700',
          tone === 'good' && value > 0 && 'text-emerald-700',
          (tone === 'flat' || (tone === 'good' && value === 0)) && 'text-ink-900',
        )}
      >
        {value.toLocaleString('en-IN')}
      </p>
      <span
        aria-hidden
        className="absolute inset-x-5 bottom-0 h-px origin-left scale-x-0 bg-ink-900 transition-transform duration-200 group-hover:scale-x-100"
      />
    </>
  );

  const className = "group relative bg-white p-5 transition-colors hover:bg-ink-50/60 block";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
