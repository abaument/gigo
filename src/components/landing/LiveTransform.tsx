/**
 * The landing hero instrument: a real adapter payload being rewritten
 * into its clean, schema-conforming counterpart, line by line, while a
 * read head sweeps the source.
 *
 * The pairs come from the same demo scenarios the demo account is seeded
 * with, and they are highlighted by the app's own tokenizer, so what a
 * visitor watches is what the product actually produces. Nothing is
 * fetched and no model is ever called: the sequence is presentation only.
 *
 * Under prefers-reduced-motion the finished state is rendered at once.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { tokenizeJson, TOKEN_CLASS } from '@/lib/utils/json-tokenizer';

export type TransformPair = {
  /** short domain label, e.g. "e-commerce" */
  tag: string;
  /** what the source system sends */
  input: string;
  /** what the adapter returns */
  output: string;
  /** transform time shown under the output, in milliseconds */
  ms: number;
};

export type LiveTransformLabels = {
  input: string;
  output: string;
  valid: string;
  waiting: string;
  /** how many learnings the run reused, worded as the product words it */
  learnings: string;
  /** one short sentence per correction, for the pair being shown */
  notes: string[][];
};

const LINE_MS = 110; // one output line every ~110ms
const START_MS = 420;
const HOLD_MS = 3200; // pause once a pair is complete
const FADE_MS = 500;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function JsonLine({ line }: { line: string }) {
  const tokens = tokenizeJson(line);
  return (
    // wrap rather than clip: a long email or sentence must stay readable
    <div className="whitespace-pre-wrap break-words pl-4 -indent-4">
      {tokens.length === 0
        ? ' '
        : tokens.map((tok, i) => {
            const cls = TOKEN_CLASS[tok.type];
            return cls ? (
              <span key={i} className={cls}>
                {tok.text}
              </span>
            ) : (
              <span key={i}>{tok.text}</span>
            );
          })}
    </div>
  );
}

export function LiveTransform({
  pairs,
  labels,
  still = false,
}: {
  pairs: TransformPair[];
  labels: LiveTransformLabels;
  /** freeze on the finished first pair (projector safe mode) */
  still?: boolean;
}) {
  const reduced = usePrefersReducedMotion() || still;
  const [index, setIndex] = useState(0);
  const [lines, setLines] = useState(0);
  const [fading, setFading] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pair = pairs[index];
  const inputLines = pair.input.split('\n');
  const outputLines = pair.output.split('\n');
  const done = lines >= outputLines.length;
  // the read head walks the source at the same pace as the output fills
  const headRatio = Math.min(1, lines / Math.max(1, outputLines.length));

  useEffect(() => {
    if (reduced) {
      setLines(pairs[index].output.split('\n').length);
      return;
    }
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    clear();
    setLines(0);
    setFading(false);

    const count = pairs[index].output.split('\n').length;
    for (let i = 0; i < count; i += 1) {
      timers.current.push(setTimeout(() => setLines(i + 1), START_MS + i * LINE_MS));
    }
    const total = START_MS + count * LINE_MS;
    timers.current.push(setTimeout(() => setFading(true), total + HOLD_MS));
    timers.current.push(
      setTimeout(() => setIndex((n) => (n + 1) % pairs.length), total + HOLD_MS + FADE_MS)
    );
    return clear;
  }, [index, reduced, pairs]);

  const notes = labels.notes[index] ?? [];
  // stay dimmed through the swap, until the first line of the new pair
  // lands: at full opacity an empty output pane reads as a glitch
  const dimmed = fading || (!reduced && lines === 0);

  return (
    <div className={`min-w-0 transition-opacity duration-500 ${dimmed ? 'opacity-30' : 'opacity-100'}`}>
    <div
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4"
    >
      {/* source */}
      <figure className="relative min-w-0 rounded-xl border border-bark bg-coffee/70 backdrop-blur-sm overflow-hidden">
        <figcaption className="flex items-center justify-between gap-3 px-4 py-2 border-b border-bark/80">
          <span className="font-accent text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-coral/90">
            {labels.input}
          </span>
          <span className="font-accent text-[10px] sm:text-[11px] text-taupe">{pair.tag}</span>
        </figcaption>
        <div className="relative">
          <pre className="min-w-0 max-w-full px-4 py-3 text-[10.5px] sm:text-[11.5px] leading-[1.7] text-sand/70 min-h-[13.5rem]">
            {inputLines.map((l, i) => (
              <JsonLine key={i} line={l} />
            ))}
          </pre>
          {!reduced && !done && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber to-transparent shadow-[0_0_18px_rgba(212,168,83,0.55)] transition-[top] duration-150 ease-linear"
              style={{ top: `calc(0.75rem + ${headRatio * 100}% * 0.82)` }}
            />
          )}
        </div>
      </figure>

      {/* transfer */}
      <div className="flex lg:flex-col items-center justify-center gap-2 py-1 lg:py-0">
        <span className="hidden lg:block h-20 w-px bg-gradient-to-b from-transparent to-amber/40" />
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-amber/50 bg-amber/10 text-amber shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 rotate-90 lg:rotate-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5-5m5 5-5 5" />
          </svg>
          {!reduced && !done && (
            <span aria-hidden className="absolute inset-0 rounded-full border border-amber/60 animate-ping" />
          )}
        </span>
        <span className="hidden lg:block h-20 w-px bg-gradient-to-t from-transparent to-amber/40" />
      </div>

      {/* result */}
      <figure className="min-w-0 rounded-xl border border-amber/30 bg-coffee/70 backdrop-blur-sm overflow-hidden shadow-[0_0_80px_-35px_rgba(212,168,83,0.8)]">
        <figcaption className="flex items-center justify-between gap-3 px-4 py-2 border-b border-amber/20">
          <span className="font-accent text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-amber">
            {labels.output}
          </span>
          <span className="font-accent text-[10px] sm:text-[11px] text-taupe tabular-nums">
            {done ? `${pair.ms} ms` : ''}
          </span>
        </figcaption>
        <pre className="min-w-0 max-w-full px-4 py-3 text-[10.5px] sm:text-[11.5px] leading-[1.7] text-cream/90 min-h-[13.5rem]">
          {outputLines.slice(0, lines).map((l, i) => (
            <JsonLine key={i} line={l} />
          ))}
          {!done && !reduced && (
            <span aria-hidden className="inline-block w-[0.55em] h-[1em] align-text-bottom bg-amber/80 animate-pulse" />
          )}
        </pre>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 border-t border-bark/60">
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-500 ${
              done ? 'bg-sage/20 text-sage' : 'bg-bark text-timber'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-2.5 w-2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
          </span>
          <span
            className={`font-accent text-[10px] sm:text-[11px] transition-colors duration-500 ${
              done ? 'text-sage' : 'text-timber'
            }`}
          >
            {done ? labels.valid : labels.waiting}
          </span>
          <span
            className={`ml-auto whitespace-nowrap rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 font-accent text-[9px] text-amber transition-opacity duration-500 sm:text-[10px] ${
              done ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {labels.learnings}
          </span>
        </div>
      </figure>
    </div>

      {/* what the model actually corrected on this pair */}
      <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-3">
        {notes.map((note, i) => (
          <li
            key={note}
            className={`flex gap-2 font-accent text-[11px] leading-snug transition-opacity duration-500 sm:text-xs ${
              done || reduced ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transitionDelay: `${i * 90}ms` }}
          >
            <span className="font-body text-amber">{String.fromCharCode(65 + i)}</span>
            <span className="text-taupe">{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
