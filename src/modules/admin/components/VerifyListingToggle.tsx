'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Seal } from '@/components/brand/Seal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/primitives';

import { adminSetListingVerified } from '../master';

/**
 * The verified seal, set and lifted by the master admin.
 *
 * Nothing on the platform could write properties.verified_at before this: the
 * moderation queue publishes and rejects, and there was no other listing screen.
 * A seal is a claim the platform makes on a seller's behalf, so it takes a
 * reason, and that reason lands in the audit log with the actor attached.
 */
export function VerifyListingToggle({
  propertyId,
  verified,
}: {
  propertyId: string;
  verified: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();

  const tooShort = reason.trim().length < 6;

  function submit() {
    startTransition(async () => {
      const result = await adminSetListingVerified({
        propertyId,
        verified: !verified,
        reason: reason.trim(),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(verified ? 'Seal lifted.' : 'Listing verified.');
      setOpen(false);
      setReason('');
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant={verified ? 'ghost' : 'approve'}
        onClick={() => setOpen(true)}
      >
        {verified ? 'Lift seal' : 'Verify'}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="label mb-1.5 block">
          {verified ? 'Why is the seal being lifted?' : 'What was checked?'}
        </span>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          autoFocus
          placeholder={
            verified
              ? 'The lalpurja provided does not match the plot.'
              : 'Lalpurja sighted and the plot number matches the survey record.'
          }
          aria-invalid={tooShort && reason.length > 0}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={verified ? 'destructive' : 'approve'}
          disabled={pending || tooShort}
          onClick={submit}
        >
          {pending ? 'Saving…' : verified ? 'Confirm lift' : 'Confirm verified'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setReason('');
          }}
        >
          Cancel
        </Button>
        {tooShort && reason.length > 0 && (
          <span className="text-2xs text-ink-400">A few more characters</span>
        )}
      </div>
    </div>
  );
}

export function VerifiedMark() {
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-700">
      <Seal size={12} /> Verified
    </span>
  );
}
