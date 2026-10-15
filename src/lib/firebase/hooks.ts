'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { configured, db } from './client';

export function useDocs<T extends { id: string }>(path: string, field?: string, value?: string) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(configured && path));
  useEffect(() => {
    if (!configured || !path || (field && !value)) { setItems([]); setError(''); setLoading(false); return; }
    setItems([]);
    setError('');
    setLoading(true);
    const base = collection(db(), path);
    const target = field && value ? query(base, where(field, '==', value)) : base;
    return onSnapshot(target, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }) as T)); setError(''); setLoading(false);
    }, err => { setError(err.message); setLoading(false); });
  }, [path, field, value]);
  return { items, error, loading };
}
