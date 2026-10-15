'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  Building2,
  CreditCard,
  Flag,
  Gauge,
  Heart,
  Image,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Menu,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { cn } from '@/lib/utils';

import type { NavItem } from './SidebarNav';

const ICON_MAP: Record<string, React.ElementType> = {
  Building2,
  CreditCard,
  Flag,
  Gauge,
  Heart,
  Image,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
};

/**
 * The phone's dashboard navigation.
 *
 * The bar it replaces took `[...nav, ...settings].slice(0, 5)`, which quietly
 * put every link past the fifth one out of reach on a phone: the master admin
 * could not open the audit log or the security settings at all, and a seller
 * could not reach their payment details. Anyone on a phone was using a
 * different, smaller product.
 *
 * So: four destinations in the bar, and everything else — including the ones
 * that were being dropped — behind one "More" sheet. Four rather than five
 * because a 375px screen divided five ways gives each label 75px, which is not
 * enough for "All properties" at a readable size.
 */
export function MobileDashboardNav({
  primary,
  rest,
  moreLabel = 'More',
  signOut,
}: {
  primary: NavItem[];
  rest: NavItem[];
  moreLabel?: string;
  /** Rendered at the foot of the sheet. The sign-out control is a client island. */
  signOut?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // A route change must close the sheet, otherwise tapping a link inside it
  // leaves the overlay covering the page it just navigated to.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));

  const restIsActive = rest.some((item) => isActive(item.href));
  const restBadge = rest.reduce((sum, item) => sum + (item.badge ?? 0), 0);

  return (
    <>
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200 bg-white/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {primary.map((item) => (
            <li key={item.href} className="min-w-0 flex-1">
              <Tab
                href={item.href}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                active={isActive(item.href)}
              />
            </li>
          ))}

          {rest.length > 0 && (
            <li className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={cn(
                  'relative flex h-full w-full min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors',
                  restIsActive ? 'text-crimson-700' : 'text-ink-500',
                )}
              >
                <span className="relative">
                  <Menu aria-hidden className="size-5" />
                  {restBadge > 0 && (
                    <span
                      aria-hidden
                      className="absolute -top-1 -right-1.5 size-2 rounded-full bg-crimson-600 ring-2 ring-white"
                    />
                  )}
                </span>
                <span className="line-clamp-1 text-[10px] leading-tight font-medium">
                  {moreLabel}
                </span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-100 bg-ink-900/40 backdrop-blur-[2px] lg:hidden" />
          <Dialog.Content
            className={cn(
              'fixed inset-x-0 bottom-0 z-100 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-ink-200 bg-white',
              'pb-[max(1rem,env(safe-area-inset-bottom))] shadow-floating lg:hidden',
            )}
          >
            <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-ink-100 bg-white px-5 py-4">
              <Dialog.Title className="text-base font-semibold text-ink-900">
                {moreLabel}
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close"
                className="flex size-9 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                <X aria-hidden className="size-4.5" />
              </Dialog.Close>
            </div>

            <ul className="p-3">
              {rest.map((item) => {
                const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
                const active = isActive(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                        active
                          ? 'bg-crimson-50 text-crimson-800'
                          : 'text-ink-700 active:bg-ink-100',
                      )}
                    >
                      <Icon
                        aria-hidden
                        className={cn('size-4.5 shrink-0', active ? 'text-crimson-600' : 'text-ink-400')}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="nums flex min-w-5 shrink-0 items-center justify-center rounded-full bg-crimson-600 px-1.5 py-0.5 text-2xs font-semibold text-white">
                          {item.badge > 99 ? '99+' : item.badge}
                          <span className="sr-only">unread</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {signOut && <div className="border-t border-ink-100 px-5 py-4">{signOut}</div>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function Tab({
  href,
  icon,
  label,
  badge,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  badge?: number;
  active: boolean;
}) {
  const Icon = ICON_MAP[icon] ?? LayoutDashboard;

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      // 56px tall, which clears the 44px minimum with the label inside it.
      className={cn(
        'relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors',
        active ? 'text-crimson-700' : 'text-ink-500',
      )}
    >
      {active && (
        <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-crimson-600" />
      )}
      <span className="relative">
        <Icon aria-hidden className="size-5" />
        {badge != null && badge > 0 && (
          <span className="nums absolute -top-1.5 -right-2 flex min-w-4 items-center justify-center rounded-full bg-crimson-600 px-1 text-[9px] leading-4 font-semibold text-white ring-2 ring-white">
            {badge > 9 ? '9+' : badge}
            <span className="sr-only">unread</span>
          </span>
        )}
      </span>
      <span className="line-clamp-1 text-[10px] leading-tight font-medium">{label}</span>
    </Link>
  );
}
