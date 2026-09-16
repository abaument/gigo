/**
 * Public landing page.
 *
 * Composed as a technical plate set: a numbered rail down the left
 * margin, hairline rules, registration marks, and one live instrument
 * per idea. Every figure shows real product data (the demo scenarios,
 * the real target schemas, the real learning records); nothing here
 * calls a model or touches the database, so the page stays cheap and
 * cannot fail during a demo.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LiveTransform } from '@/components/landing/LiveTransform';
import { ConvergenceMap } from '@/components/landing/ConvergenceMap';
import { LearningLoop } from '@/components/landing/LearningLoop';
import { Reveal } from '@/components/landing/Reveal';
import { HERO_PAIRS, HERO_NOTES } from '@/components/landing/data';
import { REPO_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing');
  return {
    title: 'GIGO - Garbage In, Gold Out',
    description: t('hero.sub'),
    openGraph: {
      title: 'GIGO - Garbage In, Gold Out',
      description: t('hero.sub'),
      type: 'website',
    },
  };
}

/** Section shell: number in the margin, hairline rule, generous air. */
function Plate({
  num,
  kicker,
  title,
  children,
  className = '',
}: {
  num: string;
  kicker: string;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative border-t border-bark/60 py-16 sm:py-24 ${className}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="flex items-baseline gap-4 sm:gap-6">
            <span className="font-body text-xs text-timber tabular-nums shrink-0 pt-1">{num}</span>
            <div className="min-w-0">
              <p className="font-body text-[11px] uppercase tracking-[0.3em] text-amber">{kicker}</p>
              <h2 className="mt-3 font-display text-2xl leading-tight text-cream sm:text-4xl">
                {title}
              </h2>
            </div>
          </div>
        </Reveal>
        <div className="mt-10 sm:mt-14 sm:pl-[calc(1.5rem+2ch)]">{children}</div>
      </div>
    </section>
  );
}

function Card({
  title,
  body,
  accent = 'amber',
}: {
  title: string;
  body: string;
  accent?: 'amber' | 'sage' | 'coral';
}) {
  const bar =
    accent === 'sage' ? 'bg-sage' : accent === 'coral' ? 'bg-coral' : 'bg-amber';
  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-bark bg-coffee/50 p-5 sm:p-6">
      <span className={`absolute inset-y-0 left-0 w-[3px] ${bar}`} />
      <h3 className="font-display text-lg text-cream">{title}</h3>
      <p className="mt-2 font-accent text-sm leading-relaxed text-sand/80">{body}</p>
    </div>
  );
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ still?: string }>;
}) {
  const [t, params] = await Promise.all([getTranslations('landing'), searchParams]);
  // `?still=1` freezes every animation: a safety valve for a projector or
  // a screen recording, without touching the visitor's system settings.
  const still = params.still === '1';

  const steps = [
    { n: '01', title: t('how.s1Title'), body: t('how.s1Body') },
    { n: '02', title: t('how.s2Title'), body: t('how.s2Body') },
    { n: '03', title: t('how.s3Title'), body: t('how.s3Body') },
    { n: '04', title: t('how.s4Title'), body: t('how.s4Body') },
  ];

  const guarantees = [
    { title: t('guarantees.c1Title'), body: t('guarantees.c1Body') },
    { title: t('guarantees.c2Title'), body: t('guarantees.c2Body') },
    { title: t('guarantees.c3Title'), body: t('guarantees.c3Body') },
    { title: t('guarantees.c4Title'), body: t('guarantees.c4Body') },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* instrument backdrop: fine grid, major grid, amber halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.55]"
        style={{
          backgroundImage: `radial-gradient(900px 520px at 15% -5%, rgba(212,168,83,0.10), transparent 70%),
            linear-gradient(rgba(212,168,83,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,168,83,0.05) 1px, transparent 1px),
            linear-gradient(rgba(245,239,230,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,239,230,0.018) 1px, transparent 1px)`,
          backgroundSize: '100% 100%, 128px 128px, 128px 128px, 32px 32px, 32px 32px',
        }}
      />

      <div className="relative z-10">
        {/* ------------------------------------------------ 00 hero */}
        <section className="relative px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/5 px-3 py-1 font-body text-[10px] uppercase tracking-[0.22em] text-amber sm:text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                {t('hero.eyebrow')}
              </p>
              <h1 className="mt-5 font-display text-[2.1rem] leading-[1.06] text-cream sm:text-5xl lg:text-[3.4rem]">
                {t('hero.title')}
                <br />
                <span className="bg-gradient-to-r from-amber via-gold to-copper bg-clip-text text-transparent">
                  {t('hero.titleAccent')}
                </span>
              </h1>
              <p className="mt-5 max-w-xl font-accent text-[0.95rem] leading-relaxed text-sand/85 sm:text-base">
                {t('hero.sub')}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/signup" className="btn-primary text-sm">
                  {t('hero.ctaPrimary')}
                </Link>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-secondary text-sm"
                >
                  {t('hero.ctaSecondary')}
                </a>
              </div>
              <p className="mt-4 font-accent text-xs text-taupe">{t('hero.note')}</p>

              <dl className="mt-8 grid grid-cols-3 gap-3 border-t border-bark/60 pt-5">
                {[
                  { v: '110', l: t('hero.statTests') },
                  { v: '3', l: t('hero.statInputs') },
                  { v: 'MIT', l: t('hero.statLicense') },
                ].map((s) => (
                  <div key={s.l}>
                    <dt className="font-display text-xl text-amber sm:text-2xl">{s.v}</dt>
                    <dd className="mt-1 font-accent text-[11px] leading-snug text-taupe">{s.l}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={100}>
              {/* spec strip: what goes in, what runs it, what comes out */}
              <dl className="grid min-w-0 gap-px overflow-hidden rounded-t-xl border border-bark bg-bark sm:grid-cols-3">
                {[
                  { k: t('hero.specIn'), v: t('hero.specInValue') },
                  { k: t('hero.specEngine'), v: t('hero.specEngineValue') },
                  { k: t('hero.specOut'), v: t('hero.specOutValue') },
                ].map((cell) => (
                  <div key={cell.k} className="bg-coffee/80 px-4 py-3">
                    <dt className="font-body text-[10px] uppercase tracking-[0.24em] text-amber">
                      {cell.k}
                    </dt>
                    <dd className="mt-1 font-accent text-xs text-sand sm:text-sm">{cell.v}</dd>
                  </div>
                ))}
              </dl>

              <div className="min-w-0 rounded-b-xl border border-t-0 border-bark bg-espresso/40 p-3 sm:p-4">
                <LiveTransform
                  pairs={HERO_PAIRS}
                  labels={{
                    input: t('hero.benchInput'),
                    output: t('hero.benchOutput'),
                    valid: t('hero.benchValid'),
                    waiting: t('hero.benchWaiting'),
                    learnings: t('hero.benchLearnings'),
                    notes: HERO_NOTES.map((keys) => keys.map((k) => t(`hero.notes.${k}`))),
                  }}
                  still={still}
                />
              </div>
            </Reveal>

          </div>
        </section>

        {/* ------------------------------------------------ 01 problem */}
        <Plate num="01" kicker={t('problem.kicker')} title={t('problem.title')}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-14">
            <div className="space-y-4">
              <p className="font-accent text-sm leading-relaxed text-sand/85 sm:text-base">
                {t('problem.body')}
              </p>
              <p className="font-accent text-sm leading-relaxed text-sand/85 sm:text-base">
                {t('problem.bodyTwo')}
              </p>
            </div>
            <Reveal delay={80}>
              <ConvergenceMap
                labels={{
                  before: t('problem.before'),
                  after: t('problem.after'),
                  hub: t('problem.hub'),
                  sources: t('problem.sources'),
                  destinations: t('problem.destinations'),
                }}
                still={still}
              />
            </Reveal>
          </div>
        </Plate>

        {/* --------------------------------------- 02 the principle */}
        <Plate num="02" kicker={t('declaration.kicker')} title={t('declaration.title')}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-14">
            <div className="space-y-4">
              <p className="font-accent text-sm leading-relaxed text-sand/85 sm:text-base">
                {t('declaration.body')}
              </p>
              <p className="font-accent text-sm leading-relaxed text-taupe">
                {t('declaration.note')}
              </p>
            </div>
            <Reveal delay={80}>
              <ol className="relative space-y-3">
                {[t('declaration.step1'), t('declaration.step2'), t('declaration.step3')].map(
                  (step, i) => (
                    <li
                      key={step}
                      className="flex items-center gap-4 rounded-lg border border-bark bg-coffee/50 px-4 py-4"
                    >
                      <span className="font-body text-[11px] tabular-nums text-amber">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="font-accent text-sm text-cream sm:text-base">{step}</span>
                      {i < 2 && (
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="ml-auto h-4 w-4 rotate-90 text-timber"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5-5m5 5-5 5" />
                        </svg>
                      )}
                    </li>
                  )
                )}
              </ol>
            </Reveal>
          </div>
        </Plate>

        {/* ------------------------------------------------ 03 how it works */}
        <Plate num="03" kicker={t('how.kicker')} title={t('how.title')}>
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-xl border border-bark bg-bark sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.n} className="bg-coffee/70 p-5 sm:p-6">
                <Reveal delay={i * 70}>
                  <span className="font-body text-[11px] tabular-nums text-amber">{s.n}</span>
                  <h3 className="mt-3 font-display text-lg text-cream">{s.title}</h3>
                  <p className="mt-2 font-accent text-sm leading-relaxed text-sand/75">{s.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>

          <Reveal delay={120}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="font-body text-[11px] uppercase tracking-[0.2em] text-taupe">
                {t('how.inputsLabel')}
              </span>
              {[t('how.inputWebhook'), t('how.inputEmail'), t('how.inputPaste')].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-bark bg-coffee/60 px-3 py-1 font-accent text-xs text-sand"
                >
                  {label}
                </span>
              ))}
            </div>
          </Reveal>
        </Plate>

        {/* ------------------------------------------------ 03 guarantees */}
        <Plate num="04" kicker={t('guarantees.kicker')} title={t('guarantees.title')}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            {guarantees.map((c, i) => (
              <Reveal key={c.title} delay={i * 70}>
                <Card title={c.title} body={c.body} />
              </Reveal>
            ))}
          </div>
        </Plate>

        {/* ------------------------------------------------ 05 learning loop */}
        <Plate num="05" kicker={t('learning.kicker')} title={t('learning.title')}>
          <div className="space-y-12">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:gap-12">
              <p className="font-accent text-sm leading-relaxed text-sand/85 sm:text-base">
                {t('learning.body')}
              </p>
              <p className="font-accent text-sm leading-relaxed text-taupe sm:text-base">
                {t('learning.bodyTwo')}
              </p>
            </div>

            <Reveal>
              <LearningLoop
                center={t('learning.loopCenter')}
                still={still}
                steps={[
                  { title: t('learning.loopStep1'), note: t('learning.loopStep1Note') },
                  { title: t('learning.loopStep2'), note: t('learning.loopStep2Note') },
                  { title: t('learning.loopStep3'), note: t('learning.loopStep3Note') },
                  { title: t('learning.loopStep4'), note: t('learning.loopStep4Note') },
                ]}
              />
            </Reveal>

            <Reveal delay={80}>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
                <figure className="h-full overflow-hidden rounded-xl border border-sage/30 bg-coffee/60">
                  <figcaption className="flex items-center justify-between gap-3 border-b border-sage/20 px-4 py-2">
                    <span className="font-body text-[10px] uppercase tracking-[0.2em] text-sage">
                      {t('learning.exampleLabel')}
                    </span>
                    <span className="font-accent text-[11px] text-taupe">
                      {t('learning.exampleNote')}
                    </span>
                  </figcaption>
                  <pre className="min-w-0 max-w-full whitespace-pre-wrap break-words px-4 py-3 font-body text-[11px] leading-[1.7] text-sand/85">
{`{ "invoice_number": "FA-2026-0412",
  "customer_email": "jp.martin@exemple.fr",
  "total_incl_vat_cents": 125050 }`}
                  </pre>
                </figure>

                <figure className="h-full overflow-hidden rounded-xl border border-coral/30 bg-coffee/60">
                  <figcaption className="flex items-center justify-between gap-3 border-b border-coral/20 px-4 py-2">
                    <span className="font-body text-[10px] uppercase tracking-[0.2em] text-coral">
                      {t('learning.pitfallLabel')}
                    </span>
                    <span className="font-accent text-[11px] text-taupe">
                      {t('learning.pitfallNote')}
                    </span>
                  </figcaption>
                  <p className="px-4 py-3 font-body text-[11px] leading-[1.7] text-sand/85">
                    {t('learning.pitfallBody')}
                  </p>
                </figure>
              </div>
            </Reveal>

            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
              {[
                { title: t('learning.f1Title'), body: t('learning.f1Body') },
                { title: t('learning.f2Title'), body: t('learning.f2Body') },
                { title: t('learning.f3Title'), body: t('learning.f3Body') },
                { title: t('learning.f4Title'), body: t('learning.f4Body') },
              ].map((c, i) => (
                <Reveal key={c.title} delay={i * 60}>
                  <Card title={c.title} body={c.body} accent={i % 2 === 0 ? 'amber' : 'sage'} />
                </Reveal>
              ))}
            </div>
          </div>
        </Plate>

        {/* ------------------------------------------------ 05 open source */}
        <Plate num="06" kicker={t('openSource.kicker')} title={t('openSource.title')}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="max-w-2xl font-accent text-sm leading-relaxed text-sand/85 sm:text-base">
                {t('openSource.body')}
              </p>
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                {[t('openSource.p1'), t('openSource.p2'), t('openSource.p3')].map((p) => (
                  <li key={p} className="flex items-center gap-2 font-accent text-sm text-sand">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sage/20 text-sage">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-2.5 w-2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                      </svg>
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-secondary text-sm shrink-0 self-start lg:self-center"
            >
              {t('openSource.cta')}
            </a>
          </div>
        </Plate>

        {/* ------------------------------------------------ 06 final call */}
        <section className="relative border-t border-bark/60 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Reveal>
              <h2 className="font-display text-3xl leading-tight text-cream sm:text-5xl">
                {t('final.title')}
              </h2>
              <p className="mx-auto mt-5 max-w-xl font-accent text-sm leading-relaxed text-sand/85 sm:text-base">
                {t('final.body')}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup" className="btn-primary text-sm">
                  {t('final.ctaPrimary')}
                </Link>
                <Link href="/how-to" className="btn-secondary text-sm">
                  {t('final.ctaSecondary')}
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </div>
    </div>
  );
}
