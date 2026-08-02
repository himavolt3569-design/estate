'use client';

import { KeyRound, Loader2, Mail, ShieldAlert, UserCog } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Avatar } from '@/components/media/Avatar';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/select-menu';
import { cn } from '@/lib/utils';

import {
  adminChangeUserEmail,
  adminSetUserPassword,
  adminSetUserRole,
  adminSetUserStatus,
  adminUpdateUserProfile,
} from '../master';

export type Person = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
};

type Tab = 'details' | 'email' | 'password' | 'access';

const TABS: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
  { key: 'details', label: 'Details', icon: UserCog },
  { key: 'email', label: 'Sign-in email', icon: Mail },
  { key: 'password', label: 'Password', icon: KeyRound },
  { key: 'access', label: 'Role and access', icon: ShieldAlert },
];

/**
 * Everything the master admin can do to one account, in one place.
 *
 * Each action asks for a reason before it will run. That is not ceremony: these
 * are the operations that would look identical to an account takeover in a log
 * that only recorded what changed, so the "why" is a required field and it is
 * written to the audit trail with the actor's id.
 */
export function PersonSheet({ person, onDone }: { person: Person; onDone: () => void }) {
  const [tab, setTab] = useState<Tab>('details');
  const [busy, setBusy] = useState(false);

  const [fullName, setFullName] = useState(person.full_name ?? '');
  const [phone, setPhone] = useState(person.phone ?? '');
  const [email, setEmail] = useState(person.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(person.role);
  const [status, setStatus] = useState(person.status);
  const [reason, setReason] = useState('');

  const isMaster = person.role === 'platform_admin';

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (reason.trim().length < 6) {
      toast.error('Say why first. It goes in the record.');
      return;
    }

    setBusy(true);
    const result = await fn();
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error ?? 'That did not work.');
      return;
    }

    toast.success(success);
    setPassword('');
    setReason('');
    onDone();
  }

  return (
    <div className="thread-top overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-raised">
      <div className="border-b border-ink-100 px-6 pt-6 pb-0">
        <div className="flex items-center gap-3">
          <Avatar src={person.avatar_url} name={person.full_name} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-ink-900">
              {person.full_name || 'Unnamed account'}
            </p>
            <p className="mt-0.5 text-sm text-ink-500">{person.email ?? 'No email on file'}</p>
          </div>
        </div>

        <div className="mt-5 flex gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                'flex items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                tab === item.key
                  ? 'border-b-2 border-crimson-600 text-crimson-700'
                  : 'border-b-2 border-transparent text-ink-500 hover:text-ink-900',
              )}
            >
              <item.icon aria-hidden className="size-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5 p-6">
        {isMaster && (
          <p className="rounded-xl border border-marigold-200 bg-marigold-50 px-4 py-3 text-sm text-marigold-900">
            This is the master admin seat. Its role and status are locked — the only supported way
            to move the seat is to hand it over.
          </p>
        )}

        {tab === 'details' && (
          <>
            <Field label="Full name" htmlFor="p-name" required>
              <Input id="p-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="p-phone">
              <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </>
        )}

        {tab === 'email' && (
          <Field
            label="Sign-in email"
            htmlFor="p-email"
            required
            hint="Confirmed straight away — they will not get a verification mail"
          >
            <Input
              id="p-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        )}

        {tab === 'password' && (
          <>
            <Field
              label="New password"
              htmlFor="p-password"
              required
              hint="At least 12 characters"
            >
              <Input
                id="p-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Type the password you will read out to them"
              />
            </Field>
            <p className="text-xs leading-relaxed text-ink-500">
              Read this to them over the phone and ask them to change it once they are in. The
              password itself is never stored in the record — only that you changed it, and why.
            </p>
          </>
        )}

        {tab === 'access' && (
          <>
            <Field label="Role" htmlFor="p-role">
              <SelectMenu
                id="p-role"
                value={role}
                onValueChange={setRole}
                disabled={isMaster}
                options={[
                  { value: 'customer', label: 'Customer', hint: 'Can search and save' },
                  { value: 'property_owner', label: 'Owner', hint: 'Can list their own property' },
                  { value: 'agent', label: 'Agent', hint: 'Lists on behalf of owners' },
                  { value: 'agency_manager', label: 'Agency manager', hint: 'Runs an agency' },
                ]}
              />
            </Field>

            <Field label="Account status" htmlFor="p-status">
              <SelectMenu
                id="p-status"
                value={status}
                onValueChange={setStatus}
                disabled={isMaster}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended', hint: 'Cannot post or message' },
                  { value: 'banned', label: 'Banned' },
                ]}
              />
            </Field>
          </>
        )}

        <Field label="Why are you doing this?" htmlFor="p-reason" required>
          <Input
            id="p-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Owner called, lost access to their email"
          />
        </Field>

        <div className="flex flex-wrap gap-3 border-t border-ink-100 pt-5">
          {tab === 'details' && (
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () => adminUpdateUserProfile({ userId: person.id, fullName, phone, reason }),
                  'Details saved.',
                )
              }
            >
              {busy && <Loader2 aria-hidden className="animate-spin" />} Save details
            </Button>
          )}

          {tab === 'email' && (
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () => adminChangeUserEmail({ userId: person.id, email, reason }),
                  'Sign-in email changed.',
                )
              }
            >
              {busy && <Loader2 aria-hidden className="animate-spin" />} Change email
            </Button>
          )}

          {tab === 'password' && (
            <Button
              disabled={busy || password.length < 12}
              onClick={() =>
                void run(
                  () => adminSetUserPassword({ userId: person.id, password, reason }),
                  'Password changed.',
                )
              }
            >
              {busy && <Loader2 aria-hidden className="animate-spin" />} Set password
            </Button>
          )}

          {tab === 'access' && (
            <>
              <Button
                disabled={busy || isMaster || role === person.role}
                onClick={() =>
                  void run(
                    () => adminSetUserRole({ userId: person.id, role: role as never, reason }),
                    'Role changed.',
                  )
                }
              >
                Change role
              </Button>
              <Button
                variant={status === 'active' ? 'approve' : 'destructive'}
                disabled={busy || isMaster || status === person.status}
                onClick={() =>
                  void run(
                    () =>
                      adminSetUserStatus({ userId: person.id, status: status as never, reason }),
                    'Account status changed.',
                  )
                }
              >
                {status === 'active' ? 'Reinstate account' : 'Apply status'}
              </Button>
            </>
          )}

          <Button variant="ghost" onClick={onDone} disabled={busy}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
