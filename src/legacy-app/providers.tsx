'use client';

// Client boundary: TanStack Query needs a client-side cache. Kept as thin as
// possible. It renders `children` through, so every server component nested
// inside it stays a server component.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Search results tolerate a minute of staleness; this stops a
            // refetch storm when a user pans the map back and forth.
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
