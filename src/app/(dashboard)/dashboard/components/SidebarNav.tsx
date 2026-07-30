'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { FadeIn } from '@/components/animations/FadeIn';

import {
  Building2,
  CreditCard,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Building2,
  CreditCard,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Users,
};

export function SidebarNav({ items }: { items: any[] }) {
  const pathname = usePathname();

  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = ICON_MAP[item.icon] || LayoutDashboard;

        return (
          <FadeIn key={item.href} delay={index * 0.05} duration={0.4}>
            <li>
              <Link
                href={item.href}
                prefetch
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-royal-50 text-royal-700 shadow-sm" 
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                )}
              >
                <Icon 
                  aria-hidden 
                  className={cn(
                    "size-4.5 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-royal-600" : "text-ink-400 group-hover:text-ink-600"
                  )} 
                />
                {item.label}
              </Link>
            </li>
          </FadeIn>
        );
      })}
    </ul>
  );
}
