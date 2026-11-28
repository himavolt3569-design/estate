'use client';

import { useEffect } from 'react';

export function HomeMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stopped = false;
    let revert = () => {};
    void import('gsap').then(({ gsap }) => {
      if (stopped) return;
      const context = gsap.context(() => {
        gsap.fromTo('.home-discovery__intro', { y: 10, opacity: 0.85, filter: 'blur(1px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.65, ease: 'expo.out', clearProps: 'all' });
      });
      revert = () => context.revert();
    });
    return () => { stopped = true; revert(); };
  }, []);
  return null;
}
