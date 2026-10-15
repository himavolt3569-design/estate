'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, Star, Trash2 } from 'lucide-react';
import { useSignedInText } from './signed-in-copy';

export type EditablePhoto = { id: string; url: string; file?: File };

export function ListingPhotoEditor({ photos, onChange, disabled }: { photos: EditablePhoto[]; onChange: (next: EditablePhoto[]) => void; disabled: boolean }) {
  const tr = useSignedInText();
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  const add = (files: File[]) => {
    const accepted: EditablePhoto[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/') || file.size >= 5 * 1024 * 1024) { rejected.push(file.name); continue; }
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      accepted.push({ id: crypto.randomUUID(), url, file });
    }
    if (accepted.length) onChange([...photos, ...accepted]);
    setError(rejected.length ? `Use images under 5 MB: ${rejected.join(', ')}` : '');
  };
  const move = (index: number, nextIndex: number) => {
    const next = [...photos];
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    onChange(next);
  };
  const remove = (id: string) => {
    const item = photos.find(photo => photo.id === id);
    if (item?.file) { URL.revokeObjectURL(item.url); urls.current = urls.current.filter(url => url !== item.url); }
    onChange(photos.filter(photo => photo.id !== id));
  };
  return <aside className="rounded-xl border border-ink-100 bg-ink-50 p-4"><div className="flex items-center gap-2"><Camera aria-hidden className="size-5 text-royal-700" /><h2 className="font-semibold">{tr('Rental photos')}</h2></div><p className="mt-2 text-xs text-ink-500">{tr('The first image is the cover. Reorder, remove, or add photos before saving.')}</p><div className="mt-4 grid grid-cols-2 gap-2">{photos.map((photo, index) => <div key={photo.id} className="overflow-hidden rounded-lg border border-ink-200 bg-white"><div className="relative aspect-square"><img src={photo.url} alt={`Rental photo ${index + 1}`} className="h-full w-full object-cover" />{index === 0 && <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-royal-900/90 px-2 py-1 text-[10px] text-white"><Star aria-hidden className="size-3" /> Cover</span>}</div><div className="flex justify-between p-1"><button type="button" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={`Move photo ${index + 1} earlier`} className="rounded p-1 disabled:opacity-30"><ArrowUp aria-hidden className="size-4" /></button><button type="button" disabled={disabled || index === photos.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move photo ${index + 1} later`} className="rounded p-1 disabled:opacity-30"><ArrowDown aria-hidden className="size-4" /></button><button type="button" disabled={disabled} onClick={() => remove(photo.id)} aria-label={`Remove photo ${index + 1}`} className="rounded p-1 text-clay-700 disabled:opacity-30"><Trash2 aria-hidden className="size-4" /></button></div></div>)}</div><input ref={input} type="file" accept="image/*" multiple className="sr-only" onChange={event => { add(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} /><button type="button" disabled={disabled} onClick={() => input.current?.click()} className="mt-4 w-full rounded-lg border border-dashed border-royal-300 bg-white px-3 py-3 text-sm font-medium text-royal-800 disabled:opacity-50">{tr('Add photos')}</button>{error && <p role="alert" className="mt-2 text-xs text-clay-700">{error}</p>}</aside>;
}
