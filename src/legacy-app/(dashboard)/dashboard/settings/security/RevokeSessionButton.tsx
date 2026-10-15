'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { revokeSession } from '@/modules/identity/actions';

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await revokeSession({ sessionId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success('Session revoked.');
          router.refresh();
        })
      }
    >
      {pending ? 'Revoking…' : 'Revoke'}
    </Button>
  );
}
