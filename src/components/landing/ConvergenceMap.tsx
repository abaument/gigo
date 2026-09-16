/**
 * The argument of the product in one gesture: seven sources crossing
 * toward five destinations (thirty five point to point links), then the
 * same links pinched through a single hub, which is what an adapter is.
 *
 * The animation runs once, on entering the viewport, for about a second
 * and a half, then stops: a requestAnimationFrame loop interpolating the
 * control points of thirty five quadratic curves, no library, no timer
 * left running. Under prefers-reduced-motion the converged state is
 * rendered directly.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

const SOURCES = 7;
const DESTS = 5;
const W = 900;
const H = 460;
const HUB = { x: W / 2, y: H / 2 };
const DURATION = 1500;

/** Vertically spread node positions on a column. */
function column(count: number, x: number) {
  const span = H - 120;
  return Array.from({ length: count }, (_, i) => ({
    x,
    y: 60 + (span * (count === 1 ? 0.5 : i / (count - 1))),
  }));
}

const SRC = column(SOURCES, 90);
const DST = column(DESTS, W - 90);

/** Eased progress: slow start, decisive finish. */
function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function ConvergenceMap({
  labels,
  still = false,
}: {
  labels: { before: string; after: string; hub: string; sources: string; destinations: string };
  /** render the converged state without animating (projector safe mode) */
  still?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const counterRef = useRef<HTMLSpanElement>(null);
  const linkGroupRef = useRef<SVGGElement>(null);
  const hubRef = useRef<SVGGElement>(null);
  // coarse phase only: React must not re-render on every frame, the
  // frame loop writes straight to the DOM instead
  const [converged, setConverged] = useState(still);

  const links = SOURCES * DESTS;
  const connections = SOURCES + DESTS;

  useEffect(() => {
    const apply = (p: number) => {
      let k = 0;
      for (let s = 0; s < SOURCES; s += 1) {
        for (let d = 0; d < DESTS; d += 1) {
          const a = SRC[s];
          const b = DST[d];
          // control point slides from the straight-ish midpoint to the hub
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const cx = midX + (HUB.x - midX) * p;
          const cy = midY + (HUB.y - midY) * p;
          const el = pathRefs.current[k];
          if (el) el.setAttribute('d', `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`);
          k += 1;
        }
      }
      if (linkGroupRef.current) {
        linkGroupRef.current.style.stroke =
          p > 0.55 ? 'rgba(212,168,83,0.42)' : 'rgba(205,92,92,0.32)';
      }
      if (hubRef.current) hubRef.current.style.opacity = String(p);
      if (counterRef.current) {
        counterRef.current.textContent = String(
          Math.round(links - (links - connections) * p)
        );
      }
    };

    const el = wrapRef.current;
    if (!el) return;

    if (still || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply(1);
      setConverged(true);
      return;
    }

    apply(0);
    let frame = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (now: number) => {
          const raw = Math.min(1, (now - t0) / DURATION);
          apply(easeInOut(raw));
          if (raw < 1) {
            frame = requestAnimationFrame(tick);
          } else {
            setConverged(true);
          }
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [still, links, connections]);

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${labels.before} / ${labels.after}`}
      >
        <defs>
          <radialGradient id="hubGlow">
            <stop offset="0%" stopColor="rgba(212,168,83,0.35)" />
            <stop offset="100%" stopColor="rgba(212,168,83,0)" />
          </radialGradient>
        </defs>

        {/* links: stroke and geometry are driven by the frame loop */}
        <g
          ref={linkGroupRef}
          fill="none"
          strokeWidth={1.1}
          stroke="rgba(205,92,92,0.32)"
          style={{ transition: 'stroke 600ms ease' }}
        >
          {Array.from({ length: links }, (_, i) => (
            <path
              key={i}
              ref={(el) => {
                pathRefs.current[i] = el;
              }}
            />
          ))}
        </g>

        {/* hub */}
        <g ref={hubRef} style={{ opacity: 0 }}>
          <circle cx={HUB.x} cy={HUB.y} r={70} fill="url(#hubGlow)" />
          <circle cx={HUB.x} cy={HUB.y} r={26} fill="#1a1310" stroke="rgba(212,168,83,0.8)" strokeWidth={1.4} />
          <text
            x={HUB.x}
            y={HUB.y + 4}
            textAnchor="middle"
            className="font-accent"
            fontSize="11"
            letterSpacing="1.5"
            fill="#d4a853"
          >
            {labels.hub}
          </text>
        </g>

        {/* nodes */}
        {SRC.map((p, i) => (
          <g key={`s${i}`}>
            <rect
              x={p.x - 26}
              y={p.y - 11}
              width={52}
              height={22}
              rx={5}
              fill="#231a14"
              stroke="rgba(245,239,230,0.16)"
            />
            <circle cx={p.x} cy={p.y} r={2.4} fill="#cd5c5c" />
          </g>
        ))}
        {DST.map((p, i) => (
          <g key={`d${i}`}>
            <rect
              x={p.x - 26}
              y={p.y - 11}
              width={52}
              height={22}
              rx={5}
              fill="#231a14"
              stroke="rgba(245,239,230,0.16)"
            />
            <circle cx={p.x} cy={p.y} r={2.4} fill="#6b8e6b" />
          </g>
        ))}
      </svg>

      {/* readouts */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-accent text-[11px] uppercase tracking-[0.2em]">
        <span className="text-taupe">
          {labels.sources}: <span className="text-cream tabular-nums">{SOURCES}</span>
        </span>
        <span
          className={`transition-colors duration-500 ${converged ? 'text-amber' : 'text-coral'}`}
        >
          <span ref={counterRef} className="tabular-nums">
            {links}
          </span>{' '}
          {converged ? labels.after : labels.before}
        </span>
        <span className="text-taupe">
          {labels.destinations}: <span className="text-cream tabular-nums">{DESTS}</span>
        </span>
      </div>
    </div>
  );
}
