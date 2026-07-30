'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!container.current) return;
      
      // A very subtle and fast fade-in/up for premium feel
      gsap.fromTo(
        container.current,
        {
          opacity: 0,
          y: 8,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: 'power2.out',
          clearProps: 'all',
        }
      );
    },
    { dependencies: [pathname], scope: container }
  );

  return (
    <div ref={container} className="h-full w-full">
      {children}
    </div>
  );
}
