'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

export function FadeIn({
  children,
  delay = 0,
  duration = 0.8,
  stagger = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  stagger?: number;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  // We only install GSAP if it's not present, but useGSAP is from @gsap/react.
  // Wait, I need to check if @gsap/react is in package.json.
  // I will check that in a bit. Let's write this file first.
  useGSAP(
    () => {
      if (!container.current) return;
      
      gsap.fromTo(
        container.current.children,
        {
          opacity: 0,
          y: 20,
        },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          stagger,
          ease: 'power3.out',
          clearProps: 'all',
        }
      );
    },
    { scope: container }
  );

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
}
