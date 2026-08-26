'use client';

import { MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { startConversation } from '@/modules/messaging/actions';

export function MessageOwnerButton({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleMessage = () => {
    startTransition(async () => {
      try {
        const result = await startConversation({ propertyId });
        if (result.ok && result.data) {
          router.push(`/dashboard/messages/${result.data.threadId}`);
        } else if (!result.ok) {
          toast.error(result.error ?? 'Failed to start conversation');
        }
      } catch (err: any) {
        toast.error('Could not start conversation');
      }
    });
  };

  return (
    <Button variant="secondary" onClick={handleMessage} disabled={isPending} className="w-full">
      <MessageSquare className="mr-2 size-4" />
      Message Owner
    </Button>
  );
}
