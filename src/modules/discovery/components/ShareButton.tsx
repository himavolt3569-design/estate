'use client';

import { Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export function ShareButton({
  title,
  text,
  url,
  label = 'Share',
  className,
}: {
  title: string;
  text: string;
  url: string;
  label?: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function onClick() {
    // Try native share first on mobile (which usually includes WhatsApp)
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title, text, url }).catch((err) => {
        // User aborted or unsupported
        console.error(err);
      });
      return;
    }

    // Fallback explicitly to WhatsApp
    const message = encodeURIComponent(`${title}\n${text}\n${url}`);
    
    // Simple mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    const waUrl = isMobile 
      ? `whatsapp://send?text=${message}`
      : `https://web.whatsapp.com/send?text=${message}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  // SSR mismatch prevention
  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-sm border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600',
        className,
      )}
    >
      <Share2 aria-hidden className="size-4" />
      {label}
    </button>
  );
}
