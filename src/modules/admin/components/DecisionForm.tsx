'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/primitives';
import type { ActionResult } from '@/lib/auth/action';

/*
 * The approve/reject control used by moderation, reports and payments.
 *
 * One component because the three queues make the same shape of decision, and
 * three near-identical copies would drift. The reason box opens only for the
 * negative path: requiring a note to approve something is friction that gets
 * routed around, requiring one to reject is the difference between a lister who
 * can fix their listing and a lister who gives up.
 */
export function DecisionForm({
  onDecide,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
  reasonLabel = 'Why? This is sent to them.',
  reasonPlaceholder,
  minReason = 10,
}: {
  onDecide: (decision: 'approve' | 'reject', reason?: string) => Promise<ActionResult<unknown>>;
  approveLabel?: string;
  rejectLabel?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  minReason?: number;
}) {
  const [mode, setMode] = React.useState<'idle' | 'rejecting'>('idle');
  const [reason, setReason] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  function run(decision: 'approve' | 'reject') {
    startTransition(async () => {
      const result = await onDecide(decision, decision === 'reject' ? reason.trim() : undefined);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(decision === 'approve' ? 'Approved.' : 'Rejected, and they have been told.');
      setMode('idle');
      setReason('');
    });
  }

  if (mode === 'rejecting') {
    const tooShort = reason.trim().length < minReason;

    return (
      <div className="space-y-3">
        <label className="block">
          <span className="label mb-2 block">{reasonLabel}</span>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder={reasonPlaceholder}
            aria-invalid={tooShort && reason.length > 0}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending || tooShort}
            onClick={() => run('reject')}
          >
            {pending ? 'Sending…' : `Confirm ${rejectLabel.toLowerCase()}`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              setMode('idle');
              setReason('');
            }}
          >
            Cancel
          </Button>
          {tooShort && (
            <span className="text-2xs text-ink-400">
              {minReason - reason.trim().length} more characters
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="approve"
        size="sm"
        disabled={pending}
        onClick={() => run('approve')}
      >
        {pending ? 'Working…' : approveLabel}
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => setMode('rejecting')}
      >
        {rejectLabel}
      </Button>
    </div>
  );
}
