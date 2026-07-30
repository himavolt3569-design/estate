'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/primitives';

import { resolveReport } from '../actions';

/**
 * Three outcomes, not two, so this does not reuse the approve/reject control.
 *
 * "Investigating" exists because some reports genuinely take days to settle,
 * and without it the only way to acknowledge one is to close it. Claiming a
 * report also assigns it, so two admins do not work the same complaint.
 */
export function ReportDecision({ reportId, status }: { reportId: string; status: string }) {
  const [open, setOpen] = React.useState<'none' | 'resolved' | 'dismissed'>('none');
  const [resolution, setResolution] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  function run(next: 'investigating' | 'resolved' | 'dismissed') {
    startTransition(async () => {
      const result = await resolveReport({
        reportId,
        status: next,
        resolution: next === 'investigating' ? undefined : resolution.trim(),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        next === 'investigating' ? 'Marked as being looked at.' : 'Closed, and recorded.',
      );
      setOpen('none');
      setResolution('');
    });
  }

  if (open === 'none') {
    return (
      <div className="flex flex-wrap gap-2">
        {status !== 'investigating' && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => run('investigating')}
          >
            {pending ? 'Working…' : 'I am looking at this'}
          </Button>
        )}
        <Button type="button" variant="approve" size="sm" onClick={() => setOpen('resolved')}>
          Action taken
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen('dismissed')}>
          No action needed
        </Button>
      </div>
    );
  }

  const tooShort = resolution.trim().length < 5;

  return (
    <div className="w-full space-y-2.5">
      <label className="block">
        <span className="label mb-1.5 block">
          {open === 'resolved' ? 'What did you do?' : 'Why is no action needed?'}
        </span>
        <Textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={2}
          autoFocus
          aria-invalid={tooShort && resolution.length > 0}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending || tooShort} onClick={() => run(open)}>
          {pending ? 'Saving…' : 'Close this report'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setOpen('none');
            setResolution('');
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
