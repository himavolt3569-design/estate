'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as React from 'react';

/*
 * The motion layer.
 *
 * Three primitives, no more. Anything that can be done with a CSS transition is
 * done with a CSS transition; GSAP is here only for orchestration that CSS
 * cannot express, which in practice means staggered reveals, drawn strokes and
 * counted figures.
 *
 * Reduced motion is honoured by jumping straight to the end state rather than
 * by playing a shorter animation. A user who asks for no motion gets none.
 */

gsap.registerPlugin(ScrollTrigger);

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reveals any descendant carrying `.reveal` when the container scrolls into
 * view. The `.reveal` class sets opacity:0 in CSS, so there is no flash of
 * final position before the timeline attaches.
 */
export function Reveal({
  children,
  className,
  stagger = 0.055,
  y = 16,
  delay = 0,
  start = 'top 84%',
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
  delay?: number;
  start?: string;
}) {
  const scope = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = scope.current;
    if (!el) return;

    const targets = el.querySelectorAll('.reveal');
    if (targets.length === 0 || prefersReduced()) return;

    const ctx = gsap.context(() => {
      // The hidden state is set here rather than in CSS. useLayoutEffect runs
      // before paint so there is no flash, and it means a failed or blocked
      // bundle leaves the content visible instead of invisible.
      gsap.set(targets, { opacity: 0, y });

      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        ease: 'expo.out',
        stagger,
        delay,
        scrollTrigger: { trigger: el, start, once: true },
      });
    }, el);

    return () => ctx.revert();
  }, [stagger, y, delay, start]);

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}

/**
 * The home page load sequence. Runs immediately rather than on scroll, because
 * the hero is already in view, and holds a single timeline so the headline,
 * search field and diagram resolve as one movement instead of three.
 */
export function HeroSequence({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scope = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = scope.current;
    if (!el) return;

    // Reduced motion leaves the markup exactly as the server rendered it, which
    // is already the finished state. Nothing to set, nothing to play.
    if (prefersReduced()) return;

    const lines = gsap.utils.toArray<HTMLElement>('[data-hero="line"]', el);
    const items = gsap.utils.toArray<HTMLElement>('[data-hero="item"]', el);
    const stats = gsap.utils.toArray<HTMLElement>('[data-hero="stat"]', el);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

      if (lines.length) {
        gsap.set(lines, { opacity: 0, yPercent: 108 });
        tl.to(lines, { opacity: 1, yPercent: 0, duration: 1.05, stagger: 0.09 });
      }
      if (items.length) {
        gsap.set(items, { opacity: 0, y: 14 });
        tl.to(items, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07 }, '-=0.66');
      }
      if (stats.length) {
        gsap.set(stats, { opacity: 0, y: 10 });
        tl.to(stats, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05 }, '-=0.5');
      }
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}

/**
 * Counts a figure up when it enters view. Renders the final value as text on
 * the server so the number is correct without JavaScript and correct for
 * screen readers, which are not served by watching digits spin.
 */
export function CountUp({
  to,
  className,
  suffix = '',
  duration = 1.4,
}: {
  to: number;
  className?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced() || to === 0) return;

    const ctx = gsap.context(() => {
      const counter = { value: 0 };
      gsap.to(counter, {
        value: to,
        duration,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => {
          el.textContent = Math.round(counter.value).toLocaleString('en-IN') + suffix;
        },
      });
    }, el);

    return () => ctx.revert();
  }, [to, duration, suffix]);

  return (
    <span ref={ref} className={className}>
      {to.toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}
