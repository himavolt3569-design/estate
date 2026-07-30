'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/primitives';
import { ROLE_LABELS } from '@/lib/auth/permissions';

import { reinstateUser, setUserRole, suspendUser } from '../actions';

/*
 * Per-user admin actions.
 *
 * Every one of these requires a written reason, which is not friction for its
 * own sake: the reason lands in the audit log, and an audit trail of role
 * changes with no explanation attached is barely better than none.
 *
 * The dangerous paths (suspend, role change) open a confirm step rather than
 * firing on a single click, because both are easy to trigger by accident on a
 * dense table row and neither is silent for the person on the other end.
 */
type Panel = 'none' | 'suspend' | 'reinstate' | 'role';

export function UserRowActions({
  userId,
  name,
  role,
  status,
}: {
  userId: string;
  name: string;
  role: string;
  status: string;
}) {
  const [panel, setPanel] = React.useState<Panel>('none');
  const [reason, setReason] = React.useState('');
  const [nextRole, setNextRole] = React.useState(role);
  const [pending, startTransition] = React.useTransition();

  function close() {
    setPanel('none');
    setReason('');
    setNextRole(role);
  }

  function submit() {
    const trimmed = reason.trim();

    startTransition(async () => {
      const result =
        panel === 'suspend'
          ? await suspendUser({ userId, reason: trimmed })
          : panel === 'reinstate'
            ? await reinstateUser({ userId, reason: trimmed })
            : await setUserRole({ userId, role: nextRole, reason: trimmed });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        panel === 'suspend'
          ? `${name} is suspended and signed out everywhere.`
          : panel === 'reinstate'
            ? `${name} can sign in again.`
            : `${name} is now ${ROLE_LABELS[nextRole as keyof typeof ROLE_LABELS] ?? nextRole}.`,
      );
      close();
    });
  }

  if (panel === 'none') {
    return (
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setPanel('role')}>
          Change role
        </Button>
        {status === 'suspended' ? (
          <Button type="button" variant="approve" size="sm" onClick={() => setPanel('reinstate')}>
            Reinstate
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setPanel('suspend')}
          >
            Suspend
          </Button>
        )}
      </div>
    );
  }

  const tooShort = reason.trim().length < 5;

  return (
    <div className="space-y-2.5 border-l-2 border-royal-700 pl-3">
      {panel === 'role' && (
        <label className="block">
          <span className="label mb-1.5 block">New role</span>
          <select
            value={nextRole}
            onChange={(e) => setNextRole(e.target.value)}
            className="h-9 w-full rounded-sm border border-ink-200 bg-white px-2 text-sm"
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      {panel === 'suspend' && (
        <p className="text-2xs leading-relaxed text-clay-700">
          This signs {name} out of every device and takes their live listings offline. Their
          listings are not restored automatically if you reinstate them.
        </p>
      )}

      <label className="block">
        <span className="label mb-1.5 block">Reason for the record</span>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          autoFocus
          aria-invalid={tooShort && reason.length > 0}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={panel === 'suspend' ? 'destructive' : 'primary'}
          disabled={pending || tooShort || (panel === 'role' && nextRole === role)}
          onClick={submit}
        >
          {pending ? 'Working…' : 'Confirm'}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={close}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
