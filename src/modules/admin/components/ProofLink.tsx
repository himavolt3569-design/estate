'use client';

import { FileImage, LoaderCircle } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { signProof } from '../actions-proof';

/**
 * Opens a payment proof.
 *
 * The URL is minted on demand and lives for sixty seconds. Rendering a link
 * up-front would put a working URL for a private document into the HTML of a
 * page that might be screenshotted, printed or left open, so the URL only
 * exists once someone has actually asked for it.
 */
export function ProofLink({ path }: { path: string }) {
  const [pending, setPending] = React.useState(false);

  async function open() {
    setPending(true);
    const result = await signProof({ path });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    window.open(result.data.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs text-royal-700 underline-offset-4 hover:underline disabled:opacity-50"
    >
      {pending ? (
        <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
      ) : (
        <FileImage aria-hidden className="size-3.5" />
      )}
      View the proof
    </button>
  );
}
