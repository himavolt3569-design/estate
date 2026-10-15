'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmailAuthProvider, GoogleAuthProvider, createUserWithEmailAndPassword, linkWithCredential, linkWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Surface } from '@/components/ui/primitives';
import { useAuth } from '@/components/merokotha/auth-provider';
import { useSiteText } from '@/components/merokotha/site-language';
import { auth, configured } from '@/lib/firebase/client';
import { createProfile, updateProfile, uploadImages } from '@/lib/firebase/actions';

type Mode = 'sign-in' | 'sign-up' | 'reset';

function safeNext(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/dashboard';
}

function readableAuthError(cause: unknown, t: (english: string, nepali: string) => string) {
  const code = (cause as { code?: string } | null)?.code;
  if (code === 'auth/operation-not-allowed') return t('This sign-in method is not enabled in Firebase yet.', 'यो साइन इन तरिका Firebase मा अझै सक्रिय छैन।');
  if (code === 'auth/unauthorized-domain') return t('This website domain must be authorized in Firebase Authentication.', 'यो वेबसाइट डोमेन Firebase Authentication मा अनुमति दिनुपर्छ।');
  if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use' || code === 'auth/account-exists-with-different-credential') return t('An account already uses this email or sign-in method. Sign in to that account first; accounts cannot be merged automatically.', 'यो इमेल वा साइन इन तरिका अर्को खातामा प्रयोग भएको छ। पहिले त्यो खातामा साइन इन गर्नुहोस्; खाताहरू स्वतः मिलाउन सकिँदैन।');
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return t('Email or password is incorrect.', 'इमेल वा पासवर्ड गलत छ।');
  if (code === 'auth/weak-password') return t('Choose a stronger password.', 'अझ बलियो पासवर्ड छान्नुहोस्।');
  if (code === 'auth/invalid-email') return t('Enter a valid email address.', 'मान्य इमेल ठेगाना राख्नुहोस्।');
  if (code === 'auth/network-request-failed') return t('Check your connection and try again.', 'इन्टरनेट जाँच गरी फेरि प्रयास गर्नुहोस्।');
  if (code === 'auth/too-many-requests') return t('Too many attempts. Please try again later.', 'धेरै पटक प्रयास भयो। पछि फेरि प्रयास गर्नुहोस्।');
  if (code === 'auth/requires-recent-login') return t('For security, sign out and sign in again before changing sign-in methods.', 'सुरक्षाका लागि साइन आउट गरी फेरि साइन इन गरेपछि साइन इन तरिका बदल्नुहोस्।');
  if (code === 'auth/popup-closed-by-user') return '';
  return cause instanceof Error ? cause.message : t('Authentication failed. Please try again.', 'साइन इन असफल भयो। फेरि प्रयास गर्नुहोस्।');
}

function SignInForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const t = useSiteText();
  const { user, loading, signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [role, setRole] = useState('customer');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const hasGoogle = user?.providerData.some(provider => provider.providerId === 'google.com') ?? false;
  const hasPassword = user?.providerData.some(provider => provider.providerId === 'password') ?? false;

  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);
  useEffect(() => {
    if (!photo) { setPhotoPreview(''); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const changeMode = (value: Mode) => {
    setMode(value); setPassword(''); setConfirmPassword(''); setError(''); setInfo('');
  };

  const useGoogle = async () => {
    setBusy(true); setError(''); setInfo('');
    try {
      if (user) await linkWithPopup(user, new GoogleAuthProvider());
      else await signIn();
      router.replace(next);
    } catch (cause) {
      setError(readableAuthError(cause, t));
    } finally { setBusy(false); }
  };

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !configured) return;
    const address = (user?.email || email).trim().toLowerCase();
    if (mode === 'sign-up' || user) {
      if (password.length < 6) { setError(t('Use at least 6 characters for your password.', 'पासवर्डमा कम्तीमा ६ अक्षर राख्नुहोस्।')); return; }
      if (password !== confirmPassword) { setError(t('Passwords do not match.', 'पासवर्डहरू मिलेनन्।')); return; }
    }
    setBusy(true); setError(''); setInfo('');
    try {
      if (user) {
        await linkWithCredential(user, EmailAuthProvider.credential(address, password));
      } else if (mode === 'sign-up') {
        const created = await createUserWithEmailAndPassword(auth(), address, password);
        try {
          await createProfile(created.user, { name: name.trim(), phone: phone.trim(), location: location.trim(), role, contactEmail: address });
        } catch {
          toast.warning(t('Account created. Please finish your profile in the dashboard.', 'खाता बन्यो। कृपया ड्यासबोर्डमा प्रोफाइल पूरा गर्नुहोस्।'));
          router.replace('/dashboard');
          return;
        }
        if (photo) {
          try {
            const [photoUrl] = await uploadImages(`users/${created.user.uid}`, [photo]);
            await updateProfile(created.user.uid, { name: name.trim(), location: location.trim(), photoUrl });
          } catch {
            toast.warning(t('Account created, but the photo could not be saved. You can add it in your profile.', 'खाता बन्यो तर फोटो सेभ भएन। प्रोफाइलबाट पछि थप्न सक्नुहुन्छ।'));
          }
        }
      } else if (mode === 'reset') {
        const firebaseAuth = auth();
        firebaseAuth.languageCode = document.documentElement.lang === 'ne' ? 'ne' : 'en';
        await sendPasswordResetEmail(firebaseAuth, address);
        setInfo(t(`Reset requested for ${address}. If it has an email/password account, check Inbox and Spam.`, `${address} का लागि पासवर्ड बदल्ने अनुरोध गरियो। इमेल/पासवर्ड खाता भए Inbox र Spam हेर्नुहोस्।`));
        return;
      } else {
        await signInWithEmailAndPassword(auth(), address, password);
      }
      router.replace(next);
    } catch (cause) {
      setError(readableAuthError(cause, t));
    } finally { setBusy(false); }
  };

  return <Surface className="mx-auto max-w-lg space-y-6 p-6 sm:p-8">
    <div><h1 className="text-2xl font-semibold">{user ? t('Your sign-in methods', 'साइन इन गर्ने तरिकाहरू') : mode === 'sign-up' ? t('Create a MeroKotha account', 'MeroKotha खाता बनाउनुहोस्') : mode === 'reset' ? t('Reset your password', 'पासवर्ड बदल्नुहोस्') : t('Sign in to MeroKotha', 'MeroKotha मा साइन इन गर्नुहोस्')}</h1><p className="mt-2 text-sm text-ink-600">{user ? t('Add another method to this account to keep your listings and messages together.', 'अर्को तरिका यही खातामा जोडेर विज्ञापन र सन्देशहरू एकै ठाउँमा राख्नुहोस्।') : t('Choose email and password or Google. Sign-in starts only when you select a method.', 'इमेल र पासवर्ड वा Google छान्नुहोस्। तपाईंले तरिका छानेपछि मात्र साइन इन सुरु हुन्छ।')}</p></div>
    {!configured && <p role="alert" className="text-sm text-clay-700">{t('Firebase is not configured for this website.', 'यस वेबसाइटमा Firebase कन्फिगर गरिएको छैन।')}</p>}
    {(!user || !hasGoogle) && <Button type="button" className="w-full" disabled={busy || loading || !configured} onClick={() => void useGoogle()}>{user ? t('Link Google to this account', 'यो खातामा Google जोड्नुहोस्') : t('Continue with Google', 'Google बाट अगाडि बढ्नुहोस्')}</Button>}
    {!user && <p className="text-xs text-ink-500">{t('Already use MeroKotha on Android? Use the same Google account to keep your existing profile and listings.', 'Android मा MeroKotha चलाउनुहुन्छ? आफ्नो पुरानो प्रोफाइल र विज्ञापन पाउन उही Google खाता प्रयोग गर्नुहोस्।')}</p>}
    {(!user || !hasPassword) && <div className="border-t border-ink-100 pt-5">
      {!user && mode !== 'reset' && <div className="flex gap-2"><Button type="button" variant={mode === 'sign-in' ? 'secondary' : 'ghost'} onClick={() => changeMode('sign-in')}>{t('Sign in', 'साइन इन')}</Button><Button type="button" variant={mode === 'sign-up' ? 'secondary' : 'ghost'} onClick={() => changeMode('sign-up')}>{t('Create account', 'खाता बनाउनुहोस्')}</Button></div>}
      {user && <h2 className="font-semibold">{t('Add email and password', 'इमेल र पासवर्ड थप्नुहोस्')}</h2>}
      {!user && mode === 'reset' && <p className="text-sm text-ink-600">{t('Enter the email used for your email/password account. Google-only accounts should continue with Google.', 'इमेल/पासवर्ड खातामा प्रयोग भएको इमेल राख्नुहोस्। Google मात्र प्रयोग गर्नेहरूले Google बाट साइन इन गर्नुहोस्।')}</p>}
      <form className="mt-4 space-y-4" onSubmit={event => void submitEmail(event)}>
        {!user && mode === 'sign-up' && <>
          <Field label={t('Full name', 'पूरा नाम')} htmlFor="auth-name"><Input id="auth-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required /></Field>
          <Field label={t('Phone number (optional)', 'फोन नम्बर (ऐच्छिक)')} htmlFor="auth-phone"><Input id="auth-phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} /></Field>
          <Field label={t('Location', 'ठाउँ')} htmlFor="auth-location"><Input id="auth-location" autoComplete="address-level2" value={location} onChange={event => setLocation(event.target.value)} required /></Field>
          <Field label={t('I am mainly here to', 'म मुख्यतया यहाँ किन छु')} htmlFor="auth-role"><Select id="auth-role" value={role} onChange={event => setRole(event.target.value)}><option value="customer">{t('Find a place', 'घरजग्गा खोज्न')}</option><option value="owner">{t('Post a rental', 'घरजग्गा राख्न')}</option><option value="agent">{t('Work as an agent', 'एजेन्टको काम गर्न')}</option></Select></Field>
          <div><label htmlFor="auth-photo" className="block text-sm font-medium text-ink-700">{t('Profile photo (optional)', 'प्रोफाइल फोटो (ऐच्छिक)')}</label><div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-ink-200 p-3"><div className="size-16 shrink-0 overflow-hidden rounded-xl bg-ink-100">{photoPreview ? <img src={photoPreview} alt={t('Photo preview', 'फोटो पूर्वावलोकन')} className="h-full w-full object-cover" /> : null}</div><div className="min-w-0"><Input id="auth-photo" type="file" accept="image/*" className="h-auto max-w-full border-0 p-0 text-xs shadow-none file:mr-2 file:rounded file:border-0 file:bg-royal-50 file:px-2 file:py-1 file:text-royal-800" onChange={event => { const file = event.target.files?.[0] || null; if (file && (!file.type.startsWith('image/') || file.size >= 5 * 1024 * 1024)) { setError(t('Choose an image under 5 MB.', '५ MB भन्दा सानो फोटो छान्नुहोस्।')); event.target.value = ''; setPhoto(null); return; } setError(''); setPhoto(file); }} /><p className="mt-1 text-xs text-ink-500">{t('Image under 5 MB', '५ MB भन्दा सानो फोटो')}</p></div></div></div>
        </>}
        <Field label={t('Email address', 'इमेल ठेगाना')} htmlFor="auth-email"><Input id="auth-email" type="email" autoComplete="email" value={user?.email || email} onChange={event => setEmail(event.target.value)} readOnly={Boolean(user?.email)} required /></Field>
        {mode !== 'reset' && <Field label={t('Password', 'पासवर्ड')} htmlFor="auth-password"><Input id="auth-password" type="password" autoComplete={user || mode === 'sign-up' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} required /></Field>}
        {(user || mode === 'sign-up') && <p className="text-xs text-ink-500">{t('Use at least 6 characters. Your Firebase project may require a stronger password.', 'कम्तीमा ६ अक्षर प्रयोग गर्नुहोस्। Firebase परियोजनाले अझ बलियो पासवर्ड माग्न सक्छ।')}</p>}
        {(user || mode === 'sign-up') && <Field label={t('Confirm password', 'पासवर्ड पुष्टि गर्नुहोस्')} htmlFor="auth-confirm"><Input id="auth-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></Field>}
        <Button type="submit" disabled={busy || loading || !configured}>{busy ? t('Please wait…', 'कृपया पर्खनुहोस्…') : user ? t('Add password to this account', 'यो खातामा पासवर्ड थप्नुहोस्') : mode === 'sign-up' ? t('Create account', 'खाता बनाउनुहोस्') : mode === 'reset' ? t('Send reset email', 'पासवर्ड बदल्ने इमेल पठाउनुहोस्') : t('Sign in with email', 'इमेलबाट साइन इन')}</Button>
      </form>
      {!user && <div className="mt-4 text-sm">{mode === 'reset' ? <button type="button" className="font-semibold text-royal-700 hover:underline" onClick={() => changeMode('sign-in')}>{t('Back to sign in', 'साइन इनमा फर्कनुहोस्')}</button> : <button type="button" className="font-semibold text-royal-700 hover:underline" onClick={() => changeMode('reset')}>{t('Forgot password?', 'पासवर्ड बिर्सनुभयो?')}</button>}</div>}
    </div>}
    {user && hasGoogle && hasPassword && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{t('Google and email/password are linked to this account.', 'Google र इमेल/पासवर्ड यही खातामा जोडिएका छन्।')}</p>}
    {error && <p role="alert" className="rounded-lg bg-clay-50 p-3 text-sm text-clay-700">{error}</p>}
    {info && <p role="status" className="rounded-lg bg-royal-50 p-3 text-sm text-royal-800">{info}</p>}
    {user && <Button asChild variant="secondary"><Link href={next}>{t('Back to my account', 'मेरो खातामा फर्कनुहोस्')}</Link></Button>}
  </Surface>;
}

export default function SignInPage() {
  return <Suspense fallback={<Surface className="mx-auto max-w-lg p-8">Loading…</Surface>}><SignInForm /></Suspense>;
}
