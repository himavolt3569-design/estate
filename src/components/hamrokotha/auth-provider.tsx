'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, configured, db } from '@/lib/firebase/client';
import type { Profile } from '@/lib/firebase/types';

type AuthState = { user: User | null; profile: Profile | null; loading: boolean; signIn: () => Promise<void>; logOut: () => Promise<void> };
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(configured);
  useEffect(() => {
    if (!configured) return;
    let stopProfile = () => {};
    const stop = onAuthStateChanged(auth(), next => {
      stopProfile(); setUser(next); setProfile(null); setLoading(false);
      if (next) stopProfile = onSnapshot(doc(db(), 'users', next.uid), snap => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } as Profile : null);
      });
    });
    return () => { stopProfile(); stop(); };
  }, []);
  return <Context.Provider value={{ user, profile, loading,
    signIn: async () => { await signInWithPopup(auth(), new GoogleAuthProvider()); },
    logOut: async () => { await signOut(auth()); },
  }}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
