'use client';

import { gsap } from 'gsap';
import * as React from 'react';

/*
 * The parcel diagram.
 *
 * Not decoration. Nepali land is measured by quartering: one ropani divides into
 * four, and each quarter divides again, giving sixteen aana. A buyer reading
 * "4 aana" has to hold that geometry in their head, and diaspora buyers
 * routinely cannot. So the hero draws it.
 *
 * The highlighted quadrant is exactly four aana, the common Kathmandu valley
 * house plot, with a footprint set inside it. Every figure is real: one ropani
 * is 508.72 m².
 *
 * It draws itself the way a surveyor lays a plot out: boundary, then the
 * principal subdivision, then the minor one, then what is built on it.
 *
 * Every hidden state is applied in useLayoutEffect rather than in the markup,
 * so the drawing is complete and correct without JavaScript, and under reduced
 * motion it is simply never touched.
 */
export function ParcelDiagram({ className }: { className?: string }) {
  const scope = React.useRef<SVGSVGElement>(null);

  React.useLayoutEffect(() => {
    const el = scope.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const boundary = el.querySelector('[data-draw="boundary"]');
      const major = gsap.utils.toArray<SVGPathElement>('[data-draw="major"]', el);
      const minor = gsap.utils.toArray<SVGPathElement>('[data-draw="minor"]', el);
      const fades = gsap.utils.toArray<SVGElement>('[data-fade]', el);

      // Perimeter of the 300x300 boundary.
      if (boundary) gsap.set(boundary, { strokeDasharray: 1200, strokeDashoffset: 1200 });
      gsap.set(major, { scaleY: (i: number) => (i === 0 ? 0 : 1), scaleX: (i: number) => (i === 0 ? 1 : 0) });
      gsap.set(minor, {
        scaleY: (i: number) => (i < 2 ? 0 : 1),
        scaleX: (i: number) => (i < 2 ? 1 : 0),
      });
      gsap.set(fades, { opacity: 0 });

      const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.3 });

      tl.to(boundary, { strokeDashoffset: 0, duration: 1.5 })
        .to(major, { scaleX: 1, scaleY: 1, duration: 0.85, stagger: 0.1 }, '-=0.85')
        .to(minor, { scaleX: 1, scaleY: 1, duration: 0.7, stagger: 0.06 }, '-=0.5')
        .to('[data-fade="plot"]', { opacity: 1, duration: 0.6 }, '-=0.3')
        .to('[data-fade="footprint"]', { opacity: 1, duration: 0.5 }, '-=0.35')
        .to('[data-fade="annotation"]', { opacity: 1, duration: 0.5, stagger: 0.08 }, '-=0.3');
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <svg
      ref={scope}
      viewBox="0 0 400 392"
      fill="none"
      className={className}
      role="img"
      aria-label="One ropani divided into sixteen aana, with a four aana plot marked: the common Kathmandu valley house plot."
    >
      {/* --- The four aana plot -------------------------------------------- */}
      <rect data-fade="plot" x="200" y="190" width="150" height="150" className="fill-emerald-400/20" />
      <rect
        data-fade="plot"
        x="200" y="190" width="150" height="150"
        className="stroke-emerald-300"
        strokeWidth="1.4"
      />

      {/* Built footprint inside the plot. */}
      <g data-fade="footprint">
        <rect
          x="228" y="222" width="94" height="86"
          className="fill-emerald-300/25 stroke-emerald-200"
          strokeWidth="1"
        />
        <path d="M228 245h94M262 222v86" className="stroke-emerald-200/45" strokeWidth="0.75" />
      </g>

      {/* --- Minor subdivision: the sixteen aana ---------------------------- */}
      {/* Verticals first, then horizontals: the effect reads the scale index. */}
      <g className="stroke-royal-400/50" strokeWidth="0.75">
        <path data-draw="minor" d="M125 40v300" style={{ transformOrigin: '125px 40px' }} />
        <path data-draw="minor" d="M275 40v300" style={{ transformOrigin: '275px 40px' }} />
        <path data-draw="minor" d="M50 115h300" style={{ transformOrigin: '50px 115px' }} />
        <path data-draw="minor" d="M50 265h300" style={{ transformOrigin: '50px 265px' }} />
      </g>

      {/* --- Principal subdivision: the four quarters ------------------------ */}
      <g className="stroke-royal-300" strokeWidth="1.1">
        <path data-draw="major" d="M200 40v300" style={{ transformOrigin: '200px 40px' }} />
        <path data-draw="major" d="M50 190h300" style={{ transformOrigin: '50px 190px' }} />
      </g>

      {/* --- Boundary -------------------------------------------------------- */}
      <rect
        data-draw="boundary"
        x="50" y="40" width="300" height="300"
        className="stroke-white"
        strokeWidth="1.6"
      />

      {/* Corner registration ticks, as on a survey sheet. */}
      <g className="stroke-white/55" strokeWidth="1.2">
        <path d="M50 26v-8M350 26v-8M50 354v8M350 354v8" />
        <path d="M36 40h-8M36 340h-8M364 40h8M364 340h8" />
      </g>

      {/* --- Annotations ----------------------------------------------------- */}
      <g>
        <text
          data-fade="annotation"
          x="50" y="24"
          className="fill-white text-[13px] font-medium tracking-[0.18em]"
        >
          1 ROPANI
        </text>
        <text
          data-fade="annotation"
          x="350" y="24"
          textAnchor="end"
          className="fill-royal-300 text-[12px] font-light"
        >
          508.72 m²
        </text>

        <text
          data-fade="annotation"
          x="275" y="366"
          textAnchor="middle"
          className="fill-emerald-200 text-[13px] font-medium tracking-[0.16em]"
        >
          4 AANA
        </text>
        <text
          data-fade="annotation"
          x="275" y="384"
          textAnchor="middle"
          className="fill-royal-300 text-[11px] font-light"
        >
          a valley house plot
        </text>

        {/* Each cell is one aana. Marked once rather than sixteen times. */}
        <text
          data-fade="annotation"
          x="87" y="86"
          textAnchor="middle"
          className="fill-royal-300 text-[11px] font-extralight"
        >
          1 aana
        </text>
      </g>
    </svg>
  );
}
