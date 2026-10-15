'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Heart, Home, LogOut, MapPin, MessageSquare, Plus, Ruler, UserRound, Wallet } from 'lucide-react';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { ParcelMark } from '@/components/brand/Seal';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import type { Locale } from '@/i18n/config';
import { en } from '@/i18n/en';
import { ne } from '@/i18n/ne';
import { Button } from '@/components/ui/button';
import { configured, db, firebaseApp } from '@/lib/firebase/client';
import { useAuth } from './auth-provider';
import { SiteLanguageContext, ui as siteUi } from './site-language';

const browseLinks = [
  { href: '/', label: 'Explore', icon: Home },
  { href: '/emi', label: 'EMI', icon: Wallet },
  { href: '/land-size', label: 'Land size', icon: Ruler },
  { href: '/dashboard?tab=favorites', label: 'Saved', icon: Heart },
  { href: '/dashboard?tab=chats', label: 'Messages', icon: MessageSquare },
] as const;

function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ParcelMark className={light ? 'text-white' : 'text-royal-700'} />
      <span className={`text-[1.0625rem] font-semibold leading-none tracking-[-0.035em] ${light ? 'text-white' : 'text-ink-900'}`}>
        MeroKotha
      </span>
    </span>
  );
}

export function SiteShell({ children, locale: initialLocale }: { children: React.ReactNode; locale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const { user, profile, logOut } = useAuth();
  const pathname = usePathname();
  const t = locale === 'ne' ? ne : en;
  const copy = siteUi[locale];

  useEffect(() => { setLocale(initialLocale); }, [initialLocale]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  useEffect(() => {
    if (!user || !configured) return;
    let stopped = false;
    let unsubscribe = () => {};
    void import('firebase/messaging').then(async ({ getMessaging, isSupported, onMessage }) => {
      if (!(await isSupported()) || stopped) return;
      unsubscribe = onMessage(getMessaging(firebaseApp()), message => {
        toast(message.notification?.title || 'New message', { description: message.notification?.body });
      });
    }).catch(() => {});
    return () => { stopped = true; unsubscribe(); };
  }, [user]);

  const enableNotifications = async () => {
    if (!user || !('Notification' in window) || !('serviceWorker' in navigator)) return;
    try {
      if (await Notification.requestPermission() !== 'granted') throw new Error('Notification permission was not granted.');
      const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
      if (!(await isSupported())) throw new Error('This browser does not support web push.');
      const worker = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const token = await getToken(getMessaging(firebaseApp()), {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: worker,
      });
      if (!token) throw new Error('Firebase did not return a push token.');
      await updateDoc(doc(db(), 'users', user.uid), { fcmTokens: arrayUnion(token) });
      toast.success('Notifications enabled');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not enable notifications');
    }
  };

  return (
    <SiteLanguageContext.Provider value={locale}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-100 focus:bg-royal-800 focus:px-4 focus:py-2 focus:text-sm focus:text-white">
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-8xl items-center gap-3 px-4 sm:h-[68px] sm:gap-6 sm:px-6 lg:px-8">
          <Link href="/" aria-label="MeroKotha home" className="shrink-0"><Brand /></Link>
          <nav aria-label="Main navigation" className="hidden min-w-0 items-center gap-1 lg:flex">
            {browseLinks.slice(0, 4).filter(item => user || !item.href.startsWith('/dashboard')).map(item => (
              <Link key={item.href} href={item.href} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === item.href ? 'bg-crimson-50 text-crimson-700' : 'text-ink-700 hover:bg-crimson-50 hover:text-crimson-700'}`}>
                <item.icon aria-hidden className="size-4 text-ink-400" />{item.href === '/emi' ? t.headerNav.emi : item.href === '/land-size' ? t.headerNav.landSize : item.href === '/' ? copy.explore : copy.saved}
              </Link>
            ))}
            {user && <Link href="/dashboard?tab=chats" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-crimson-50 hover:text-crimson-700"><MessageSquare aria-hidden className="size-4 text-ink-400" />{copy.messages}</Link>}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
            <LanguageSwitcher current={locale} onChange={setLocale} compact className="shrink-0 md:hidden" />
            <LanguageSwitcher current={locale} onChange={setLocale} className="hidden md:flex" />
            {user && profile && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY && <Button variant="ghost" size="sm" className="hidden xl:inline-flex" onClick={() => void enableNotifications()}>Enable alerts</Button>}
            {user ? (
              <>
                <Link href="/dashboard" className="flex size-9 items-center justify-center rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-50 sm:h-auto sm:w-auto sm:max-w-32 sm:truncate sm:px-2 sm:py-2" aria-label="Your account">
                  <UserRound aria-hidden className="size-5 sm:hidden" /><span className="hidden sm:inline">{profile?.name?.split(' ')[0] || copy.account}</span>
                </Link>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => void logOut()}>{copy.signOut}</Button>
                <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Sign out" onClick={() => void logOut()}><LogOut aria-hidden className="size-4" /></Button>
              </>
            ) : <Button asChild variant="secondary" size="sm"><Link href="/sign-in">{copy.signIn}</Link></Button>}
            {user && <Button asChild size="sm" className="hidden shrink-0 sm:inline-flex"><Link href="/dashboard?tab=post">{copy.post}</Link></Button>}
          </div>
        </div>
      </header>
      <nav aria-label="Browse" className="flex gap-2 overflow-x-auto border-b border-ink-100 bg-white px-4 py-2.5 [scrollbar-width:none] sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden">
        {user && <Link href="/dashboard?tab=post" className="flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-ink-800 transition-colors active:bg-crimson-50"><span className="flex size-9 items-center justify-center rounded-full bg-crimson-50 text-crimson-600"><Plus aria-hidden className="size-4.5" /></span><span className="text-[11px] font-medium leading-tight">{locale === 'ne' ? 'राख्नुहोस्' : 'Post'}</span></Link>}
        {browseLinks.filter(item => user || !item.href.startsWith('/dashboard')).map(item => (
          <Link key={item.href} href={item.href} className="flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-ink-800 transition-colors active:bg-crimson-50">
            <span className="flex size-9 items-center justify-center rounded-full bg-crimson-50 text-crimson-600"><item.icon aria-hidden className="size-4.5" /></span>
            <span className="text-[11px] font-medium leading-tight">{item.href === '/emi' ? t.headerNav.emi : item.href === '/land-size' ? t.headerNav.landSize : item.href === '/' ? copy.explore : item.href.includes('favorites') ? copy.saved : copy.messages}</span>
          </Link>
        ))}
      </nav>
      {!configured && <div className="bg-ochre-50 px-4 py-3 text-center text-sm text-ochre-700">Firebase setup is needed. Add the Web App values from .env.example to .env.local.</div>}
      {profile?.isBanned && <div className="bg-clay-50 px-4 py-3 text-center text-sm text-clay-700">This account is suspended. Contact the MeroKotha administrator.</div>}
      <main id="main" className={pathname === '/' ? 'min-h-[60vh]' : 'mx-auto min-h-[60vh] max-w-8xl px-4 py-8 sm:px-6 lg:px-8'}>{children}</main>
      <footer className="border-t border-royal-800 bg-royal-950 text-white">
        <div className="mx-auto max-w-8xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div><Link href="/" aria-label="MeroKotha home"><Brand light /></Link><p className="mt-4 max-w-xs text-sm leading-relaxed text-royal-300">{locale === 'ne' ? 'घरजग्गा खोज्नुहोस्, विज्ञापनदातासँग कुरा गर्नुहोस् र सन्देशहरू एकै ठाउँमा राख्नुहोस्।' : 'Find a place, speak with owners and agents, and keep your conversations in one place.'}</p></div>
            <div><h2 className="label label-light">{copy.browse}</h2><div className="mt-3 flex flex-col gap-2 text-sm text-royal-200"><Link href="/#rentals" className="hover:text-white">{copy.listingsTitle}</Link><Link href="/emi" className="hover:text-white">{t.headerNav.emi}</Link><Link href="/land-size" className="hover:text-white">{t.headerNav.landSize}</Link></div></div>
            <div><h2 className="label label-light">{locale === 'ne' ? 'खाता' : 'Account'}</h2><div className="mt-3 flex flex-col gap-2 text-sm text-royal-200">{user ? <><Link href="/dashboard?tab=post" className="hover:text-white">{copy.post}</Link><Link href="/dashboard?tab=favorites" className="hover:text-white">{copy.saved}</Link><Link href="/dashboard?tab=chats" className="hover:text-white">{copy.messages}</Link></> : <Link href="/sign-in" className="hover:text-white">{copy.signIn}</Link>}</div></div>
            <div><h2 className="label label-light">MeroKotha</h2><div className="mt-3 flex flex-col gap-2 text-sm text-royal-200"><Link href="/agents" className="hover:text-white">{locale === 'ne' ? 'प्रमाणित एजेन्टहरू' : 'Verified agents'}</Link>{user && <><Link href="/dashboard?tab=agent" className="hover:text-white">{locale === 'ne' ? 'एजेन्ट प्रमाणीकरण' : 'Agent verification'}</Link><Link href="/dashboard?tab=profile" className="hover:text-white">{locale === 'ne' ? 'तपाईंको प्रोफाइल' : 'Your profile'}</Link></>}{profile?.role === 'superAdmin' && <Link href="/dashboard?tab=admin" className="hover:text-white">{locale === 'ne' ? 'प्रशासन' : 'Administration'}</Link>}</div></div>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-royal-800 pt-6 text-xs text-royal-400"><p>© {new Date().getFullYear()} MeroKotha</p><p className="flex items-center gap-1"><MapPin aria-hidden className="size-3.5" /> Built for renters in Nepal</p></div>
        </div>
      </footer>
    </SiteLanguageContext.Provider>
  );
}
